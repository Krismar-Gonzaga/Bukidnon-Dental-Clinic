<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PatientRecordResource;
use App\Models\Patient;
use App\Models\PatientRecord;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/** The signed-in patient's own profile and patient-facing records. */
class PatientController extends Controller
{
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
        ]);

        $user->update(array_intersect_key($data, array_flip(['name', 'email'])));
        $user->patient?->update(array_diff_key($data, array_flip(['name', 'email'])));

        return $this->ok($this->profileData($user->load('patient')), 'Profile updated successfully');
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
            'notification_preferences' => ['email' => ($user->notification_preferences['email'] ?? true)],
        ];
    }
}
