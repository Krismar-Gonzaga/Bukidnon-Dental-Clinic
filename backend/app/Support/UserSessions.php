<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\PersonalAccessToken;

/**
 * Everywhere an account is signed in: web sessions (one browser each) and API tokens (one
 * phone each). Real session ids and tokens never leave the server: clients get an opaque id.
 */
class UserSessions
{
    private const WEB_PREFIX = 'web-';

    private const APP_PREFIX = 'app-';

    public static function list(User $user, Request $request): Collection
    {
        $current = self::currentId($user, $request);

        return self::webRows($user)
            ->map(fn ($row) => [
                'id' => self::webId($row->id),
                'type' => 'web',
                'device' => self::describeAgent($row->user_agent),
                'ip_address' => $row->ip_address,
                'last_active_at' => BusinessTime::iso(now()->setTimestamp((int) $row->last_activity)),
            ])
            ->concat(self::liveTokens($user)->map(fn (PersonalAccessToken $token) => [
                'id' => self::APP_PREFIX.$token->id,
                'type' => 'app',
                'device' => $token->name,
                'ip_address' => null,
                'last_active_at' => BusinessTime::iso($token->last_used_at ?? $token->created_at),
            ]))
            ->map(fn (array $session) => [...$session, 'current' => $session['id'] === $current])
            ->sortByDesc(fn (array $session) => [$session['current'], $session['last_active_at']])
            ->values();
    }

    /** False when there is no such session on this account. */
    public static function revoke(User $user, string $id): bool
    {
        if (str_starts_with($id, self::APP_PREFIX)) {
            return $user->tokens()->whereKey((int) substr($id, strlen(self::APP_PREFIX)))->delete() > 0;
        }

        $match = self::webRows($user)->first(fn ($row) => self::webId($row->id) === $id);

        return $match ? DB::table(config('session.table'))->where('id', $match->id)->delete() > 0 : false;
    }

    /** Sign out everywhere except this request's own session or token. */
    public static function revokeOthers(User $user, Request $request): void
    {
        $token = $user->currentAccessToken();
        $user->tokens()
            ->when($token instanceof PersonalAccessToken, fn ($q) => $q->whereKeyNot($token->getKey()))
            ->delete();

        if (self::tracksWebSessions()) {
            DB::table(config('session.table'))->where('user_id', $user->id)
                ->when($request->hasSession(), fn ($q) => $q->where('id', '!=', $request->session()->getId()))
                ->delete();
        }
    }

    /** After a password reset nothing signed in before it should survive. */
    public static function revokeAll(User $user): void
    {
        $user->tokens()->delete();

        if (self::tracksWebSessions()) {
            DB::table(config('session.table'))->where('user_id', $user->id)->delete();
        }
    }

    public static function currentId(User $user, Request $request): ?string
    {
        $token = $user->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            return self::APP_PREFIX.$token->getKey();
        }

        return $request->hasSession() ? self::webId($request->session()->getId()) : null;
    }

    /** "Chrome on Windows", from a browser's own description of itself. */
    public static function describeAgent(?string $agent): string
    {
        $agent = (string) $agent;
        $browser = match (true) {
            str_contains($agent, 'Edg/') => 'Edge',
            str_contains($agent, 'OPR/') => 'Opera',
            str_contains($agent, 'Chrome/') => 'Chrome',
            str_contains($agent, 'Firefox/') => 'Firefox',
            str_contains($agent, 'Safari/') => 'Safari',
            default => 'Browser',
        };
        $system = match (true) {
            str_contains($agent, 'Android') => 'Android',
            str_contains($agent, 'iPhone'), str_contains($agent, 'iPad') => 'iOS',
            str_contains($agent, 'Windows') => 'Windows',
            str_contains($agent, 'Mac OS') => 'macOS',
            str_contains($agent, 'Linux') => 'Linux',
            default => null,
        };

        return $system ? "{$browser} on {$system}" : $browser;
    }

    private static function tracksWebSessions(): bool
    {
        return config('session.driver') === 'database';
    }

    private static function webId(string $sessionId): string
    {
        return self::WEB_PREFIX.substr(hash('sha256', $sessionId), 0, 32);
    }

    private static function webRows(User $user): Collection
    {
        if (! self::tracksWebSessions()) {
            return collect();
        }

        return DB::table(config('session.table'))
            ->where('user_id', $user->id)
            ->where('last_activity', '>=', now()->subMinutes((int) config('session.lifetime'))->getTimestamp())
            ->get(['id', 'ip_address', 'user_agent', 'last_activity']);
    }

    private static function liveTokens(User $user): Collection
    {
        $minutes = config('sanctum.expiration');

        return $user->tokens()
            ->when($minutes, fn ($q) => $q->where('created_at', '>=', now()->subMinutes((int) $minutes)))
            ->get();
    }
}
