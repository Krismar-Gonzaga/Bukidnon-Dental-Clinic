<?php

namespace App\Services;

use App\Models\User;
use App\Support\Totp;
use Illuminate\Support\Facades\Cache;

/**
 * Checks a code from the authenticator app or a recovery code. An app code works once: a code
 * read over someone's shoulder or from a log cannot be used again while it is still valid.
 */
class TwoFactorVerifier
{
    // Longer than a code can stay valid (the current period and one either side).
    private const USED_CODE_MINUTES = 3;

    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function passes(User $user, string $code): bool
    {
        $counter = Totp::matchingCounter((string) $user->two_factor_secret, $code);
        if ($counter !== null) {
            return Cache::add("two-factor-used:{$user->id}:{$counter}", true, now()->addMinutes(self::USED_CODE_MINUTES));
        }

        $codes = $user->two_factor_recovery_codes ?? [];
        foreach ($codes as $index => $recovery) {
            if (hash_equals($recovery, strtolower($code))) {
                unset($codes[$index]);
                $user->forceFill(['two_factor_recovery_codes' => array_values($codes)])->save();
                $this->audit->record('auth.two_factor_recovery_used', $user, actor: $user);

                return true;
            }
        }

        return false;
    }
}
