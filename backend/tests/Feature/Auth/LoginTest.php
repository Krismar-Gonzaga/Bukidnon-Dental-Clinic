<?php

namespace Tests\Feature\Auth;

use App\Models\AuditLog;
use App\Models\Clinic;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_returns_token_role_and_memberships(): void
    {
        $clinic = Clinic::factory()->create(['name' => 'Valencia Smiles']);
        User::factory()->role('dentist')->memberOf($clinic, 'dentist')
            ->create(['email' => 'doc@example.com']);

        $this->postJson('/api/login', ['email' => 'DOC@example.com', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('data.role', 'dentist')
            ->assertJsonPath('data.user.memberships.0.clinic_name', 'Valencia Smiles')
            ->assertJsonPath('data.user.memberships.0.role', 'dentist')
            ->assertJsonStructure(['data' => ['token', 'user' => ['memberships' => [['permissions']]]]]);

        $this->assertTrue(AuditLog::where('action', 'auth.login')->exists());
    }

    public function test_login_matches_mixed_case_stored_email(): void
    {
        User::factory()->create(['email' => 'Maria.Santos@Example.com']);

        $this->postJson('/api/login', ['email' => 'maria.santos@example.com', 'password' => 'password'])
            ->assertOk();
    }

    public function test_wrong_password_is_rejected_and_audited_without_the_password(): void
    {
        User::factory()->create(['email' => 'juan@example.com']);

        $this->postJson('/api/login', ['email' => 'juan@example.com', 'password' => 'wrong-guess'])
            ->assertUnauthorized()
            ->assertJson(['success' => false, 'message' => 'Invalid login credentials']);

        $entry = AuditLog::firstWhere('action', 'auth.login_failed');
        $this->assertNotNull($entry);
        $this->assertStringNotContainsString('wrong-guess', json_encode($entry->metadata));
    }

    public function test_suspended_account_cannot_log_in(): void
    {
        User::factory()->suspended()->create(['email' => 'juan@example.com']);

        $this->postJson('/api/login', ['email' => 'juan@example.com', 'password' => 'password'])
            ->assertForbidden()
            ->assertJsonPath('message', 'This account is suspended.');
    }

    public function test_suspended_account_token_is_rejected(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;
        $user->forceFill(['status' => User::STATUS_SUSPENDED])->save();

        $this->withToken($token)->getJson('/api/user')->assertForbidden();
    }

    public function test_login_is_rate_limited(): void
    {
        User::factory()->create(['email' => 'juan@example.com']);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/login', ['email' => 'juan@example.com', 'password' => 'wrong'])->assertUnauthorized();
        }

        $this->postJson('/api/login', ['email' => 'juan@example.com', 'password' => 'password'])
            ->assertStatus(429)
            ->assertJsonPath('success', false);
    }

    public function test_logout_revokes_the_token(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('t')->plainTextToken;

        $this->withToken($token)->postJson('/api/logout')->assertOk();

        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_unauthenticated_requests_get_json_401(): void
    {
        $this->getJson('/api/user')
            ->assertUnauthorized()
            ->assertExactJson(['success' => false, 'message' => 'Unauthenticated.']);
    }
}
