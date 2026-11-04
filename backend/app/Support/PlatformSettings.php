<?php

namespace App\Support;

use App\Models\ClinicApplication;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Platform-wide settings a system administrator changes in the portal. Anything never saved
 * keeps its default. Read on every request, so the values are cached briefly; a database that
 * is not migrated yet or cannot be reached falls back to the defaults, never to an error page.
 */
class PlatformSettings
{
    public const DEFAULT_NAME = 'BukidnonDental';

    private const CACHE_KEY = 'platform-settings';

    private const CACHE_SECONDS = 60;

    public const MIN_SESSION_MINUTES = 5;

    public const MAX_SESSION_MINUTES = 1440;

    public const MAX_GRACE_DAYS = 90;

    public static function defaults(): array
    {
        return [
            'platform_name' => self::DEFAULT_NAME,
            'support_email' => (string) config('mail.contact_address'),
            'maintenance_mode' => false,
            'allow_self_registration' => true,
            'session_timeout_minutes' => 30,
            'require_verification' => true,
            'required_documents' => ClinicApplication::REQUIRED_DOCUMENTS,
            'payment_grace_days' => 7,
        ];
    }

    public static function all(): array
    {
        try {
            $saved = Cache::remember(self::CACHE_KEY, self::CACHE_SECONDS, fn () => DB::table('platform_settings')->pluck('value', 'key')
                ->map(fn ($value) => json_decode((string) $value, true))
                ->all());
        } catch (Throwable) {
            $saved = [];
        }

        return [...self::defaults(), ...array_intersect_key($saved, self::defaults())];
    }

    public static function get(string $key): mixed
    {
        return self::all()[$key] ?? null;
    }

    /** @return array<string, mixed> the values that actually changed */
    public static function update(array $values): array
    {
        $current = self::all();
        $changed = [];

        foreach ($values as $key => $value) {
            if (! array_key_exists($key, $current) || $current[$key] === $value) {
                continue;
            }
            DB::table('platform_settings')->updateOrInsert(
                ['key' => $key],
                ['value' => json_encode($value), 'updated_at' => now(), 'created_at' => now()],
            );
            $changed[$key] = $value;
        }

        Cache::forget(self::CACHE_KEY);

        return $changed;
    }

    /** What the public apps may know. */
    public static function publicValues(): array
    {
        $settings = self::all();

        return [
            'platform_name' => $settings['platform_name'],
            'support_email' => $settings['support_email'],
            'maintenance_mode' => $settings['maintenance_mode'],
            'allow_self_registration' => $settings['allow_self_registration'],
        ];
    }
}
