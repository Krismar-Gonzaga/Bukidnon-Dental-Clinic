<?php

namespace App\Providers;

use App\Models\User;
use App\Support\PlatformSettings;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Laravel\Sanctum\PersonalAccessToken;
use Laravel\Sanctum\Sanctum;

class AppServiceProvider extends ServiceProvider
{
    /** Limiter name => requests per minute, for the system admin routes. */
    private const ADMIN_LIMITS = [
        'admin-confirm' => 5,
        'admin-actions' => 30,
        'admin-exports' => 5,
        'admin-reports' => 10,
        'admin-health' => 20,
        'admin-integrity' => 6,
    ];

    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiting();
        $this->enforceSessionTimeoutOnAppTokens();

        // Password reset emails link to the web app's reset page, which then
        // calls POST /api/reset-password with the token.
        ResetPassword::createUrlUsing(function (User $user, string $token) {
            return rtrim(config('app.frontend_url'), '/')
                .'/reset-password?token='.urlencode($token)
                .'&email='.urlencode($user->email);
        });
    }

    /**
     * The Session Timeout setting for phones. Clinic staff and administrators are signed out
     * after the same idle time as on the web. Patients keep their long-lived sign-in: it holds
     * their offline copy and no one else's data.
     */
    private function enforceSessionTimeoutOnAppTokens(): void
    {
        Sanctum::authenticateAccessTokensUsing(function (PersonalAccessToken $token, bool $isValid) {
            if (! $isValid || $token->tokenable?->role === 'patient') {
                return $isValid;
            }

            $idleLimit = now()->subMinutes((int) PlatformSettings::get('session_timeout_minutes'));

            return ($token->last_used_at ?? $token->created_at)->greaterThanOrEqualTo($idleLimit);
        });
    }

    private function configureRateLimiting(): void
    {
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(120)
            ->by($request->user()?->id ?: $request->ip()));

        // Per account+IP to slow password guessing, plus a per-IP cap to slow
        // attempts spread across many accounts.
        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(5)->by(strtolower((string) $request->input('email')).'|'.$request->ip()),
            Limit::perMinute(20)->by($request->ip()),
        ]);

        // Each with its own counter: plain throttle:N,1 limits of one user share a single key,
        // so a few quick approvals would otherwise refuse the password check.
        foreach (self::ADMIN_LIMITS as $name => $perMinute) {
            RateLimiter::for($name, fn (Request $request) => Limit::perMinute($perMinute)->by($request->user()?->id ?: $request->ip()));
        }

        RateLimiter::for('register', fn (Request $request) => Limit::perMinute(5)->by($request->ip()));

        RateLimiter::for('password-reset', fn (Request $request) => [
            Limit::perMinute(3)->by(strtolower((string) $request->input('email')).'|'.$request->ip()),
            Limit::perMinute(10)->by($request->ip()),
        ]);
    }
}
