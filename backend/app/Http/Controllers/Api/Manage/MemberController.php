<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Clinic;
use App\Models\ClinicMembership;
use App\Models\Dentist;
use App\Models\ScheduleBlock;
use App\Support\BusinessTime;
use App\Services\MembershipService;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Clinic staff management (clinic.staff.manage). */
class MemberController extends Controller
{
    public function __construct(private readonly MembershipService $memberships)
    {
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
            'name' => ['required', 'string', 'max:255'],
            'role' => ['required', Rule::in(ClinicMembership::roles())],
            'phone' => ['sometimes', 'nullable', 'string', 'max:30'],
        ]);

        $membership = $this->memberships->invite($clinic, $data['email'], $data['name'], $data['role'], $request->user());
        if (! empty($data['phone'])) {
            $membership->forceFill(['phone' => $data['phone']])->save();
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
        ]);

        $membership = $this->memberships->update($membership, $data, $request->user());

        return $this->ok($this->present($membership->load('user')), 'Member updated');
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
            'status' => $m->status,
            'account_status' => $m->user?->status,
            'joined_at' => BusinessTime::iso($m->created_at),
        ];
    }
}
