<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Http\Resources\PatientResource;
use App\Models\Appointment;
use App\Models\Clinic;
use App\Models\Patient;
use App\Models\PatientMedicalHistory;
use App\Models\User;
use App\Notifications\PortalNotice;
use App\Services\AuditLogger;
use App\Support\BusinessTime;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

/**
 * Patients registered with this clinic. Dentists only see patients who
 * have an appointment with them at this clinic.
 * Medical history is clinical: it needs records.view / records.write.
 */
class PatientController extends Controller
{
    private const ACTIVE_MONTHS = 12;

    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function index(Request $request, Clinic $clinic)
    {
        $request->validate(['search' => ['nullable', 'string', 'max:100'], 'status' => ['nullable', 'in:active,inactive']]);

        $here = fn ($q) => $q->where('clinic_id', $clinic->id);
        $booked = fn ($q) => $here($q)->whereNotIn('status', [Appointment::CANCELLED, Appointment::REJECTED]);
        $cutoff = now()->subMonths(self::ACTIVE_MONTHS);

        $query = $this->visible($request, $clinic)
            ->with('user')
            ->withCount(['appointments as visits' => fn ($q) => $here($q)->where('status', Appointment::COMPLETED)])
            ->withMax(['appointments as last_visit_at' => fn ($q) => $here($q)->where('status', Appointment::COMPLETED)], 'starts_at')
            ->withMax(['appointments as last_booked_at' => $booked], 'starts_at')
            ->orderBy('patients.id', 'desc');

        // Active: registered or booked here in the last ACTIVE_MONTHS months (or booked ahead).
        if ($request->filled('status')) {
            $recent = fn ($q) => $q->where('clinic_patients.created_at', '>=', $cutoff)
                ->orWhereHas('appointments', fn ($a) => $booked($a)->where('starts_at', '>=', $cutoff));
            $request->status === 'active'
                ? $query->where($recent)
                : $query->whereNot($recent);
        }

        if ($request->filled('search')) {
            $term = '%'.mb_strtolower($request->search).'%';
            $query->where(fn ($q) => $q
                ->whereRaw('LOWER(patients.full_name) LIKE ?', [$term])
                ->orWhereRaw('LOWER(patients.email) LIKE ?', [$term])
                ->orWhere('patients.phone', 'like', $term)
                ->orWhereHas('user', fn ($u) => $u->whereRaw('LOWER(name) LIKE ?', [$term])->orWhereRaw('LOWER(email) LIKE ?', [$term])));
        }

        $page = $query->paginate($this->perPage($request, 20));
        $membership = $request->attributes->get('clinicMembership');
        // Conditions are clinical data: only for those who may read records, and every read is logged.
        $histories = $membership->grants('records.view')
            ? PatientMedicalHistory::where('clinic_id', $clinic->id)
                ->whereIn('patient_id', collect($page->items())->pluck('id'))
                ->orderBy('created_at')->orderBy('id')
                ->get(['patient_id', 'conditions', 'allergies'])
                ->keyBy('patient_id')
            : null;
        $conditions = $histories?->map->conditions;
        $allergies = $histories?->map->allergies;
        if ($conditions !== null && $page->count() > 0) {
            $this->audit->record('records.summary_viewed', metadata: ['patients' => $page->count()], clinicId: $clinic->id);
        }

        return $this->paginated($page, fn ($p) => [
            ...(new PatientResource($p))->resolve(),
            'conditions' => $conditions === null ? null : ($conditions[$p->id] ?? null),
            'allergies' => $allergies === null ? null : ($allergies[$p->id] ?? null),
            'visits' => (int) $p->visits,
            'last_visit_at' => $p->last_visit_at ? BusinessTime::iso(CarbonImmutable::parse($p->last_visit_at, 'UTC')) : null,
            'status' => ($p->pivot->created_at >= $cutoff || ($p->last_booked_at && CarbonImmutable::parse($p->last_booked_at, 'UTC') >= $cutoff)) ? 'active' : 'inactive',
        ]);
    }

    /** Register a walk-in patient without a portal account. */
    public function store(Request $request, Clinic $clinic)
    {
        $data = $request->validate($this->rules(true));

        $patient = DB::transaction(function () use ($data, $clinic, $request) {
            $patient = new Patient($data);
            $patient->created_by = $request->user()->id;
            $patient->save();
            $patient->registerWith($clinic, $request->user());

            return $patient;
        });

        $this->audit->record('patient.registered', $patient, clinicId: $clinic->id);

        return $this->ok((new PatientResource($patient))->resolve(), 'Patient registered', 201);
    }

    public function show(Request $request, Clinic $clinic, int $patientId)
    {
        $patient = $this->visible($request, $clinic)->with('user')->findOrFail($patientId);
        $this->audit->record('patient.viewed', $patient, clinicId: $clinic->id);
        $membership = $request->attributes->get('clinicMembership');
        $completed = $patient->appointments()->where('clinic_id', $clinic->id)->where('status', Appointment::COMPLETED);
        $cutoff = now()->subMonths(self::ACTIVE_MONTHS);
        $isActive = $clinic->patients()->whereKey($patient->id)->where('clinic_patients.created_at', '>=', $cutoff)->exists()
            || $patient->appointments()->where('clinic_id', $clinic->id)
                ->whereNotIn('status', [Appointment::CANCELLED, Appointment::REJECTED])
                ->where('starts_at', '>=', $cutoff)->exists();

        return $this->ok([
            ...(new PatientResource($patient))->resolve(),
            'status' => $isActive ? 'active' : 'inactive',
            'visits' => (clone $completed)->count(),
            'last_visit_at' => BusinessTime::iso((clone $completed)->max('starts_at') ? CarbonImmutable::parse((clone $completed)->max('starts_at'), 'UTC') : null),
            'medical_summary' => $membership->grants('records.view') ? $patient->medicalSummaryAt($clinic) : null,
        ]);
    }

    /**
     * Update contact details. Patients with a portal account manage their
     * own name and email; the clinic only updates the rest.
     */
    public function update(Request $request, Clinic $clinic, int $patientId)
    {
        $patient = $this->visible($request, $clinic)->findOrFail($patientId);
        $data = $request->validate($this->rules(false));

        if ($patient->user_id) {
            unset($data['full_name'], $data['email']);
        }

        $patient->update($data);
        $this->audit->record('patient.updated', $patient, ['fields' => array_keys($data)], $clinic->id);

        return $this->ok((new PatientResource($patient->load('user')))->resolve(), 'Patient updated');
    }

    public function medicalHistory(Request $request, Clinic $clinic, int $patientId)
    {
        $patient = $this->visible($request, $clinic)->findOrFail($patientId);
        $this->audit->record('records.medical_history_viewed', $patient, clinicId: $clinic->id);

        $entries = PatientMedicalHistory::where('patient_id', $patient->id)
            ->where('clinic_id', $clinic->id)
            ->with('recordedBy:id,name')
            ->latest('created_at')->latest('id')
            ->get()
            ->map(fn ($h) => [
                'id' => $h->id,
                'allergies' => $h->allergies,
                'medications' => $h->medications,
                'conditions' => $h->conditions,
                'notes' => $h->notes,
                'recorded_by' => $h->recordedBy?->name,
                'recorded_at' => BusinessTime::iso($h->created_at),
            ]);

        $consents = $patient->consentValues();

        // The first entry is current; the rest is history.
        return $this->ok([
            'current' => $entries->first(),
            'history' => $entries->slice(1)->values(),
            // What the patient reports themselves: only if they agreed to share it.
            'patient_reported' => $consents['share_medical_history']
                ? ['blood_type' => $patient->blood_type, ...($patient->health_profile ?? [])]
                : null,
            'emergency_contact_consent' => $consents['emergency_contact_consent'],
        ]);
    }

    public function storeMedicalHistory(Request $request, Clinic $clinic, int $patientId)
    {
        $patient = $this->visible($request, $clinic)->findOrFail($patientId);

        $data = $request->validate([
            'allergies' => ['nullable', 'string', 'max:2000'],
            'medications' => ['nullable', 'string', 'max:2000'],
            'conditions' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:4000'],
        ]);

        $previous = PatientMedicalHistory::where('patient_id', $patient->id)->where('clinic_id', $clinic->id)->latest('created_at')->latest('id')->first();

        $entry = new PatientMedicalHistory($data);
        $entry->patient_id = $patient->id;
        $entry->clinic_id = $clinic->id;
        $entry->recorded_by = $request->user()->id;
        $entry->save();

        $this->audit->record('records.medical_history_added', $patient, clinicId: $clinic->id);
        $this->flagChangesToDentists($request, $clinic, $patient, $previous, $entry);

        return $this->ok(['id' => $entry->id], 'Medical history updated', 201);
    }

    /**
     * A new allergy or condition matters to whoever treats the patient next. Says that it
     * changed, not what it is: notifications can be read on a lock screen.
     */
    private function flagChangesToDentists(Request $request, Clinic $clinic, Patient $patient, ?PatientMedicalHistory $previous, PatientMedicalHistory $entry): void
    {
        $changed = array_keys(array_filter([
            'allergy' => $entry->allergies && $entry->allergies !== $previous?->allergies,
            'medical' => $entry->conditions && $entry->conditions !== $previous?->conditions,
        ]));
        if (! $changed) {
            return;
        }

        $dentists = User::whereKeyNot($request->user()->id)
            ->where('status', User::STATUS_ACTIVE)
            ->whereHas('dentist.appointments', fn ($q) => $q->where('clinic_id', $clinic->id)->where('patient_id', $patient->id))
            ->get();

        Notification::send($dentists, new PortalNotice(
            'patient',
            'Patient Medical Flag',
            "{$patient->display_name} has a new ".implode(' and ', $changed).' note. Review before the next procedure.',
            'patient_flags',
            ['type' => 'clinic_patient', 'id' => $patient->id, 'clinic_id' => $clinic->id],
        ));
    }

    private function visible(Request $request, Clinic $clinic): BelongsToMany
    {
        $query = $clinic->patients();

        if ($dentist = $this->actingDentist($request)) {
            $query->whereHas('appointments', fn ($q) => $q->where('clinic_id', $clinic->id)->where('dentist_id', $dentist->id));
        }

        return $query;
    }

    private function rules(bool $creating): array
    {
        return [
            'full_name' => [$creating ? 'required' : 'sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'phone' => [$creating ? 'required' : 'sometimes', 'string', 'max:20'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'birth_date' => ['sometimes', 'nullable', 'date', 'before:today'],
            'gender' => ['sometimes', 'nullable', 'in:male,female,other'],
            'emergency_contact_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'emergency_contact_phone' => ['sometimes', 'nullable', 'string', 'max:20'],
            'blood_type' => ['sometimes', 'nullable', 'in:A+,A-,B+,B-,AB+,AB-,O+,O-'],
        ];
    }
}
