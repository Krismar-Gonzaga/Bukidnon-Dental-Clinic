<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\BusinessTime;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    private const ROLES = ['patient', 'clinic_admin', 'dentist', 'staff', 'system_admin'];

    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function index(Request $request)
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'role' => ['nullable', Rule::in(self::ROLES)],
            'status' => ['nullable', 'in:active,suspended'],
        ]);

        $page = User::query()
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = '%'.mb_strtolower($request->search).'%';
                $q->where(fn ($q) => $q->whereRaw('LOWER(name) LIKE ?', [$term])->orWhereRaw('LOWER(email) LIKE ?', [$term]));
            })
            ->when($request->filled('role'), fn ($q) => $q->where('role', $request->role))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->withCount(['clinicMemberships' => fn ($q) => $q->active()])
            ->orderBy('name')
            ->paginate($this->perPage($request, 25));

        return $this->paginated($page, fn (User $u) => $this->present($u));
    }

    /**
     * Change account type or suspend/reactivate. Suspension signs the user
     * out everywhere. Administrators cannot change their own account here.
     */
    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'role' => ['sometimes', Rule::in(self::ROLES)],
            'status' => ['sometimes', 'in:active,suspended'],
            'reason' => ['required_if:status,suspended', 'nullable', 'string', 'max:500'],
        ]);

        if ($user->is($request->user())) {
            return $this->fail('You cannot change your own role or status.', 409);
        }

        if (isset($data['role'])) {
            $user->role = $data['role'];
        }

        if (isset($data['status'])) {
            $user->status = $data['status'];
            $user->suspended_at = $data['status'] === User::STATUS_SUSPENDED ? now() : null;
            if ($data['status'] === User::STATUS_SUSPENDED) {
                $user->tokens()->delete();
            }
        }

        $user->save();
        $this->audit->record('admin.user_updated', $user, array_filter([
            'role' => $data['role'] ?? null,
            'status' => $data['status'] ?? null,
            'reason' => $data['reason'] ?? null,
        ]));

        return $this->ok($this->present($user->loadCount(['clinicMemberships' => fn ($q) => $q->active()])), 'User updated');
    }

    private function present(User $u): array
    {
        return [
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'role' => $u->role,
            'status' => $u->status,
            'clinic_memberships' => $u->clinic_memberships_count,
            'created_at' => BusinessTime::iso($u->created_at),
            'suspended_at' => BusinessTime::iso($u->suspended_at),
        ];
    }
}
