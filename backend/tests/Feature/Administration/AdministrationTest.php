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

        $this->asConfirmedAdmin($sysadmin)->putJson("/api/admin/users/{$patient->id}", ['status' => 'suspended'])->assertStatus(422); // reason
        $this->asConfirmedAdmin($sysadmin)->putJson("/api/admin/users/{$patient->id}", ['status' => 'suspended', 'reason' => 'Abuse'])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->getJson('/api/user')->assertUnauthorized();
        $this->asConfirmedAdmin($sysadmin)->putJson("/api/admin/users/{$sysadmin->id}", ['role' => 'patient'])->assertStatus(409);
    }

    public function test_suspended_clinic_disappears_from_directory_and_can_be_reactivated(): void
    {
        $world = $this->makeClinic();
        $sysadmin = User::factory()->role('system_admin')->create();

        $this->asConfirmedAdmin($sysadmin)->postJson("/api/admin/clinics/{$world['clinic']->id}/suspend", ['reason' => 'Expired permit'])->assertOk();
        $this->getJson("/api/clinics/{$world['clinic']->id}")->assertNotFound();

        $this->asConfirmedAdmin($sysadmin)->postJson("/api/admin/clinics/{$world['clinic']->id}/reactivate")->assertOk();
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
        $this->assertSame(
            ['clinics', 'applications', 'queue', 'users', 'open_review_reports', 'security', 'activity_by_day', 'recent_activity', 'total_appointments', 'active_subscriptions', 'active_announcements', 'pending_payments', 'platform_growth', 'recent_audit'],
            array_keys($data),
        );
        $this->assertCount(14, $data['activity_by_day']);
        $this->assertSame(['failed_logins_24h', 'blocked_logins_24h', 'failed_password_confirmations_24h', 'suspended_users'], array_keys($data['security']));
    }

    public function test_dashboard_counts_failed_sign_ins_and_names_the_activity(): void
    {
        $sysadmin = User::factory()->role('system_admin')->create();
        $world = $this->makeClinic();
        $this->postJson('/api/login', ['email' => $sysadmin->email, 'password' => 'wrong-password'])->assertUnauthorized();
        $this->asConfirmedAdmin($sysadmin)->postJson("/api/admin/clinics/{$world['clinic']->id}/suspend", ['reason' => 'Expired permit'])->assertOk();

        $data = $this->asUser($sysadmin)->getJson('/api/admin/dashboard')->assertOk()->json('data');
        $this->assertSame(1, $data['security']['failed_logins_24h']);
        $this->assertSame(['pending' => 0, 'under_review' => 0, 'approved' => 0, 'rejected' => 0], $data['applications']);
        $this->assertSame(1, $data['clinics']['suspended']);
        // Today's bar (Philippine date) holds today's audited events; older days are empty.
        $this->assertSame('2026-11-02', end($data['activity_by_day'])['date']);
        $this->assertGreaterThanOrEqual(2, end($data['activity_by_day'])['total']);
        $this->assertSame(0, $data['activity_by_day'][0]['total']);
        $this->assertSame('clinic.suspended', $data['recent_activity'][0]['action']);
        $this->assertSame($world['clinic']->name, $data['recent_activity'][0]['subject_label']);
        $this->assertSame($sysadmin->name, $data['recent_activity'][0]['actor']);
    }

    public function test_high_impact_actions_need_the_password_re_entered(): void
    {
        $sysadmin = User::factory()->role('system_admin')->create(['password' => 'Correct-Horse-42']);
        $world = $this->makeClinic();
        $url = "/api/admin/clinics/{$world['clinic']->id}/suspend";

        // A fresh sign-in (token) has not confirmed its password yet.
        $token = $sysadmin->createToken('phone')->plainTextToken;
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson($url, ['reason' => 'Expired permit'])
            ->assertStatus(423)->assertJsonPath('code', 'password_confirmation_required');

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson('/api/admin/confirm-password', ['password' => 'wrong'])->assertStatus(422);
        $this->assertDatabaseHas('audit_logs', ['action' => 'admin.password_confirm_failed', 'user_id' => $sysadmin->id]);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson('/api/admin/confirm-password', ['password' => 'Correct-Horse-42'])->assertOk();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson($url, ['reason' => 'Expired permit'])->assertOk();

        // The confirmation belongs to that sign-in only, and expires.
        $this->asUser($sysadmin)->postJson("/api/admin/clinics/{$world['clinic']->id}/reactivate")->assertStatus(423);
        $this->travel(16)->minutes();
        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson("/api/admin/clinics/{$world['clinic']->id}/reactivate")->assertStatus(423);
    }

    public function test_system_health_reports_checks_without_secrets(): void
    {
        $sysadmin = User::factory()->role('system_admin')->create();
        $world = $this->makeClinic();
        $this->asUser($world['admin'])->getJson('/api/admin/system/health')->assertForbidden();

        $data = $this->asUser($sysadmin)->getJson('/api/admin/system/health')->assertOk()->json('data');
        $this->assertContains($data['status'], ['healthy', 'degraded', 'down']);
        $keys = array_column($data['checks'], 'key');
        foreach (['database', 'cache', 'storage', 'queue', 'debug', 'https', 'session_cookie', 'mail'] as $key) {
            $this->assertContains($key, $keys);
        }
        $this->assertSame('ok', collect($data['checks'])->firstWhere('key', 'database')['status']);

        $body = json_encode($data);
        foreach ([config('database.connections.'.config('database.default').'.password'), config('app.key')] as $secret) {
            if ($secret) {
                $this->assertStringNotContainsString($secret, $body);
            }
        }
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
