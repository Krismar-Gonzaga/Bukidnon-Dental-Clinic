<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PatientRecordResource;
use App\Models\Patient;
use App\Models\PatientMedicalHistory;
use App\Models\PatientRecord;
use App\Services\AuditLogger;
use App\Support\BusinessTime;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/** The signed-in patient's own profile and patient-facing records. */
class PatientController extends Controller
{
    private const VITALS = ['blood_pressure', 'blood_sugar', 'heart_condition', 'pregnancy', 'bleeding_disorder', 'recent_surgery'];

    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function profile(Request $request)
    {
        return $this->ok($this->profileData($request->user()->load('patient')));
    }

    public function updateProfile(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'phone' => ['sometimes', 'string', 'max:20'],
            'address' => ['sometimes', 'string', 'max:255'],
            'birth_date' => ['sometimes', 'nullable', 'date', 'before:today'],
            'gender' => ['sometimes', 'nullable', 'in:male,female,other'],
            'emergency_contact_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'emergency_contact_phone' => ['sometimes', 'nullable', 'string', 'max:20'],
            'emergency_contact_relationship' => ['sometimes', 'nullable', 'string', 'max:50'],
            'emergency_contact_address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'civil_status' => ['sometimes', 'nullable', 'in:single,married,widowed,separated'],
            'blood_type' => ['sometimes', 'nullable', 'in:A+,A-,B+,B-,AB+,AB-,O+,O-'],
            'city' => ['sometimes', 'nullable', 'string', 'max:100'],
            'province' => ['sometimes', 'nullable', 'string', 'max:100'],
            'zip_code' => ['sometimes', 'nullable', 'string', 'max:10'],
            'consents' => ['sometimes', 'array:'.implode(',', Patient::CONSENTS)],
            'consents.*' => ['boolean'],
        ]);

        $patient = $user->patient;
        $user->update(array_intersect_key($data, array_flip(['name', 'email'])));

        if (isset($data['consents'])) {
            $changed = array_keys(array_diff_assoc($data['consents'], $patient?->consentValues() ?? []));
            $data['consents'] = [...($patient?->consentValues() ?? []), ...$data['consents']];
            if ($patient && $changed !== []) {
                // Who agreed to what, and when, must be provable.
                $this->audit->record('patient.consents_changed', $patient, ['consents' => $changed]);
            }
        }
        $patient?->update(array_diff_key($data, array_flip(['name', 'email'])));

        return $this->ok($this->profileData($user->load('patient')), 'Profile updated successfully');
    }

    /**
     * What the patient reports about their own health. Sent sections replace
     * the saved ones; the rest stay as they are.
     */
    public function updateHealth(Request $request)
    {
        $patient = $request->user()->patient ?? throw new AccessDeniedHttpException('Only patient accounts have a health profile.');
        $line = ['nullable', 'string', 'max:255'];

        $data = $request->validate([
            'conditions' => ['sometimes', 'array', 'max:30'],
            'conditions.*' => ['string', 'max:120'],
            'procedures' => ['sometimes', 'array', 'max:50'],
            'procedures.*.name' => ['required', 'string', 'max:120'],
            'procedures.*.detail' => $line,
            'procedures.*.date' => ['nullable', 'string', 'max:40'],
            'procedures.*.note' => $line,
            'vitals' => ['sometimes', 'array:'.implode(',', self::VITALS)],
            'vitals.*.value' => ['nullable', 'string', 'max:60'],
            'vitals.*.note' => $line,
            'allergies' => ['sometimes', 'array', 'max:30'],
            'allergies.*.name' => ['required', 'string', 'max:120'],
            'allergies.*.type' => ['required', 'in:drug,food,material,other'],
            'allergies.*.severity' => ['required', 'in:mild,moderate,severe'],
            'allergies.*.reaction' => $line,
            'medications' => ['sometimes', 'array', 'max:30'],
            'medications.*.name' => ['required', 'string', 'max:120'],
            'medications.*.dosage' => ['nullable', 'string', 'max:60'],
            'medications.*.purpose' => ['nullable', 'string', 'max:120'],
            'medications.*.note' => $line,
            'anxiety' => ['sometimes', 'array:level,sedation,notes'],
            'anxiety.level' => ['nullable', 'integer', 'between:0,5'],
            'anxiety.sedation' => ['nullable', 'string', 'max:120'],
            'anxiety.notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $patient->update(['health_profile' => [...($patient->health_profile ?? []), ...$data]]);
        // The sections changed, never their content.
        $this->audit->record('patient.health_profile_updated', $patient, ['sections' => array_keys($data)]);

        return $this->ok($this->profileData($request->user()->load('patient')), 'Profile updated successfully');
    }

    public function uploadPhoto(Request $request)
    {
        $patient = $request->user()->patient ?? throw new AccessDeniedHttpException('Only patient accounts have a profile photo.');

        $request->validate([
            'photo' => ['required', 'file', 'mimes:jpg,jpeg,png,webp', 'mimetypes:image/jpeg,image/png,image/webp', 'max:2048'],
        ]);

        $previous = $patient->photo_path;
        // A random name under the patient's folder; the extension comes from the file's real type.
        $patient->photo_path = $request->file('photo')->store("patient-photos/{$patient->id}", Patient::PHOTO_DISK);
        $patient->save();
        if ($previous) {
            Storage::disk(Patient::PHOTO_DISK)->delete($previous);
        }

        return $this->ok($this->profileData($request->user()->load('patient')), 'Photo updated');
    }

    /** The signed-in patient's own photo. */
    public function photo(Request $request)
    {
        $path = $request->user()->patient?->photo_path;
        abort_unless($path && Storage::disk(Patient::PHOTO_DISK)->exists($path), 404);

        return Storage::disk(Patient::PHOTO_DISK)->response($path, headers: [
            'Cache-Control' => 'private, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /**
     * Records a clinic chose to share with the patient. Only the care
     * instructions and visit summary are exposed — internal notes stay
     * with the clinic.
     */
    public function records(Request $request)
    {
        $patient = $request->user()->patient ?? throw new AccessDeniedHttpException('Only patient accounts have records.');

        $records = PatientRecord::where('patient_id', $patient->id)
            ->current()
            ->where('is_patient_visible', true)
            ->with(['clinic:id,name', 'dentist.user'])
            ->latest()
            ->get()
            ->map(fn ($record) => [
                'id' => $record->id,
                'clinic' => $record->clinic?->name,
                'dentist' => $record->dentist?->user?->name,
                'record_type' => $record->record_type,
                'procedures' => $record->procedures,
                'care_instructions' => $record->care_instructions,
                'date' => (new PatientRecordResource($record))->resolve()['created_at'],
            ]);

        return $this->ok($records);
    }

    /**
     * The patient's own allergies, medications and conditions as most
     * recently recorded by each clinic (right of access to their own data).
     * The clinic's free-text notes are not included.
     */
    public function medicalHistory(Request $request)
    {
        $patient = $request->user()->patient ?? throw new AccessDeniedHttpException('Only patient accounts have a medical history.');

        $latest = PatientMedicalHistory::where('patient_id', $patient->id)
            ->orderByDesc('created_at')->orderByDesc('id')
            ->get()
            ->unique('clinic_id')
            ->values();

        $clinics = \App\Models\Clinic::whereIn('id', $latest->pluck('clinic_id'))->pluck('name', 'id');

        return $this->ok($latest->map(fn ($entry) => [
            'clinic' => $clinics[$entry->clinic_id] ?? null,
            'allergies' => $entry->allergies,
            'medications' => $entry->medications,
            'conditions' => $entry->conditions,
            'recorded_at' => BusinessTime::iso($entry->created_at),
        ]));
    }

    private function profileData($user): array
    {
        /** @var Patient|null $patient */
        $patient = $user->patient;

        return [
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $patient?->phone,
            'address' => $patient?->address,
            'birth_date' => $patient?->birth_date?->toDateString(),
            'gender' => $patient?->gender,
            'emergency_contact_name' => $patient?->emergency_contact_name,
            'emergency_contact_phone' => $patient?->emergency_contact_phone,
            'emergency_contact_relationship' => $patient?->emergency_contact_relationship,
            'emergency_contact_address' => $patient?->emergency_contact_address,
            'civil_status' => $patient?->civil_status,
            'blood_type' => $patient?->blood_type,
            'city' => $patient?->city,
            'province' => $patient?->province,
            'zip_code' => $patient?->zip_code,
            // Changes with each upload, so clients know when to load the photo again.
            'photo_version' => $patient?->photo_path ? substr(md5($patient->photo_path), 0, 12) : null,
            'health' => $patient?->health_profile ?? (object) [],
            'consents' => $patient?->consentValues() ?? [],
            'notification_preferences' => ['email' => ($user->notification_preferences['email'] ?? true)],
        ];
    }
}
