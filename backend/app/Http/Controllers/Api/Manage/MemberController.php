<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\ClinicMembership;
use App\Services\MembershipService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Clinic staff management (clinic.staff.manage). */
class MemberController extends Controller
{
    public function __construct(private readonly MembershipService $memberships)
    {
    }

    public function index(Clinic $clinic)
    {
        return $this->ok($clinic->memberships()->with('user:id,name,email,status')->orderBy('role')->get()
            ->map(fn (ClinicMembership $m) => $this->present($m)));
    }

    public function store(Request $request, Clinic $clinic)
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'role' => ['required', Rule::in(ClinicMembership::roles())],
        ]);

        $membership = $this->memberships->invite($clinic, $data['email'], $data['name'], $data['role'], $request->user());

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
            'role' => $m->role,
            'status' => $m->status,
            'account_status' => $m->user?->status,
        ];
    }
}
