<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Http\Resources\AppointmentResource;
use App\Models\Appointment;
use App\Models\Clinic;
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
 * - appointments.progress (dentists): start/complete/no-show their own.
 */
class AppointmentController extends Controller
{
    private const RELATIONS = ['clinic', 'branch', 'dentist.user', 'serviceRate', 'patient:id,user_id,birth_date'];

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

        return $this->paginated(
            $query->paginate($this->perPage($request, 50)),
            fn ($a) => (new AppointmentResource($a))->clinicView()->resolve()
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

        return $this->ok((new AppointmentResource($appointment))->clinicView()->resolve());
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

    public function start(Request $request, Clinic $clinic, int $appointmentId)
    {
        return $this->move($request, $clinic, $appointmentId, Appointment::IN_PROGRESS, 'Appointment started');
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
