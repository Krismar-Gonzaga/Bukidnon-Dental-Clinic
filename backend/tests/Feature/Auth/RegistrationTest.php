<?php

namespace Tests\Feature\Auth;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Juan Dela Cruz',
            'email' => 'Juan@Example.com',
            'password' => 'secret-pass-1',
            'password_confirmation' => 'secret-pass-1',
            'phone' => '09171234567',
            'address' => 'Sayre Highway, Malaybalay City',
        ], $overrides);
    }

    public function test_patient_registration_creates_profile_and_token(): void
    {
        $response = $this->postJson('/api/register', $this->payload());

        $response->assertCreated()
            ->assertJsonPath('success', true)
            ->assertJsonPath('data.role', 'patient')
            ->assertJsonPath('data.user.email', 'juan@example.com')
            ->assertJsonPath('data.user.patient.phone', '09171234567')
            ->assertJsonPath('data.user.memberships', [])
            ->assertJsonStructure(['data' => ['token']]);

        $user = User::firstWhere('email', 'juan@example.com');
        $this->assertSame('patient', $user->role);
        $this->assertNotSame('secret-pass-1', $user->password);
        $this->assertTrue(AuditLog::where('action', 'auth.registered')->where('user_id', $user->id)->exists());
    }

    public function test_clinic_admin_can_self_register_without_patient_profile(): void
    {
        $this->postJson('/api/register', $this->payload(['role' => 'clinic_admin']))
            ->assertCreated()
            ->assertJsonPath('data.role', 'clinic_admin');

        $this->assertNull(User::firstWhere('email', 'juan@example.com')->patient);
    }

    public function test_privileged_roles_cannot_be_self_assigned(): void
    {
        foreach (['system_admin', 'dentist', 'staff'] as $role) {
            $this->postJson('/api/register', $this->payload(['role' => $role, 'email' => "{$role}@example.com"]))
                ->assertStatus(422)
                ->assertJsonPath('success', false)
                ->assertJsonValidationErrors('role');
        }

        $this->assertSame(0, User::count());
    }

    public function test_status_cannot_be_mass_assigned_on_registration(): void
    {
        $this->postJson('/api/register', $this->payload(['status' => 'suspended']))->assertCreated();

        $this->assertTrue(User::firstWhere('email', 'juan@example.com')->fresh()->isActive());
    }

    public function test_validation_errors_use_the_standard_envelope(): void
    {
        $this->postJson('/api/register', $this->payload(['address' => '', 'password_confirmation' => 'nope']))
            ->assertStatus(422)
            ->assertJsonPath('success', false)
            ->assertJsonStructure(['message', 'errors' => ['address', 'password']]);
    }

    public function test_duplicate_email_is_rejected_case_insensitively(): void
    {
        User::factory()->create(['email' => 'juan@example.com']);

        $this->postJson('/api/register', $this->payload(['email' => 'JUAN@example.com']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }
}
