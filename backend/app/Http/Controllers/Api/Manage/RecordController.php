<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Http\Resources\PatientRecordResource;
use App\Models\Appointment;
use App\Models\Clinic;
use App\Models\ClinicMembership;
use App\Models\Patient;
use App\Models\PatientRecord;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Clinical records (records.view / records.write — dentists by default).
 * Every read is audit-logged. Records are never edited or deleted:
 * corrections are amendments that supersede the original.
 */
class RecordController extends Controller
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function index(Request $request, Clinic $clinic, int $patientId)
    {
        $patient = $this->patient($request, $clinic, $patientId);

        $records = PatientRecord::where('clinic_id', $clinic->id)
            ->where('patient_id', $patient->id)
            ->readableBy($request->user()->id)
            ->when(! $request->boolean('include_superseded'), fn ($q) => $q->current())
            ->with(['dentist.user', 'author'])
            ->latest()->latest('id')
            ->get();

        $this->audit->record('records.viewed', $patient, ['count' => $records->count()], $clinic->id);

        return $this->ok(PatientRecordResource::collection($records)->resolve());
    }

    /**
     * Current records across the clinic's patients, newest first. Dentists
     * only see records of patients who have an appointment with them;
     * `mine` keeps the records the signed-in member wrote.
     */
    public function clinicIndex(Request $request, Clinic $clinic)
    {
        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'record_type' => ['nullable', Rule::in(PatientRecord::TYPES)],
            'kind' => ['nullable', Rule::in(['notes', 'treatments'])],
            'patient_id' => ['nullable', 'integer'],
            'mine' => ['sometimes', 'boolean'],
        ]);
        $isDentist = $this->membership($request)->role === ClinicMembership::ROLE_DENTIST;
        $dentistId = $this->actingDentist($request)?->id ?? 0;

        $query = PatientRecord::where('clinic_id', $clinic->id)
            ->current()
            ->readableBy($request->user()->id)
            ->when(($data['kind'] ?? null) === 'notes', fn ($q) => $q->whereIn('record_type', PatientRecord::NOTE_TYPES))
            ->when(($data['kind'] ?? null) === 'treatments', fn ($q) => $q->where('record_type', 'treatment'))
            ->when($data['patient_id'] ?? null, fn ($q, $id) => $q->where('patient_id', $id))
            ->when($isDentist, fn ($q) => $q->whereHas('patient.appointments', fn ($a) => $a
                ->where('clinic_id', $clinic->id)->where('dentist_id', $dentistId)))
            ->when($request->boolean('mine'), fn ($q) => $q->where('created_by', $request->user()->id))
            ->when($data['record_type'] ?? null, fn ($q, $type) => $q->where('record_type', $type))
            ->when($data['search'] ?? null, function ($q, $search) {
                $term = '%'.mb_strtolower($search).'%';
                $q->whereHas('patient', fn ($p) => $p->where(fn ($w) => $w
                    ->whereRaw('LOWER(full_name) LIKE ?', [$term])
                    ->orWhereHas('user', fn ($u) => $u->whereRaw('LOWER(name) LIKE ?', [$term]))));
            })
            ->with(['dentist.user', 'author', 'patient.user'])
            ->latest()->latest('id');

        $page = $query->paginate($this->perPage($request, 20));
        $this->audit->record('records.listed', null, ['count' => count($page->items()), 'page' => $page->currentPage()], $clinic->id);

        return $this->paginated($page, fn ($record) => (new PatientRecordResource($record))->withPatient()->resolve());
    }

    public function store(Request $request, Clinic $clinic, int $patientId)
    {
        $patient = $this->patient($request, $clinic, $patientId);
        $data = $request->validate($this->rules($clinic, $patient));

        $record = new PatientRecord($data);
        $record->clinic_id = $clinic->id;
        $record->patient_id = $patient->id;
        $record->appointment_id = $data['appointment_id'] ?? null;
        $record->dentist_id = $this->actingDentist($request)?->id;
        $record->created_by = $request->user()->id;
        $record->status = $data['status'] ?? PatientRecord::FINAL;
        // A draft is the author's working copy: it cannot be shown to the patient yet.
        $record->is_patient_visible = $record->status === PatientRecord::FINAL && ($data['is_patient_visible'] ?? false);
        $record->save();

        $this->audit->record('records.created', $record, ['patient_id' => $patient->id, 'status' => $record->status], $clinic->id);

        return $this->ok((new PatientRecordResource($record->load(['dentist.user', 'author'])))->resolve(), $record->status === PatientRecord::DRAFT ? 'Draft saved' : 'Record saved', 201);
    }

    /** Keep working on a draft, or finalize it. Only its author can, and only while it is a draft. */
    public function update(Request $request, Clinic $clinic, int $patientId, int $recordId)
    {
        $patient = $this->patient($request, $clinic, $patientId);
        $record = PatientRecord::where('clinic_id', $clinic->id)->where('patient_id', $patient->id)
            ->where('status', PatientRecord::DRAFT)
            ->where('created_by', $request->user()->id)
            ->findOrFail($recordId);
        $data = $request->validate($this->rules($clinic, $patient));

        $record->fill($data);
        $record->status = $data['status'] ?? PatientRecord::DRAFT;
        $record->is_patient_visible = $record->status === PatientRecord::FINAL && ($data['is_patient_visible'] ?? false);
        $record->save();

        $this->audit->record($record->status === PatientRecord::FINAL ? 'records.finalized' : 'records.draft_updated', $record, ['patient_id' => $patient->id], $clinic->id);

        return $this->ok((new PatientRecordResource($record->load(['dentist.user', 'author'])))->resolve(), $record->status === PatientRecord::FINAL ? 'Note finalized' : 'Draft saved');
    }

    /** Correct a record: a new version is created and the old one superseded. */
    public function amend(Request $request, Clinic $clinic, int $patientId, int $recordId)
    {
        $patient = $this->patient($request, $clinic, $patientId);
        $original = PatientRecord::where('clinic_id', $clinic->id)->where('patient_id', $patient->id)->current()->final()->findOrFail($recordId);

        $data = $request->validate([
            ...$this->rules($clinic, $patient),
            'amendment_reason' => ['required', 'string', 'max:500'],
        ]);

        $amended = DB::transaction(function () use ($original, $data, $request) {
            $amended = new PatientRecord($data);
            $amended->clinic_id = $original->clinic_id;
            $amended->patient_id = $original->patient_id;
            $amended->appointment_id = $original->appointment_id;
            $amended->dentist_id = $this->actingDentist($request)?->id ?? $original->dentist_id;
            $amended->amends_record_id = $original->id;
            $amended->created_by = $request->user()->id;
            $amended->save();

            $original->superseded_at = now();
            $original->save();

            return $amended;
        });

        $this->audit->record('records.amended', $amended, ['amends' => $original->id, 'reason' => $data['amendment_reason']], $clinic->id);

        return $this->ok((new PatientRecordResource($amended->load(['dentist.user', 'author'])))->resolve(), 'Record corrected');
    }

    private function patient(Request $request, Clinic $clinic, int $patientId): Patient
    {
        $query = $clinic->patients();

        if ($dentist = $this->actingDentist($request)) {
            $query->whereHas('appointments', fn ($q) => $q->where('clinic_id', $clinic->id)->where('dentist_id', $dentist->id));
        }

        return $query->findOrFail($patientId);
    }

    private function rules(Clinic $clinic, Patient $patient): array
    {
        return [
            'record_type' => ['required', Rule::in(PatientRecord::TYPES)],
            'appointment_id' => ['nullable', 'integer', Rule::exists(Appointment::class, 'id')
                ->where('clinic_id', $clinic->id)->where('patient_id', $patient->id)],
            'chief_complaint' => ['nullable', 'string', 'max:2000'],
            'findings' => ['nullable', 'string', 'max:5000'],
            'procedures' => ['nullable', 'string', 'max:5000'],
            'tooth_numbers' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'care_instructions' => ['nullable', 'string', 'max:5000'],
            'diagnosis' => ['nullable', 'string', 'max:5000'],
            'treatment_plan' => ['nullable', 'string', 'max:5000'],
            'follow_up_recommendations' => ['nullable', 'string', 'max:5000'],
            'materials_used' => ['nullable', 'string', 'max:500'],
            'performed_on' => ['nullable', 'date_format:Y-m-d'],
            'status' => ['sometimes', Rule::in([PatientRecord::DRAFT, PatientRecord::FINAL])],
            'is_patient_visible' => ['sometimes', 'boolean'],
        ];
    }
}
