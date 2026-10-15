<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Http\Requests\Auth\UpdateProfileRequest;
use App\Models\Patient;
use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;

class AuthController extends Controller
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        $role = $request->input('role', 'patient');

        $user = DB::transaction(function () use ($request, $role) {
            $user = new User($request->only('name', 'email', 'password'));
            $user->role = $role;
            $user->save();

            // Only patients get a patient profile; clinic admins set up their
            // clinic through the clinic application workflow.
            if ($role === 'patient') {
                $patient = new Patient($request->only('phone', 'address', 'birth_date', 'gender'));
                $patient->user_id = $user->id;
                $patient->save();
                $user->load('patient');
            }

            return $user;
        });

        $this->audit->record('auth.registered', $user, ['role' => $role], actor: $user);

        return $this->ok($this->authPayload($user), 'Registration successful', 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::whereRaw('LOWER(email) = ?', [$request->email])->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            $this->audit->record('auth.login_failed', $user, ['email' => $request->email]);

            return $this->fail('Invalid login credentials', 401);
        }

        if (! $user->isActive()) {
            $this->audit->record('auth.login_blocked', $user, actor: $user);

            return $this->fail('This account is suspended.', 403);
        }

        $this->audit->record('auth.login', $user, actor: $user);

        return $this->ok($this->authPayload($user));
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        $this->audit->record('auth.logout', $request->user());

        return $this->ok(message: 'Logged out successfully');
    }

    /** The signed-in user, their patient profile, and their clinic memberships. */
    public function user(Request $request): JsonResponse
    {
        $user = $request->user()->load('patient');

        return $this->ok($this->userData($user));
    }

    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();

        DB::transaction(function () use ($request, $user) {
            $user->update($request->only('name', 'email'));
            $user->patient?->update($request->only('phone', 'address'));
        });

        return $this->ok($user->load('patient'), 'Profile updated successfully');
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->update(['password' => $request->new_password]);

        // Sign out every other device; keep the session that made the change.
        $user->tokens()->whereKeyNot($user->currentAccessToken()->getKey())->delete();
        $this->audit->record('auth.password_changed', $user);

        return $this->ok(message: 'Password changed successfully');
    }

    /**
     * Always answers the same way, so the endpoint cannot be used to find
     * out which emails have accounts.
     */
    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        $user = User::whereRaw('LOWER(email) = ?', [$request->email])->first();

        if ($user && $user->isActive()) {
            Password::sendResetLink(['email' => $user->email]);
            $this->audit->record('auth.password_reset_requested', $user, actor: $user);
        }

        return $this->ok(message: 'If an account exists for that email, a password reset link has been sent.');
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $user = User::whereRaw('LOWER(email) = ?', [$request->email])->first();

        $status = Password::reset(
            [
                'email' => $user?->email ?? $request->email,
                'password' => $request->password,
                'password_confirmation' => $request->password_confirmation,
                'token' => $request->token,
            ],
            function (User $user, string $password) {
                $user->update(['password' => $password]);
                $user->tokens()->delete();
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return $this->fail('This password reset link is invalid or has expired.', 422, [
                'email' => ['This password reset link is invalid or has expired.'],
            ]);
        }

        $this->audit->record('auth.password_reset', $user, actor: $user);

        return $this->ok(message: 'Password has been reset. You can now sign in.');
    }

    private function authPayload(User $user): array
    {
        return [
            'user' => $this->userData($user),
            'token' => $user->createToken('auth_token')->plainTextToken,
            'role' => $user->role,
        ];
    }

    private function userData(User $user): array
    {
        $memberships = $user->clinicMemberships()
            ->active()
            ->with('clinic:id,name')
            ->get()
            ->map(fn ($membership) => [
                'clinic_id' => $membership->clinic_id,
                'clinic_name' => $membership->clinic?->name,
                'role' => $membership->role,
                'permissions' => $membership->permissions(),
            ]);

        return $user->toArray() + ['memberships' => $memberships];
    }
}
