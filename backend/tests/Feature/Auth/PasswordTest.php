<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordTest extends TestCase
{
    use RefreshDatabase;

    public function test_change_password_requires_the_current_password(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $this->withToken($token)->postJson('/api/change-password', [
            'current_password' => 'not-it',
            'new_password' => 'new-secret-1',
            'new_password_confirmation' => 'new-secret-1',
        ])->assertStatus(422)->assertJsonValidationErrors('current_password');

        $this->assertTrue(Hash::check('password', $user->fresh()->password));
    }

    public function test_change_password_signs_out_other_devices_only(): void
    {
        $user = User::factory()->create();
        $current = $user->createToken('this-device')->plainTextToken;
        $user->createToken('other-device');

        $this->withToken($current)->postJson('/api/change-password', [
            'current_password' => 'password',
            'new_password' => 'new-secret-1',
            'new_password_confirmation' => 'new-secret-1',
        ])->assertOk();

        $this->assertTrue(Hash::check('new-secret-1', $user->fresh()->password));
        $this->assertSame(['this-device'], $user->tokens()->pluck('name')->all());
    }

    public function test_forgot_password_sends_link_to_the_web_app(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'juan@example.com']);

        $this->postJson('/api/forgot-password', ['email' => 'juan@example.com'])->assertOk();

        Notification::assertSentTo($user, ResetPassword::class, function (ResetPassword $notification) use ($user) {
            $url = $notification->toMail($user)->actionUrl;

            return str_starts_with($url, config('app.frontend_url').'/reset-password?token=');
        });
    }

    public function test_forgot_password_does_not_reveal_unknown_emails(): void
    {
        Notification::fake();
        User::factory()->create(['email' => 'juan@example.com']);

        $known = $this->postJson('/api/forgot-password', ['email' => 'juan@example.com'])->json();
        $unknown = $this->postJson('/api/forgot-password', ['email' => 'nobody@example.com'])->json();

        $this->assertSame($known, $unknown);
    }

    public function test_reset_password_with_valid_token_revokes_all_tokens(): void
    {
        $user = User::factory()->create(['email' => 'juan@example.com']);
        $user->createToken('old-device');
        $token = Password::createToken($user);

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => 'juan@example.com',
            'password' => 'brand-new-1',
            'password_confirmation' => 'brand-new-1',
        ])->assertOk();

        $this->assertTrue(Hash::check('brand-new-1', $user->fresh()->password));
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_reset_password_rejects_an_invalid_token(): void
    {
        User::factory()->create(['email' => 'juan@example.com']);

        $this->postJson('/api/reset-password', [
            'token' => 'forged',
            'email' => 'juan@example.com',
            'password' => 'brand-new-1',
            'password_confirmation' => 'brand-new-1',
        ])->assertStatus(422)->assertJsonPath('success', false);
    }
}
