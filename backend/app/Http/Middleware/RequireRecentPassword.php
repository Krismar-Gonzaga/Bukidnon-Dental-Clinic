<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * High-impact administration (approving clinics, suspensions, account role
 * changes, review moderation) needs the administrator's password again
 * within the last few minutes. The confirmation belongs to one sign-in: the
 * web session or the mobile app's token, so a stolen session on another
 * device does not inherit it.
 */
class RequireRecentPassword
{
    public const TTL_MINUTES = 15;

    public const CODE = 'password_confirmation_required';

    /** Cache key for this sign-in, or null when the request has none (never confirmed). */
    public static function key(Request $request): ?string
    {
        $user = $request->user();
        if (! $user) {
            return null;
        }

        $token = $user->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            return "admin-password-confirmed:{$user->id}:token:{$token->getKey()}";
        }
        if ($request->hasSession() && $request->session()->getId()) {
            return "admin-password-confirmed:{$user->id}:session:".hash('sha256', $request->session()->getId());
        }

        return null;
    }

    public function handle(Request $request, Closure $next): Response
    {
        $key = self::key($request);

        if (! $key || ! Cache::has($key)) {
            return response()->json([
                'success' => false,
                'message' => 'Confirm your password to continue.',
                'code' => self::CODE,
            ], 423);
        }

        return $next($request);
    }
}
