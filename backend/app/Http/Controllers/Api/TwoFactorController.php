<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Notifications\PortalNotice;
use App\Services\AuditLogger;
use App\Services\TwoFactorVerifier;
use App\Support\Totp;
use App\Support\UserSessions;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Two-factor sign-in with an authenticator app, for every role. Turning it on or off asks for
 * the password again, so an unlocked session alone cannot change it; turning it off also needs
 * a code. Other devices are signed out when it is switched on, so an intruder already signed
 * in does not stay in. The login check is in AuthController.
 */
class TwoFactorController extends Controller
{
    private const RECOVERY_CODES = 8;

    private const QR_SIZE = 220;

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly TwoFactorVerifier $verifier,
    ) {
    }

    public function status(Request $request)
    {
        $user = $request->user();

        return $this->ok([
            'enabled' => $user->two_factor_enabled,
            'confirmed_at' => $user->two_factor_confirmed_at?->toIso8601String(),
            'recovery_codes_left' => count($user->two_factor_recovery_codes ?? []),
        ]);
    }

    /** Start: a new secret for the app. Nothing is enforced until a code confirms it. */
    public function setup(Request $request)
    {
        $request->validate(['password' => ['required', 'current_password:sanctum']]);
        $user = $request->user();

        if ($user->two_factor_confirmed_at) {
            return $this->fail('Two-factor sign-in is already on.', 409);
        }

        $secret = Totp::generateSecret();
        $user->forceFill(['two_factor_secret' => $secret])->save();
        $url = Totp::uri($secret, $user->email, config('app.name'));

        return $this->ok([
            'secret' => $secret,
            'otpauth_url' => $url,
            'qr_svg' => $this->qrCode($url),
        ]);
    }

    /** Finish: the app's first code proves it is set up. The recovery codes are shown once. */
    public function confirm(Request $request)
    {
        $data = $request->validate(['code' => ['required', 'string']]);
        $user = $request->user();

        if (! $user->two_factor_secret || $user->two_factor_confirmed_at) {
            return $this->fail('Start two-factor setup first.', 409);
        }
        if (! Totp::verify($user->two_factor_secret, trim($data['code']))) {
            return $this->fail('That code is not correct. Please try again.', 422, ['code' => ['That code is not correct. Please try again.']]);
        }

        $codes = $this->newRecoveryCodes();
        $user->forceFill([
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => $codes,
        ])->save();

        UserSessions::revokeOthers($user, $request);
        $this->audit->record('auth.two_factor_enabled', $user);
        $user->notify(new PortalNotice('security', 'Two-factor sign-in turned on', 'Two-factor sign-in was turned on for your account. If this was not you, reset your password now.'));

        return $this->ok(['recovery_codes' => $codes], 'Two-factor sign-in is on');
    }

    public function disable(Request $request)
    {
        $data = $request->validate([
            'password' => ['required', 'current_password:sanctum'],
            'code' => ['required', 'string'],
        ]);
        $user = $request->user();

        if (! $user->two_factor_confirmed_at) {
            return $this->fail('Two-factor sign-in is already off.', 409);
        }
        if (! $this->verifier->passes($user, trim($data['code']))) {
            $this->audit->record('auth.two_factor_failed', $user);

            return $this->fail('That code is not correct.', 422, ['code' => ['That code is not correct.']]);
        }

        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();
        $this->audit->record('auth.two_factor_disabled', $user);
        $user->notify(new PortalNotice('security', 'Two-factor sign-in turned off', 'Two-factor sign-in was turned off for your account. If this was not you, reset your password now.'));

        return $this->ok(message: 'Two-factor sign-in is off');
    }

    /** New recovery codes replace the old ones, which stop working at once. */
    public function regenerateRecoveryCodes(Request $request)
    {
        $request->validate(['password' => ['required', 'current_password:sanctum']]);
        $user = $request->user();

        if (! $user->two_factor_confirmed_at) {
            return $this->fail('Two-factor sign-in is off.', 409);
        }

        $codes = $this->newRecoveryCodes();
        $user->forceFill(['two_factor_recovery_codes' => $codes])->save();
        $this->audit->record('auth.two_factor_codes_regenerated', $user);

        return $this->ok(['recovery_codes' => $codes], 'New recovery codes created');
    }

    private function newRecoveryCodes(): array
    {
        return collect(range(1, self::RECOVERY_CODES))->map(fn () => Str::lower(Str::random(10)))->all();
    }

    /** Scanned from another screen; the secret and link are there for typing it in instead. */
    private function qrCode(string $url): ?string
    {
        if (! class_exists(Writer::class)) {
            return null;
        }

        return (new Writer(new ImageRenderer(new RendererStyle(self::QR_SIZE), new SvgImageBackEnd)))->writeString($url);
    }
}
