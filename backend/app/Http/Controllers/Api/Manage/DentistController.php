<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Http\Resources\DentistResource;
use App\Models\Clinic;
use App\Models\Dentist;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Dentists working at the clinic. Dentists are added through staff
 * management (role "dentist"); here the clinic edits their public profile
 * and their weekly schedule at this clinic's branches.
 */
class DentistController extends Controller
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function index(Clinic $clinic)
    {
        $dentists = $this->query($clinic)
            ->with(['user', 'specialization', 'schedules' => fn ($q) => $q->whereIn('branch_id', $clinic->branches()->select('id'))])
            ->get();

        return $this->ok($dentists->map(fn ($d) => (new DentistResource($d))->staffView()->resolve()));
    }

    public function update(Request $request, Clinic $clinic, int $dentistId)
    {
        $dentist = $this->find($clinic, $dentistId);

        $data = $request->validate([
            'specialization_id' => ['sometimes', 'nullable', 'integer', 'exists:specializations,id'],
            'license_number' => ['sometimes', 'nullable', 'string', 'max:50'],
            'years_experience' => ['sometimes', 'integer', 'min:0', 'max:70'],
            'qualifications' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'bio' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $dentist->update($data);
        $this->audit->record('dentist.updated', $dentist, ['fields' => array_keys($data)], $clinic->id);

        return $this->ok((new DentistResource($dentist->load(['user', 'specialization'])))->staffView()->resolve(), 'Dentist profile updated');
    }

    /**
     * Replace the dentist's weekly schedule at this clinic.
     * Body: { schedules: [{ branch_id, day_of_week, starts_at: "08:00", ends_at: "12:00" }] }
     */
    public function updateSchedules(Request $request, Clinic $clinic, int $dentistId)
    {
        $dentist = $this->find($clinic, $dentistId);
        $branchIds = $clinic->branches()->pluck('id');

        $data = $request->validate([
            'schedules' => ['present', 'array', 'max:50'],
            'schedules.*.branch_id' => ['required', 'integer', Rule::in($branchIds)],
            'schedules.*.day_of_week' => ['required', 'integer', 'between:0,6'],
            'schedules.*.starts_at' => ['required', 'date_format:H:i'],
            'schedules.*.ends_at' => ['required', 'date_format:H:i', 'after:schedules.*.starts_at'],
        ]);

        $keys = collect($data['schedules'])->map(fn ($s) => $s['branch_id'].'-'.$s['day_of_week']);
        if ($keys->duplicates()->isNotEmpty()) {
            return $this->fail('Each branch and day can only appear once.', 422, ['schedules' => ['Each branch and day can only appear once.']]);
        }

        DB::transaction(function () use ($dentist, $branchIds, $data) {
            $dentist->schedules()->whereIn('branch_id', $branchIds)->delete();
            foreach ($data['schedules'] as $schedule) {
                $dentist->schedules()->create($schedule);
            }
        });

        $this->audit->record('dentist.schedule_updated', $dentist, clinicId: $clinic->id);

        return $this->ok(
            (new DentistResource($dentist->load(['user', 'specialization', 'schedules' => fn ($q) => $q->whereIn('branch_id', $branchIds)])))->staffView()->resolve(),
            'Schedule saved'
        );
    }

    private function find(Clinic $clinic, int $id): Dentist
    {
        return $this->query($clinic)->findOrFail($id);
    }

    /** Includes inactive profiles so they can be reactivated; still clinic-scoped. */
    private function query(Clinic $clinic)
    {
        return Dentist::query()
            ->whereHas('user.clinicMemberships', fn ($q) => $q->where('clinic_id', $clinic->id)->where('role', 'dentist'));
    }
}
