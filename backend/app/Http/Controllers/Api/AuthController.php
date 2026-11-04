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
use App\Notifications\PortalNotice;
use App\Services\AuditLogger;
use App\Services\TwoFactorVerifier;
use App\Support\UserSessions;
use App\Support\PlatformSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    public function __construct(
        private readonly AuditLogger $audit,
        private readonly TwoFactorVerifier $twoFactor,
    ) {
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        $role = $request->input('role', 'patient');

        // Clinic owners still register to apply; only patient sign-up can be closed.
        if ($role === 'patient' && ! PlatformSettings::get('allow_self_registration')) {
            return $this->fail('Patient registration is closed right now. Please ask your clinic for an invitation.', 403);
        }

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

        return $this->ok($this->authPayload($user, $request), 'Registration successful', 201);
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

        // The password was right: only now is it safe to say a code is needed.
        if ($user->two_factor_enabled) {
            $code = trim((string) $request->input('two_factor_code'));
            if ($code === '') {
                return $this->fail('Enter the code from your authenticator app.', 423);
            }
            if (! $this->twoFactor->passes($user, $code)) {
                $this->audit->record('auth.two_factor_failed', $user, actor: $user);

                return $this->fail('That code is not correct.', 422, ['two_factor_code' => ['That code is not correct.']]);
            }
        }

        $this->audit->record('auth.login', $user, actor: $user);

        return $this->ok($this->authPayload($user, $request));
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        $token = $user->currentAccessToken();

        if ($token instanceof PersonalAccessToken) {
            $token->delete();
        } else {
            // Web session: end it and rotate the CSRF token.
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        $this->audit->record('auth.logout', $user, actor: $user);

        return $this->ok(message: 'Logged out successfully');
    }

    /** The signed-in user, their patient profile, and their clinic memberships. */
    public function user(Request $request): JsonResponse
    {
        $user = $request->user()->load('patient');

        return $this->ok($this->userData($user));
    }

    /**
     * Who is signed in, for apps checking the session on start-up. Unlike
     * GET /user it answers 200 with data null for guests (and suspended
     * accounts), so a normal guest visit does not log a failed request.
     */
    public function session(): JsonResponse
    {
        $user = Auth::guard('sanctum')->user();

        if (! $user || ! $user->isActive()) {
            return $this->ok(null);
        }

        return $this->ok($this->userData($user->load('patient')));
    }

    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();

        DB::transaction(function () use ($request, $user) {
            $user->update($request->only('name', 'email'));
            // Patients keep their phone on the patient profile.
            if (! $user->patient && $request->has('phone')) {
                $user->forceFill(['phone' => $request->input('phone')])->save();
            }
            $user->patient?->update($request->only('phone', 'address'));
        });

        return $this->ok($user->load('patient'), 'Profile updated successfully');
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->update(['password' => $request->new_password]);

        // Sign out every other device; keep the session that made the change.
        UserSessions::revokeOthers($user, $request);
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }
        $this->audit->record('auth.password_changed', $user);
        $user->notify(new PortalNotice('security', 'Password changed', 'Your password was changed and other devices were signed out. If this was not you, reset your password now.'));

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
                UserSessions::revokeAll($user);
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

    /**
     * Web app (stateful request with a session): sign in with an HttpOnly
     * session cookie and return no token. Mobile and other API clients:
     * return a Sanctum token.
     */
    private function authPayload(User $user, Request $request): array
    {
        if ($request->hasSession()) {
            Auth::guard('web')->login($user);
            $request->session()->regenerate();

            return ['user' => $this->userData($user), 'role' => $user->role];
        }

        return [
            'user' => $this->userData($user),
            'token' => $user->createToken($this->deviceName($request))->plainTextToken,
            'role' => $user->role,
        ];
    }

    /** What the "signed-in devices" list calls this phone. Label only; not trusted for anything. */
    private function deviceName(Request $request): string
    {
        $named = trim(strip_tags((string) $request->input('device_name')));

        return mb_substr($named !== '' ? $named : UserSessions::describeAgent($request->userAgent()), 0, 100);
    }

    private function userData(User $user): array
    {
        $memberships = $user->clinicMemberships()
            ->active()
            ->with('clinic:id,name,settings')
            ->get()
            ->map(fn ($membership) => [
                'clinic_id' => $membership->clinic_id,
                'clinic_name' => $membership->clinic?->name,
                'role' => $membership->role,
                'position_label' => $membership->positionLabel(),
                'specialization' => $membership->role === 'dentist' ? $user->dentist?->specialization?->name : null,
                'permissions' => $membership->permissions(),
            ]);

        return $user->toArray() + ['memberships' => $memberships];
    }
}
