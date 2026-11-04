<?php

namespace App\Http\Controllers\Api\Manage;

use Carbon\CarbonImmutable;
use App\Http\Controllers\Controller;
use App\Http\Resources\AppointmentResource;
use App\Models\Appointment;
use App\Models\Clinic;
use App\Models\ClinicMembership;
use App\Models\PatientMedicalHistory;
use App\Services\AppointmentService;
use App\Services\AuditLogger;
use App\Support\BusinessTime;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Clinic-side appointment management.
 * - appointments.view_all: every appointment of the clinic.
 * - appointments.view_assigned (dentists): only their own; anything else
 *   is "not found".
 * - appointments.manage: confirm/reject/reschedule/cancel/check in, and
 *   book on behalf of a registered patient.
 * - appointments.review_assigned (dentists): confirm or decline requests made to them.
 * - appointments.progress (dentists): start/complete/no-show their own.
 */
class AppointmentController extends Controller
{
    private const RELATIONS = ['clinic', 'branch', 'dentist.user', 'serviceRate', 'patient:id,user_id,birth_date,gender'];

    public function __construct(
        private readonly AppointmentService $appointments,
        private readonly AuditLogger $audit,
    ) {
    }

    public function index(Request $request, Clinic $clinic)
    {
        $data = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
            'status' => ['nullable', 'string'],
            'dentist_id' => ['nullable', 'integer'],
            'branch_id' => ['nullable', 'integer'],
            'service_rate_id' => ['nullable', 'integer'],
            'patient_id' => ['nullable', 'integer'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $query = $this->visible($request, $clinic)->with(self::RELATIONS)->orderBy('starts_at');

        if (isset($data['from'])) {
            $query->where('starts_at', '>=', BusinessTime::utc(BusinessTime::parse($data['from'])));
        }
        if (isset($data['to'])) {
            $query->where('starts_at', '<=', BusinessTime::utc(BusinessTime::parse($data['to'])->endOfDay()));
        }
        if (isset($data['status'])) {
            $query->whereIn('status', explode(',', $data['status']));
        }
        foreach (['dentist_id', 'branch_id', 'service_rate_id', 'patient_id'] as $filter) {
            if (isset($data[$filter])) {
                $query->where($filter, $data[$filter]);
            }
        }
        if (isset($data['search'])) {
            $term = '%'.mb_strtolower($data['search']).'%';
            $query->where(fn ($q) => $q->whereRaw('LOWER(patient_name) LIKE ?', [$term])
                ->orWhereRaw('LOWER(patient_email) LIKE ?', [$term])
                ->orWhereHas('serviceRate', fn ($s) => $s->whereRaw('LOWER(service_name) LIKE ?', [$term])));
        }

        $readsRecords = $this->membership($request)->grants('records.view');
        if ($readsRecords) {
            $this->audit->record('records.visit_notes_listed', null, ['page' => (int) $request->query('page', 1)], $clinic->id);
        }

        return $this->paginated(
            $query->paginate($this->perPage($request, 50)),
            fn ($a) => (new AppointmentResource($a))->clinicView()->withTreatmentNotes($readsRecords)->resolve()
        );
    }

    /** Booked appointments per Philippine calendar day of a month (dashboard calendar). */
    public function calendar(Request $request, Clinic $clinic)
    {
        $data = $request->validate(['month' => ['nullable', 'date_format:Y-m']]);
        $month = isset($data['month']) ? BusinessTime::parse($data['month'].'-01') : BusinessTime::today()->startOfMonth();
        $day = BusinessTime::daySql('starts_at');

        $totals = $this->visible($request, $clinic)
            ->whereNotIn('status', [Appointment::CANCELLED, Appointment::REJECTED])
            ->whereBetween('starts_at', [BusinessTime::utc($month), BusinessTime::utc($month->endOfMonth())])
            ->selectRaw("{$day} AS day, COUNT(*) AS total")
            ->groupByRaw($day)
            ->toBase()
            ->pluck('total', 'day');

        return $this->ok([
            'month' => $month->format('Y-m'),
            'days' => $totals->map(fn ($total, $date) => ['date' => $date, 'total' => (int) $total])->sortKeys()->values(),
        ]);
    }

    public function show(Request $request, Clinic $clinic, int $appointmentId)
    {
        $appointment = $this->visible($request, $clinic)->with([...self::RELATIONS, 'statusHistory'])->findOrFail($appointmentId);

        $readsRecords = $this->membership($request)->grants('records.view');
        if ($readsRecords && $appointment->patient_id) {
            // The medical summary needs more of the patient than the list does.
            $appointment->load('patient');
            $this->audit->record('records.summary_viewed', $appointment, ['patient_id' => $appointment->patient_id], $clinic->id);
        }

        return $this->ok([
            ...(new AppointmentResource($appointment))->clinicView()->withTreatmentNotes($readsRecords)->resolve(),
            'medical_flags' => $this->medicalFlags($request, $clinic, $appointment),
            'patient_last_visit_at' => BusinessTime::iso($this->lastVisit($clinic, $appointment)),
            'patient_snapshot' => $readsRecords && $appointment->patient ? [
                ...$appointment->patient->medicalSummaryAt($clinic),
                'visits' => $clinic->appointments()->where('patient_id', $appointment->patient_id)->where('status', Appointment::COMPLETED)->count(),
            ] : null,
        ]);
    }

    /** Give the appointment to another dentist at the same time, if they are free. */
    public function reassign(Request $request, Clinic $clinic, int $appointmentId)
    {
        $data = $request->validate(['dentist_id' => ['required', 'integer']]);

        $appointment = $this->visible($request, $clinic)->findOrFail($appointmentId);
        $appointment = $this->appointments->reschedule(
            $appointment,
            BusinessTime::iso($appointment->starts_at),
            $request->user(),
            'Reassigned to another dentist',
            $data['dentist_id'],
        );

        return $this->ok((new AppointmentResource($appointment->fresh(self::RELATIONS)))->clinicView()->resolve(), 'Dentist reassigned');
    }

    private function lastVisit(Clinic $clinic, Appointment $appointment): ?CarbonImmutable
    {
        $last = $appointment->patient_id
            ? $clinic->appointments()->where('patient_id', $appointment->patient_id)->where('status', Appointment::COMPLETED)->max('starts_at')
            : null;

        return $last ? CarbonImmutable::parse($last, 'UTC') : null;
    }

    /**
     * Conditions and allergies the clinic recorded, for those who may read clinical data or
     * see these alerts (front desk). Clinical notes are never included, and every view is logged.
     */
    private function medicalFlags(Request $request, Clinic $clinic, Appointment $appointment): array
    {
        $membership = $request->attributes->get('clinicMembership');
        if (! ($membership?->grants('records.view') || $membership?->grants('patients.medical_alerts')) || ! $appointment->patient_id) {
            return [];
        }

        $latest = PatientMedicalHistory::where('clinic_id', $clinic->id)
            ->where('patient_id', $appointment->patient_id)
            ->latest()->latest('id')
            ->first();

        if ($latest && ($latest->conditions || $latest->allergies)) {
            $this->audit->record('records.alerts_viewed', $appointment, ['patient_id' => $appointment->patient_id], $clinic->id);
        }

        return collect([$latest?->conditions ? "Conditions: {$latest->conditions}" : null, $latest?->allergies ? "Allergies: {$latest->allergies}" : null])->filter()->values()->all();
    }

    /**
     * Book for a patient registered with this clinic (e.g. by phone). With
     * walk_in the patient is at the clinic, so the booking is confirmed at once.
     */
    public function store(Request $request, Clinic $clinic)
    {
        $data = $request->validate([
            'patient_id' => ['required', 'integer'],
            'service_rate_id' => ['required', 'integer'],
            'dentist_id' => ['required', 'integer'],
            'branch_id' => ['required', 'integer'],
            'starts_at' => ['required', 'date'],
            'reason' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'walk_in' => ['sometimes', 'boolean'],
        ]);

        $patient = $clinic->patients()->findOrFail($data['patient_id']);
        $appointment = $this->appointments->book($clinic, $patient, $data, $request->user());

        if ($data['walk_in'] ?? false) {
            $this->audit->record('appointment.walk_in', $appointment, clinicId: $clinic->id);
            $appointment = $this->appointments->transition($appointment, Appointment::CONFIRMED, $request->user());
        }

        return $this->ok((new AppointmentResource($appointment->load(self::RELATIONS)))->clinicView()->resolve(), 'Appointment booked', 201);
    }

    public function confirm(Request $request, Clinic $clinic, int $appointmentId)
    {
        return $this->move($request, $clinic, $appointmentId, Appointment::CONFIRMED, 'Appointment confirmed');
    }

    public function reject(Request $request, Clinic $clinic, int $appointmentId)
    {
        $request->validate(['reason' => ['required', 'string', 'max:500']]);

        return $this->move($request, $clinic, $appointmentId, Appointment::REJECTED, 'Appointment request declined');
    }

    public function cancel(Request $request, Clinic $clinic, int $appointmentId)
    {
        $request->validate(['reason' => ['required', 'string', 'max:500']]);

        return $this->move($request, $clinic, $appointmentId, Appointment::CANCELLED, 'Appointment cancelled');
    }

    public function checkIn(Request $request, Clinic $clinic, int $appointmentId)
    {
        return $this->move($request, $clinic, $appointmentId, Appointment::CHECKED_IN, 'Patient checked in');
    }

    /**
     * Begin the visit. A dentist can start a confirmed visit of today directly: at a clinic
     * with no front desk nobody else would check the patient in. Both steps stay on record.
     */
    public function start(Request $request, Clinic $clinic, int $appointmentId)
    {
        $appointment = $this->visible($request, $clinic)->findOrFail($appointmentId);

        if ($appointment->status === Appointment::CONFIRMED && $this->membership($request)->role === ClinicMembership::ROLE_DENTIST) {
            if (BusinessTime::local($appointment->starts_at)->toDateString() !== BusinessTime::today()->toDateString()) {
                return $this->fail('This visit can only be started on the day of the appointment.', 422);
            }
            $this->appointments->transition($appointment, Appointment::CHECKED_IN, $request->user());
        }

        return $this->move($request, $clinic, $appointmentId, Appointment::IN_PROGRESS, 'Appointment started');
    }

    /** The dentist's note on this visit. Clinical: full records stay in clinical notes. */
    public function saveTreatmentNotes(Request $request, Clinic $clinic, int $appointmentId)
    {
        $data = $request->validate(['notes' => ['present', 'nullable', 'string', 'max:5000']]);

        $appointment = $this->visible($request, $clinic)->findOrFail($appointmentId);
        $appointment->forceFill(['treatment_notes' => $data['notes']])->save();
        // Only that it changed: the note itself is clinical and stays out of the audit log.
        $this->audit->record('records.visit_notes_updated', $appointment, ['patient_id' => $appointment->patient_id], $clinic->id);

        return $this->ok((new AppointmentResource($appointment->fresh(self::RELATIONS)))->clinicView()->withTreatmentNotes()->resolve(), 'Notes saved');
    }

    public function complete(Request $request, Clinic $clinic, int $appointmentId)
    {
        return $this->move($request, $clinic, $appointmentId, Appointment::COMPLETED, 'Appointment completed');
    }

    public function noShow(Request $request, Clinic $clinic, int $appointmentId)
    {
        return $this->move($request, $clinic, $appointmentId, Appointment::NO_SHOW, 'Marked as no-show');
    }

    public function reschedule(Request $request, Clinic $clinic, int $appointmentId)
    {
        $data = $request->validate([
            'starts_at' => ['required', 'date'],
            'dentist_id' => ['nullable', 'integer'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $appointment = $this->visible($request, $clinic)->findOrFail($appointmentId);
        $appointment = $this->appointments->reschedule($appointment, $data['starts_at'], $request->user(), $data['reason'] ?? null, $data['dentist_id'] ?? null);

        return $this->ok((new AppointmentResource($appointment->fresh(self::RELATIONS)))->clinicView()->resolve(), 'Appointment rescheduled');
    }

    public function approveReschedule(Request $request, Clinic $clinic, int $appointmentId)
    {
        $appointment = $this->visible($request, $clinic)->findOrFail($appointmentId);
        $appointment = $this->appointments->approveRescheduleRequest($appointment, $request->user());

        return $this->ok((new AppointmentResource($appointment->fresh(self::RELATIONS)))->clinicView()->resolve(), 'New time confirmed');
    }

    private function move(Request $request, Clinic $clinic, int $appointmentId, string $to, string $message)
    {
        $appointment = $this->visible($request, $clinic)->findOrFail($appointmentId);
        $appointment = $this->appointments->transition($appointment, $to, $request->user(), $request->input('reason'));

        return $this->ok((new AppointmentResource($appointment->fresh(self::RELATIONS)))->clinicView()->resolve(), $message);
    }

    /** This clinic's appointments the member may see. */
    private function visible(Request $request, Clinic $clinic): Builder
    {
        $query = Appointment::where('clinic_id', $clinic->id);

        if (! $this->membership($request)->grants('appointments.view_all')) {
            $query->where('dentist_id', $this->actingDentist($request)?->id ?? 0);
        }

        return $query;
    }
}
