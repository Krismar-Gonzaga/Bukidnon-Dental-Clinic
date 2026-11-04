<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Http\Resources\DentistResource;
use App\Models\Appointment;
use App\Models\Clinic;
use App\Models\Dentist;
use App\Notifications\PortalNotice;
use App\Services\AuditLogger;
use App\Support\BusinessTime;
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
    private const RECENT_APPOINTMENTS = 20;

    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function index(Clinic $clinic)
    {
        $dentists = $this->query($clinic)
            ->with(['user', 'specialization', 'schedules' => fn ($q) => $q->whereIn('branch_id', $clinic->branches()->select('id'))])
            ->get();

        // Booked visits today per dentist, for the management cards.
        $today = BusinessTime::today();
        $todayCounts = $clinic->appointments()->toBase()
            ->whereBetween('starts_at', [BusinessTime::utc($today), BusinessTime::utc($today->endOfDay())])
            ->whereNotIn('status', [Appointment::CANCELLED, Appointment::REJECTED])
            ->selectRaw('dentist_id, COUNT(*) AS total')
            ->groupBy('dentist_id')
            ->pluck('total', 'dentist_id');

        return $this->ok($dentists->map(fn ($d) => [
            ...(new DentistResource($d))->staffView()->resolve(),
            'appointments_today' => (int) ($todayCounts[$d->id] ?? 0),
        ]));
    }

    /** One dentist's profile for the clinic: details, figures and recent appointments. */
    public function show(Clinic $clinic, int $dentistId)
    {
        $dentist = $this->find($clinic, $dentistId)->load(['user', 'specialization', 'schedules' => fn ($q) => $q->whereIn('branch_id', $clinic->branches()->pluck('id'))]);
        $mine = fn () => $clinic->appointments()->where('dentist_id', $dentist->id);
        $today = BusinessTime::today();
        $membership = $clinic->memberships()->where('user_id', $dentist->user_id)->first();

        return $this->ok([
            ...(new DentistResource($dentist))->staffView()->resolve(),
            'phone' => $membership?->phone,
            'membership_id' => $membership?->id,
            'joined_at' => BusinessTime::iso($membership?->created_at),
            'appointments_today' => $mine()
                ->whereBetween('starts_at', [BusinessTime::utc($today), BusinessTime::utc($today->endOfDay())])
                ->whereNotIn('status', [Appointment::CANCELLED, Appointment::REJECTED])
                ->count(),
            'appointments_total' => $mine()->count(),
            'appointments' => $mine()->with('serviceRate')->latest('starts_at')->limit(self::RECENT_APPOINTMENTS)->get()->map(fn (Appointment $a) => [
                'id' => $a->id,
                'patient' => $a->patient_name,
                'service' => $a->serviceRate?->service_name,
                'starts_at' => BusinessTime::iso($a->starts_at),
                'status' => $a->status,
            ]),
        ]);
    }

    public function update(Request $request, Clinic $clinic, int $dentistId)
    {
        $dentist = $this->find($clinic, $dentistId);

        $data = $request->validate([
            'specialization_id' => ['sometimes', 'nullable', 'integer', 'exists:specializations,id'],
            'license_number' => ['sometimes', 'nullable', 'string', 'max:50'],
            'years_experience' => ['sometimes', 'integer', 'min:0', 'max:70'],
            'qualifications' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'secondary_specialization' => ['sometimes', 'nullable', 'string', 'max:255'],
            'education' => ['sometimes', 'nullable', 'string', 'max:255'],
            'website' => ['sometimes', 'nullable', 'string', 'max:255'],
            'ptr_number' => ['sometimes', 'nullable', 'string', 'max:50'],
            's2_number' => ['sometimes', 'nullable', 'string', 'max:50'],
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
        if ($dentist->user_id !== $request->user()->id) {
            $dentist->user?->notify(new PortalNotice('schedule', 'Schedule Update', 'Your working hours were updated by the clinic administrator.', 'schedule_updates'));
        }

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
