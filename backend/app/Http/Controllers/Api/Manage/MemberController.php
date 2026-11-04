<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Clinic;
use App\Models\ClinicMembership;
use App\Models\Dentist;
use App\Models\ScheduleBlock;
use App\Support\BusinessTime;
use App\Services\AuditLogger;
use App\Services\MembershipService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/** Clinic staff management (clinic.staff.manage). */
class MemberController extends Controller
{
    public function __construct(
        private readonly MembershipService $memberships,
        private readonly AuditLogger $audit,
    ) {
    }

    /**
     * Staff directory. Dentists also get the branches they are scheduled at
     * and whether a time-off block covers today; other roles work at every
     * branch (branches: null).
     */
    public function index(Clinic $clinic)
    {
        $members = $clinic->memberships()->with('user:id,name,email,status')->orderBy('role')->get();

        $dentistUserIds = $members->where('role', ClinicMembership::ROLE_DENTIST)->pluck('user_id');
        $dentists = Dentist::whereIn('user_id', $dentistUserIds)
            ->with(['schedules' => fn ($q) => $q->whereHas('branch', fn ($b) => $b->where('clinic_id', $clinic->id))->with('branch:id,name')])
            ->get()->keyBy('user_id');

        $today = BusinessTime::today();
        $onLeave = ScheduleBlock::where('clinic_id', $clinic->id)
            ->whereIn('dentist_id', $dentists->pluck('id'))
            ->where('starts_at', '<', BusinessTime::utc($today->endOfDay()))
            ->where('ends_at', '>', BusinessTime::utc($today))
            ->pluck('dentist_id')->unique();

        // Last sign-in of each member, from the audit log.
        $lastActive = AuditLog::where('action', 'auth.login')
            ->whereIn('user_id', $members->pluck('user_id'))
            ->selectRaw('user_id, MAX(created_at) AS last_at')
            ->groupBy('user_id')
            ->pluck('last_at', 'user_id');

        return $this->ok($members->map(function (ClinicMembership $m) use ($dentists, $onLeave, $lastActive) {
            $dentist = $m->role === ClinicMembership::ROLE_DENTIST ? $dentists->get($m->user_id) : null;
            $last = $lastActive[$m->user_id] ?? null;

            return $this->present($m) + [
                'last_active_at' => $last ? BusinessTime::iso(CarbonImmutable::parse($last, 'UTC')) : null,
                'branches' => $dentist
                    ? $dentist->schedules->pluck('branch.name')->filter()->unique()->values()
                    : null,
                'on_leave_today' => $dentist ? $onLeave->contains($dentist->id) : false,
            ];
        }));
    }

    public function store(Request $request, Clinic $clinic)
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            // Optional: an emailed invitation may not know it yet.
            'name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'role' => ['required', Rule::in(ClinicMembership::roles())],
            'phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'position' => ['sometimes', 'nullable', Rule::in(array_keys(config('permissions.staff_positions')))],
            'permissions' => ['sometimes', 'nullable', 'array'],
            'permissions.*' => [Rule::in(config('permissions.staff_assignable'))],
            'specialization_id' => ['sometimes', 'nullable', 'integer', 'exists:specializations,id'],
            'years_experience' => ['sometimes', 'integer', 'min:0', 'max:70'],
            'qualifications' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'working_days' => ['sometimes', 'array', 'max:7'],
            'working_days.*' => ['integer', 'between:0,6'],
            'starts_at' => ['required_with:working_days', 'date_format:H:i'],
            'ends_at' => ['required_with:working_days', 'date_format:H:i', 'after:starts_at'],
        ]);

        $this->guardAdministrators($request, $data);

        $name = $data['name'] ?? null ?: Str::of($data['email'])->before('@')->replace(['.', '_', '-'], ' ')->title()->toString();
        $membership = $this->memberships->invite($clinic, $data['email'], $name, $data['role'], $request->user());
        $membership->forceFill([
            'phone' => $data['phone'] ?? null,
            'position' => $data['role'] === ClinicMembership::ROLE_STAFF ? ($data['position'] ?? null) : null,
            'custom_permissions' => $data['role'] === ClinicMembership::ROLE_STAFF ? ($data['permissions'] ?? null) : null,
        ])->save();

        if ($data['role'] === ClinicMembership::ROLE_DENTIST) {
            $this->fillDentistProfile($clinic, $membership, $data);
        }

        return $this->ok(
            $this->present($membership->load('user')),
            $membership->status === ClinicMembership::STATUS_INVITED
                ? 'Invitation sent. They will appear as active once they accept.'
                : 'Account created. They will receive an email to set their password.',
            201
        );
    }

    public function update(Request $request, Clinic $clinic, ClinicMembership $membership)
    {
        $data = $request->validate([
            'role' => ['sometimes', Rule::in(ClinicMembership::roles())],
            'status' => ['sometimes', Rule::in([ClinicMembership::STATUS_ACTIVE, ClinicMembership::STATUS_SUSPENDED])],
            'phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'position' => ['sometimes', 'nullable', Rule::in(array_keys(config('permissions.staff_positions')))],
            'permissions' => ['sometimes', 'nullable', 'array'],
            'permissions.*' => [Rule::in(config('permissions.staff_assignable'))],
            'work_schedule' => ['sometimes', 'nullable', 'array'],
            'work_schedule.days' => ['required_with:work_schedule', 'array', 'max:7'],
            'work_schedule.days.*' => ['integer', 'between:0,6'],
            'work_schedule.starts_at' => ['required_with:work_schedule', 'date_format:H:i'],
            'work_schedule.ends_at' => ['required_with:work_schedule', 'date_format:H:i', 'after:work_schedule.starts_at'],
        ]);

        $this->guardAdministrators($request, $data, $membership);

        $membership = $this->memberships->update($membership, array_diff_key($data, array_flip(['position', 'permissions', 'work_schedule'])), $request->user());
        if (array_key_exists('position', $data) || array_key_exists('permissions', $data) || array_key_exists('work_schedule', $data)) {
            $membership->forceFill([
                ...(array_key_exists('work_schedule', $data) ? ['work_schedule' => $data['work_schedule']] : []),
                ...(array_key_exists('position', $data) ? ['position' => $data['position']] : []),
                ...(array_key_exists('permissions', $data) ? ['custom_permissions' => $data['permissions']] : []),
            ])->save();
        }

        return $this->ok($this->present($membership->load('user')), 'Member updated');
    }

    /** Emails the member a link to choose a new password. Nobody ever sees their password. */
    public function resetPassword(Request $request, Clinic $clinic, ClinicMembership $membership)
    {
        $this->guardAdministrators($request, [], $membership);
        $user = $membership->user;

        Password::sendResetLink(['email' => $user->email]);
        $this->audit->record('membership.password_reset_sent', $membership, clinicId: $clinic->id);

        return $this->ok(message: "A password reset link was sent to {$user->name}.");
    }

    /**
     * Someone trusted with staff management is not automatically an administrator: only a
     * clinic administrator may touch another administrator or choose what people can do.
     */
    private function guardAdministrators(Request $request, array $data, ?ClinicMembership $target = null): void
    {
        $actor = $request->attributes->get('clinicMembership');
        if ($actor->role === ClinicMembership::ROLE_CLINIC_ADMIN) {
            return;
        }

        $changesAccess = ($data['role'] ?? null) === ClinicMembership::ROLE_CLINIC_ADMIN
            || array_key_exists('permissions', $data)
            || (isset($data['role']) && $target !== null);

        if ($changesAccess || $target?->role === ClinicMembership::ROLE_CLINIC_ADMIN) {
            throw new AccessDeniedHttpException('Only a clinic administrator can do this.');
        }
    }

    /** What the Add Dentist form filled in: their public profile and weekly hours. */
    private function fillDentistProfile(Clinic $clinic, ClinicMembership $membership, array $data): void
    {
        $dentist = Dentist::firstWhere('user_id', $membership->user_id);
        if (! $dentist) {
            return;
        }

        $dentist->update(array_intersect_key($data, array_flip(['specialization_id', 'years_experience', 'qualifications'])));

        $branch = $clinic->branches()->where('is_main', true)->first() ?? $clinic->branches()->first();
        if ($branch && ! empty($data['working_days'])) {
            foreach (array_unique($data['working_days']) as $day) {
                $dentist->schedules()->updateOrCreate(
                    ['branch_id' => $branch->id, 'day_of_week' => $day],
                    ['starts_at' => $data['starts_at'], 'ends_at' => $data['ends_at']],
                );
            }
        }
    }

    private function present(ClinicMembership $m): array
    {
        return [
            'id' => $m->id,
            'user_id' => $m->user_id,
            'name' => $m->user?->name,
            'email' => $m->user?->email,
            'phone' => $m->phone,
            'role' => $m->role,
            'position' => $m->position,
            'permissions' => $m->permissions(),
            'has_custom_permissions' => is_array($m->custom_permissions),
            'work_schedule' => $m->work_schedule,
            'status' => $m->status,
            'account_status' => $m->user?->status,
            'joined_at' => BusinessTime::iso($m->created_at),
        ];
    }
}
