<?php

namespace Tests\Feature\Administration;

use App\Models\ClinicMembership;
use App\Models\User;
use App\Notifications\AppointmentReminder;
use App\Notifications\ClinicMembershipInvitation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Support\ClinicWorld;
use Tests\TestCase;

class AdministrationTest extends TestCase
{
    use ClinicWorld, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->freezeClock();
    }

    public function test_patients_and_clinic_staff_cannot_use_admin_endpoints(): void
    {
        $world = $this->makeClinic();

        foreach ([$this->makePatient(), $world['admin'], $world['staff']] as $user) {
            $this->asUser($user)->getJson('/api/admin/users')->assertForbidden();
            $this->asUser($user)->getJson('/api/admin/audit-logs')->assertForbidden();
            $this->asUser($user)->postJson("/api/admin/clinics/{$world['clinic']->id}/suspend", ['reason' => 'x'])->assertForbidden();
        }
    }

    public function test_suspending_a_user_revokes_access_immediately(): void
    {
        $sysadmin = User::factory()->role('system_admin')->create();
        $patient = $this->makePatient();
        $token = $patient->createToken('phone')->plainTextToken;

        $this->asUser($sysadmin)->putJson("/api/admin/users/{$patient->id}", ['status' => 'suspended'])->assertStatus(422); // reason
        $this->asUser($sysadmin)->putJson("/api/admin/users/{$patient->id}", ['status' => 'suspended', 'reason' => 'Abuse'])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/user')->assertUnauthorized();
        $this->asUser($sysadmin)->putJson("/api/admin/users/{$sysadmin->id}", ['role' => 'patient'])->assertStatus(409);
    }

    public function test_suspended_clinic_disappears_from_directory_and_can_be_reactivated(): void
    {
        $world = $this->makeClinic();
        $sysadmin = User::factory()->role('system_admin')->create();

        $this->asUser($sysadmin)->postJson("/api/admin/clinics/{$world['clinic']->id}/suspend", ['reason' => 'Expired permit'])->assertOk();
        $this->getJson("/api/clinics/{$world['clinic']->id}")->assertNotFound();

        $this->asUser($sysadmin)->postJson("/api/admin/clinics/{$world['clinic']->id}/reactivate")->assertOk();
        $this->getJson("/api/clinics/{$world['clinic']->id}")->assertOk();

        $actions = $this->asUser($sysadmin)->getJson('/api/admin/audit-logs?action=clinic.')->assertOk()->json('data.*.action');
        $this->assertContains('clinic.suspended', $actions);
        $this->assertContains('clinic.reactivated', $actions);
    }

    public function test_admin_dashboard_has_no_patient_level_data(): void
    {
        $sysadmin = User::factory()->role('system_admin')->create();
        $this->makeClinic();

        $data = $this->asUser($sysadmin)->getJson('/api/admin/dashboard')->assertOk()->json('data');
        $this->assertSame(['clinics', 'applications', 'users', 'open_review_reports', 'recent_activity'], array_keys($data));
    }

    public function test_inviting_a_new_person_creates_an_account_with_password_setup(): void
    {
        Notification::fake();
        $world = $this->makeClinic();

        $this->asUser($world['admin'])->postJson($this->manage($world, '/members'), [
            'email' => 'New.Receptionist@example.com', 'name' => 'Rosa Lim', 'role' => 'staff',
        ])->assertCreated()->assertJsonPath('data.status', 'active');

        $user = User::firstWhere('email', 'new.receptionist@example.com');
        $this->assertTrue($user->hasClinicPermission($world['clinic'], 'appointments.manage'));
        Notification::assertSentTo($user, ClinicMembershipInvitation::class, fn ($n) => str_contains((string) $n->passwordSetupUrl, '/reset-password?token='));
    }

    public function test_existing_account_must_accept_the_invitation(): void
    {
        $world = $this->makeClinic();
        $existing = $this->makePatient();

        $membershipId = $this->asUser($world['admin'])->postJson($this->manage($world, '/members'), [
            'email' => $existing->email, 'name' => $existing->name, 'role' => 'inventory_staff',
        ])->assertCreated()->assertJsonPath('data.status', 'invited')->json('data.id');

        $this->assertFalse($existing->hasClinicPermission($world['clinic'], 'inventory.view'));
        $this->asUser($existing)->postJson("/api/my/invitations/{$membershipId}/accept")->assertOk();
        $this->assertTrue($existing->fresh()->hasClinicPermission($world['clinic'], 'inventory.view'));
    }

    public function test_staff_management_rules(): void
    {
        $world = $this->makeClinic();
        $adminMembership = ClinicMembership::where('user_id', $world['admin']->id)->first();

        $this->asUser($world['staff'])->getJson($this->manage($world, '/members'))->assertForbidden();
        $this->asUser($world['admin'])->putJson($this->manage($world, "/members/{$adminMembership->id}"), ['role' => 'staff'])->assertStatus(409);
    }

    public function test_reminders_are_sent_once_for_confirmed_appointments(): void
    {
        Notification::fake();
        $world = $this->makeClinic();
        $patient = $this->makePatient();
        // Exactly 24 hours ahead of the frozen clock: inside the reminder window.
        $id = $this->book($patient, $world, '2026-11-03 08:00')->assertCreated()->json('data.id');
        $this->asUser($world['staff'])->postJson($this->manage($world, "/appointments/{$id}/confirm"))->assertOk();

        $this->artisan('appointments:send-reminders')->assertSuccessful();
        $this->artisan('appointments:send-reminders')->assertSuccessful();

        Notification::assertSentToTimes($patient, AppointmentReminder::class, 1);
    }
}
