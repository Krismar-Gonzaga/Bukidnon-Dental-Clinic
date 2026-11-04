<?php

namespace Tests\Feature\Auth;

use App\Models\AuditLog;
use App\Models\User;
use App\Notifications\PortalNotice;
use App\Support\Totp;
use App\Support\UserSessions;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\Support\ClinicWorld;
use Tests\TestCase;

/** Two-factor sign-in and signed-in devices work the same for every kind of account. */
class AccountSecurityTest extends TestCase
{
    use ClinicWorld, RefreshDatabase;

    private const PASSWORD = 'Secret-Pass1!';

    protected function setUp(): void
    {
        parent::setUp();
        $this->withoutMiddleware(ThrottleRequests::class);
    }

    private function account(string $role = 'patient'): User
    {
        return User::factory()->role($role)->create(['password' => self::PASSWORD]);
    }

    private function currentCode(string $secret, int $offset = 0): string
    {
        return Totp::code($secret, (int) floor(time() / 30) + $offset);
    }

    private function enable(User $user): array
    {
        $secret = $this->asUser($user)->postJson('/api/two-factor/setup', ['password' => self::PASSWORD])->assertOk()->json('data.secret');
        $codes = $this->asUser($user)->postJson('/api/two-factor/confirm', ['code' => $this->currentCode($secret)])->assertOk()->json('data.recovery_codes');
        $this->flushHeaders();
        app('auth')->forgetGuards();

        return [$secret, $codes];
    }

    private function login(User $user, array $extra = [])
    {
        return $this->postJson('/api/login', ['email' => $user->email, 'password' => self::PASSWORD, ...$extra]);
    }

    public function test_every_role_can_turn_on_two_factor_and_is_then_asked_for_it(): void
    {
        $world = $this->makeClinic();
        $inventory = User::factory()->role('staff')->memberOf($world['clinic'], 'inventory_staff')->create(['password' => self::PASSWORD]);
        $accounts = [
            $this->account('patient'),
            $this->account('system_admin'),
            $inventory,
            User::factory()->role('dentist')->memberOf($world['clinic'], 'dentist')->create(['password' => self::PASSWORD]),
            User::factory()->role('staff')->memberOf($world['clinic'], 'staff')->create(['password' => self::PASSWORD]),
            User::factory()->role('clinic_admin')->memberOf($world['clinic'], 'clinic_admin')->create(['password' => self::PASSWORD]),
        ];

        foreach ($accounts as $user) {
            $this->enable($user);
            $this->login($user)->assertStatus(423)->assertJsonMissingPath('data.token');
        }
    }

    public function test_setup_offers_a_qr_code_and_status_never_shows_the_secret(): void
    {
        $user = $this->account();
        $setup = $this->asUser($user)->postJson('/api/two-factor/setup', ['password' => self::PASSWORD])->assertOk();
        $this->assertStringContainsString('<svg', $setup->json('data.qr_svg'));

        $status = $this->asUser($user)->getJson('/api/two-factor')->assertOk()->assertJsonPath('data.enabled', false);
        $this->assertStringNotContainsString($setup->json('data.secret'), $status->getContent());
    }

    public function test_an_app_code_cannot_be_used_twice(): void
    {
        $user = $this->account();
        [$secret] = $this->enable($user);
        $code = $this->currentCode($secret, 1);

        $this->login($user, ['two_factor_code' => $code])->assertOk();
        $this->login($user, ['two_factor_code' => $code])->assertUnprocessable()->assertJsonMissingPath('data.token');
        $this->login($user, ['two_factor_code' => $this->currentCode($secret)])->assertOk();
    }

    public function test_turning_it_off_needs_the_password_and_a_code(): void
    {
        $user = $this->account();
        [$secret, $recovery] = $this->enable($user);

        $this->asUser($user)->postJson('/api/two-factor/disable', ['password' => self::PASSWORD])->assertJsonValidationErrors('code');
        $this->asUser($user)->postJson('/api/two-factor/disable', ['password' => 'wrong', 'code' => $this->currentCode($secret)])->assertJsonValidationErrors('password');
        $this->asUser($user)->postJson('/api/two-factor/disable', ['password' => self::PASSWORD, 'code' => '000000'])->assertUnprocessable();
        $this->assertTrue($user->fresh()->two_factor_enabled);

        // A lost phone is what recovery codes are for.
        Notification::fake();
        $this->asUser($user)->postJson('/api/two-factor/disable', ['password' => self::PASSWORD, 'code' => $recovery[0]])->assertOk();
        $this->assertFalse($user->fresh()->two_factor_enabled);
        Notification::assertSentTo($user, PortalNotice::class);
    }

    public function test_new_recovery_codes_replace_the_old_ones(): void
    {
        $user = $this->account();
        [, $old] = $this->enable($user);

        $this->asUser($user)->postJson('/api/two-factor/recovery-codes', ['password' => 'wrong'])->assertJsonValidationErrors('password');
        $new = $this->asUser($user)->postJson('/api/two-factor/recovery-codes', ['password' => self::PASSWORD])->assertOk()->json('data.recovery_codes');
        $this->assertCount(8, $new);
        $this->asUser($user)->getJson('/api/two-factor')->assertJsonPath('data.recovery_codes_left', 8);

        $this->flushHeaders();
        app('auth')->forgetGuards();
        $this->login($user, ['two_factor_code' => $old[0]])->assertUnprocessable();
        $this->login($user, ['two_factor_code' => $new[0]])->assertOk();
    }

    public function test_turning_it_on_signs_out_other_devices(): void
    {
        $user = $this->account();
        $user->createToken('Old phone');
        $this->enable($user);

        // Only the token that turned it on is left.
        $this->assertSame(0, $user->tokens()->where('name', 'Old phone')->count());
    }

    public function test_sessions_list_marks_this_device_and_hides_real_ids(): void
    {
        $user = $this->account();
        $phone = $user->createToken('Pixel 8');
        $this_device = $user->createToken('This phone');

        $response = $this->withToken($this_device->plainTextToken)->getJson('/api/sessions')->assertOk()->assertJsonCount(2, 'data');
        $rows = collect($response->json('data'));
        $this->assertTrue($rows->firstWhere('device', 'This phone')['current']);
        $this->assertFalse($rows->firstWhere('device', 'Pixel 8')['current']);
        $this->assertStringNotContainsString($phone->plainTextToken, $response->getContent());
    }

    public function test_a_device_can_be_signed_out_but_not_the_current_one_or_anothers(): void
    {
        $user = $this->account();
        $other = $user->createToken('Pixel 8');
        $current = $user->createToken('This phone');
        $auth = fn () => $this->withToken($current->plainTextToken);

        $this->app['auth']->forgetGuards();
        $auth()->deleteJson('/api/sessions/app-'.$current->accessToken->getKey())->assertUnprocessable();

        $stranger = $this->account()->createToken('Theirs');
        $this->app['auth']->forgetGuards();
        $auth()->deleteJson('/api/sessions/app-'.$stranger->accessToken->getKey())->assertNotFound();
        $this->assertDatabaseHas('personal_access_tokens', ['id' => $stranger->accessToken->getKey()]);

        $this->app['auth']->forgetGuards();
        $auth()->deleteJson('/api/sessions/app-'.$other->accessToken->getKey())->assertOk();
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $other->accessToken->getKey()]);
        $this->assertTrue(AuditLog::where('action', 'auth.session_revoked')->exists());
    }

    public function test_sign_out_others_needs_the_password_and_keeps_this_device(): void
    {
        $user = $this->account();
        $user->createToken('One');
        $user->createToken('Two');
        $current = $user->createToken('This phone');

        $this->withToken($current->plainTextToken)->postJson('/api/sessions/sign-out-others', ['password' => 'wrong'])->assertJsonValidationErrors('password');
        $this->assertSame(3, $user->tokens()->count());

        $this->app['auth']->forgetGuards();
        $this->withToken($current->plainTextToken)->postJson('/api/sessions/sign-out-others', ['password' => self::PASSWORD])->assertOk();
        $this->assertSame(['This phone'], $user->tokens()->pluck('name')->all());
    }

    public function test_web_sessions_are_listed_ended_and_kept_apart_per_account(): void
    {
        config(['session.driver' => 'database']);
        $user = $this->account();
        $stranger = $this->account();
        $row = fn (User $owner, string $id) => DB::table('sessions')->insert([
            'id' => $id, 'user_id' => $owner->id, 'ip_address' => '10.0.0.1', 'payload' => '',
            'user_agent' => 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537', 'last_activity' => now()->getTimestamp(),
        ]);
        $row($user, 'real-session-id');
        $row($stranger, 'strangers-session');
        DB::table('sessions')->insert(['id' => 'expired', 'user_id' => $user->id, 'payload' => '', 'last_activity' => now()->subDays(2)->getTimestamp()]);
        $auth = fn () => $this->asUser($user);

        $response = $auth()->getJson('/api/sessions')->assertOk();
        $this->assertStringNotContainsString('real-session-id', $response->getContent());
        $web = collect($response->json('data'))->firstWhere('type', 'web');
        $this->assertSame('Chrome on Windows', $web['device']);
        $this->assertCount(1, collect($response->json('data'))->where('type', 'web'));

        $auth()->deleteJson('/api/sessions/'.$web['id'])->assertOk();
        $this->assertDatabaseMissing('sessions', ['id' => 'real-session-id']);
        $this->assertDatabaseHas('sessions', ['id' => 'strangers-session']);
    }

    public function test_changing_the_password_ends_other_web_sessions_and_tokens(): void
    {
        config(['session.driver' => 'database']);
        $user = $this->account();
        DB::table('sessions')->insert(['id' => 'other-browser', 'user_id' => $user->id, 'payload' => '', 'last_activity' => now()->getTimestamp()]);
        $user->createToken('Other phone');
        $current = $user->createToken('This phone');

        $this->withToken($current->plainTextToken)->postJson('/api/change-password', [
            'current_password' => self::PASSWORD, 'new_password' => 'Another-Pass2@', 'new_password_confirmation' => 'Another-Pass2@',
        ])->assertOk();

        $this->assertDatabaseMissing('sessions', ['id' => 'other-browser']);
        $this->assertSame(['This phone'], $user->tokens()->pluck('name')->all());
    }

    public function test_a_password_reset_ends_everything(): void
    {
        config(['session.driver' => 'database']);
        $user = $this->account();
        DB::table('sessions')->insert(['id' => 'a-browser', 'user_id' => $user->id, 'payload' => '', 'last_activity' => now()->getTimestamp()]);
        $user->createToken('A phone');

        $this->postJson('/api/reset-password', [
            'email' => $user->email, 'token' => Password::createToken($user),
            'password' => 'Another-Pass2@', 'password_confirmation' => 'Another-Pass2@',
        ])->assertOk();

        $this->assertDatabaseMissing('sessions', ['id' => 'a-browser']);
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_the_device_label_is_only_ever_plain_text(): void
    {
        $user = $this->account();
        $this->login($user, ['device_name' => '<b>Pixel</b> 8'])->assertOk();
        $this->assertSame('Pixel 8', $user->tokens()->first()->name);

        $this->assertSame('Safari on iOS', UserSessions::describeAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17) Version/17 Safari/604'));
        $this->assertSame('Browser', UserSessions::describeAgent(null));
    }
}
