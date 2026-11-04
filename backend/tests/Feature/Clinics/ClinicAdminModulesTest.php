<?php

namespace Tests\Feature\Clinics;

use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\ClinicMembership;
use App\Models\Patient;
use App\Models\PatientFile;
use App\Models\Review;
use App\Models\Subscription;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Support\Totp;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Support\ClinicWorld;
use Tests\TestCase;

class ClinicAdminModulesTest extends TestCase
{
    use ClinicWorld, RefreshDatabase;

    private array $world;

    protected function setUp(): void
    {
        parent::setUp();
        $this->freezeClock();
        $this->world = $this->makeClinic();
    }

    private function staffMember(?string $position, ?array $custom = null): User
    {
        $user = User::factory()->create(['role' => 'staff']);
        $membership = new ClinicMembership(['status' => ClinicMembership::STATUS_ACTIVE]);
        $membership->clinic_id = $this->world['clinic']->id;
        $membership->user_id = $user->id;
        $membership->role = ClinicMembership::ROLE_STAFF;
        $membership->forceFill(['position' => $position, 'custom_permissions' => $custom])->save();

        return $user;
    }

    // ------------------------------------------------------------ Clinical records

    public function test_clinic_admin_reads_and_writes_records_and_every_read_is_logged(): void
    {
        $patient = $this->makePatient();
        $this->book($patient, $this->world)->assertCreated();
        $url = $this->manage($this->world, "/patients/{$patient->patient->id}/records");

        $this->asUser($this->world['admin'])->postJson($url, ['record_type' => 'treatment', 'procedures' => 'Scaling'])->assertCreated();
        $this->asUser($this->world['admin'])->getJson($url)->assertOk()->assertJsonPath('data.0.procedures', 'Scaling');

        $this->assertTrue(AuditLog::where('action', 'records.viewed')->where('clinic_id', $this->world['clinic']->id)->exists());
    }

    public function test_no_position_or_custom_list_can_ever_grant_clinical_records(): void
    {
        foreach (array_keys(config('permissions.staff_positions')) as $position) {
            $user = $this->staffMember($position);
            $this->assertFalse($user->hasClinicPermission($this->world['clinic'], 'records.view'));
        }
        foreach (config('permissions.staff_modules') as $permissions) {
            $this->assertEmpty(array_intersect($permissions, ['records.view', 'records.write', 'clinic.permissions.manage', 'clinic.audit.view']));
        }

        $stored = $this->staffMember(null, ['records.view', 'clinic.permissions.manage', 'patients.view']);
        $this->assertTrue($stored->hasClinicPermission($this->world['clinic'], 'patients.view'));
        $this->assertFalse($stored->hasClinicPermission($this->world['clinic'], 'records.view'));
        $this->assertFalse($stored->hasClinicPermission($this->world['clinic'], 'clinic.permissions.manage'));
    }

    // ------------------------------------------------------------ Permissions

    public function test_position_defaults_apply_and_the_permission_table_changes_them(): void
    {
        $receptionist = $this->staffMember('receptionist');
        $inventoryUrl = $this->manage($this->world, '/inventory/items');
        $this->asUser($receptionist)->getJson($inventoryUrl)->assertForbidden();

        $this->asUser($this->world['admin'])->putJson($this->manage($this->world, '/role-permissions'), [
            'positions' => ['receptionist' => ['appointments', 'inventory']],
        ])->assertOk();

        $this->asUser($receptionist->fresh())->getJson($inventoryUrl)->assertOk();
    }

    public function test_only_a_clinic_admin_can_change_the_permission_table(): void
    {
        $manager = $this->staffMember('office_manager');
        $this->asUser($this->world['admin'])->getJson($this->manage($this->world, '/role-permissions'))
            ->assertOk()
            ->assertJsonPath('data.modules.0', ['key' => 'appointments', 'label' => 'Appointments'])
            ->assertJsonPath('data.positions.0.key', 'office_manager');
        $this->asUser($manager)->getJson($this->manage($this->world, '/role-permissions'))->assertForbidden();
        $this->asUser($manager)->putJson($this->manage($this->world, '/role-permissions'), ['positions' => []])->assertForbidden();

        $this->asUser($this->world['admin'])->putJson($this->manage($this->world, '/role-permissions'), [
            'positions' => ['receptionist' => ['records']],
        ])->assertJsonValidationErrors('positions.receptionist.0');
    }

    public function test_a_staff_manager_cannot_escalate_or_touch_an_administrator(): void
    {
        $manager = $this->staffMember('office_manager');
        $members = $this->manage($this->world, '/members');

        $this->asUser($manager)->postJson($members, ['email' => 'new@example.com', 'name' => 'New', 'role' => 'clinic_admin'])->assertForbidden();
        $this->asUser($manager)->postJson($members, ['email' => 'new@example.com', 'name' => 'New', 'role' => 'staff', 'permissions' => ['reports.view']])->assertForbidden();

        $own = ClinicMembership::where('user_id', $manager->id)->first();
        $this->asUser($manager)->putJson("{$members}/{$own->id}", ['permissions' => ['clinic.staff.manage', 'reports.view']])->assertForbidden();
        $this->asUser($manager)->putJson("{$members}/{$own->id}", ['role' => 'clinic_admin'])->assertForbidden();

        $admin = ClinicMembership::where('user_id', $this->world['admin']->id)->first();
        $this->asUser($manager)->putJson("{$members}/{$admin->id}", ['status' => 'suspended'])->assertForbidden();
        $this->asUser($manager)->postJson("{$members}/{$admin->id}/reset-password")->assertForbidden();
    }

    public function test_add_staff_with_position_and_chosen_permissions(): void
    {
        $response = $this->asUser($this->world['admin'])->postJson($this->manage($this->world, '/members'), [
            'email' => 'sofia@example.com',
            'name' => 'Sofia Lim',
            'role' => 'staff',
            'phone' => '0917',
            'position' => 'receptionist',
            'permissions' => ['appointments.view_all', 'patients.view'],
        ])->assertCreated()->assertJsonPath('data.position', 'receptionist');

        $this->assertSame(['clinic.view', 'appointments.view_all', 'patients.view'], $response->json('data.permissions'));

        $this->asUser($this->world['admin'])->postJson($this->manage($this->world, '/members'), [
            'email' => 'x@example.com', 'name' => 'X', 'role' => 'staff', 'permissions' => ['records.view'],
        ])->assertJsonValidationErrors('permissions.0');
    }

    public function test_add_dentist_fills_profile_and_weekly_hours_and_invite_needs_no_name(): void
    {
        $this->asUser($this->world['admin'])->postJson($this->manage($this->world, '/members'), [
            'email' => 'maria.braganza@example.com',
            'role' => 'dentist',
            'years_experience' => 12,
            'qualifications' => 'UST College of Dentistry',
            'working_days' => [1, 2, 3],
            'starts_at' => '08:00',
            'ends_at' => '17:00',
        ])->assertCreated()->assertJsonPath('data.name', 'Maria Braganza');

        $dentist = \App\Models\Dentist::whereHas('user', fn ($q) => $q->where('email', 'maria.braganza@example.com'))->firstOrFail();
        $this->assertSame(12, $dentist->years_experience);
        $this->assertSame(3, $dentist->schedules()->count());

        $this->asUser($this->world['admin'])->getJson($this->manage($this->world, "/dentists/{$dentist->id}"))->assertOk()
            ->assertJsonPath('data.qualifications', 'UST College of Dentistry')
            ->assertJsonPath('data.appointments_total', 0);
    }

    public function test_dentist_profile_with_patient_names_is_for_those_who_manage_dentists(): void
    {
        $url = $this->manage($this->world, "/dentists/{$this->world['dentist']->id}");

        $this->asUser($this->world['admin'])->getJson($url)->assertOk();
        $this->asUser($this->staffMember('receptionist'))->getJson($url)->assertForbidden();
        $this->asUser($this->world['dentistUser'])->getJson($url)->assertForbidden();
    }

    public function test_staff_password_reset_never_reveals_a_password(): void
    {
        $user = $this->staffMember('receptionist');
        $membership = ClinicMembership::where('user_id', $user->id)->first();

        $this->asUser($this->world['admin'])->postJson($this->manage($this->world, "/members/{$membership->id}/reset-password"))
            ->assertOk()->assertJsonMissingPath('data.password');
        $this->assertTrue(AuditLog::where('action', 'membership.password_reset_sent')->exists());
    }

    // ------------------------------------------------------------ Settings

    public function test_settings_take_effect_on_patient_booking_and_cancelling(): void
    {
        $settings = $this->manage($this->world, '/settings');
        $patient = $this->makePatient();

        $this->asUser($this->world['admin'])->putJson($settings, ['allow_online_booking' => false])->assertOk();
        $this->book($patient, $this->world)->assertUnprocessable();

        $this->asUser($this->world['admin'])->putJson($settings, ['allow_online_booking' => true, 'require_approval' => false, 'allow_patient_cancel' => false])->assertOk();
        $id = $this->book($patient, $this->world)->assertCreated()->assertJsonPath('data.status', 'confirmed')->json('data.id');

        $this->asUser($patient)->postJson("/api/patient/appointments/{$id}/cancel")->assertStatus(409);
    }

    public function test_settings_reject_unknown_values_and_are_admin_only(): void
    {
        $settings = $this->manage($this->world, '/settings');
        $this->asUser($this->world['admin'])->putJson($settings, ['slot_minutes' => 7])->assertJsonValidationErrors('slot_minutes');
        $this->asUser($this->staffMember('receptionist'))->getJson($settings)->assertForbidden();
    }

    public function test_clinic_audit_log_shows_only_this_clinic_and_no_network_details(): void
    {
        $this->asUser($this->world['admin'])->putJson($this->manage($this->world, '/settings'), ['send_reminders' => false])->assertOk();
        $other = $this->makeClinic();
        $this->asUser($other['admin'])->putJson($this->manage($other, '/settings'), ['send_reminders' => false])->assertOk();

        $response = $this->asUser($this->world['admin'])->getJson($this->manage($this->world, '/audit-logs'))->assertOk()
            ->assertJsonPath('data.0.label', 'Updated clinic settings')
            ->assertJsonMissingPath('data.0.ip_address');
        $this->assertCount(1, $response->json('data'));

        $this->asUser($this->staffMember('office_manager'))->getJson($this->manage($this->world, '/audit-logs'))->assertForbidden();
    }

    // ------------------------------------------------------------ Two-factor

    public function test_two_factor_sign_in_is_enforced_once_confirmed(): void
    {
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        $user = User::factory()->create(['email' => 'two@example.com', 'password' => 'Secret-Pass1!']);
        $login = fn (array $extra = []) => $this->postJson('/api/login', ['email' => 'two@example.com', 'password' => 'Secret-Pass1!', ...$extra]);

        $this->asUser($user)->postJson('/api/two-factor/setup', ['password' => 'wrong'])->assertJsonValidationErrors('password');
        $secret = $this->asUser($user)->postJson('/api/two-factor/setup', ['password' => 'Secret-Pass1!'])->assertOk()->json('data.secret');

        // Not confirmed yet, so nothing changes at sign-in.
        $this->flushHeaders();
        app('auth')->forgetGuards();
        $login()->assertOk();

        $this->asUser($user)->postJson('/api/two-factor/confirm', ['code' => '000000'])->assertUnprocessable();
        $code = Totp::code($secret, (int) floor(time() / 30));
        $recovery = $this->asUser($user)->postJson('/api/two-factor/confirm', ['code' => $code])->assertOk()->json('data.recovery_codes');
        $this->assertCount(8, $recovery);

        // A wrong password says nothing about two-factor.
        $this->flushHeaders();
        app('auth')->forgetGuards();
        $this->postJson('/api/login', ['email' => 'two@example.com', 'password' => 'nope'])->assertStatus(401);

        $login()->assertStatus(423)->assertJsonMissingPath('data.token');
        $login(['two_factor_code' => '000000'])->assertUnprocessable()->assertJsonMissingPath('data.token');
        $login(['two_factor_code' => $code])->assertOk()->assertJsonPath('data.user.two_factor_enabled', true);

        // A recovery code works exactly once.
        $login(['two_factor_code' => $recovery[0]])->assertOk();
        $login(['two_factor_code' => $recovery[0]])->assertUnprocessable();
    }

    public function test_two_factor_secrets_are_encrypted_and_never_in_user_payloads(): void
    {
        $user = User::factory()->create(['password' => 'Secret-Pass1!']);
        $secret = $this->asUser($user)->postJson('/api/two-factor/setup', ['password' => 'Secret-Pass1!'])->json('data.secret');

        $this->assertNotSame($secret, \Illuminate\Support\Facades\DB::table('users')->whereKey($user->id)->value('two_factor_secret'));
        $this->asUser($user->fresh())->getJson('/api/user')->assertOk()->assertDontSee($secret)->assertJsonMissingPath('data.two_factor_secret');
    }

    // ------------------------------------------------------------ Patient files

    public function test_patient_files_stay_inside_the_clinic_and_downloads_are_logged(): void
    {
        Storage::fake(PatientFile::DISK);
        $patient = $this->makePatient();
        $this->book($patient, $this->world)->assertCreated();
        $url = $this->manage($this->world, "/patients/{$patient->patient->id}/files");

        $id = $this->asUser($this->world['admin'])->post($url, ['file' => UploadedFile::fake()->create('X-Ray July.pdf', 200, 'application/pdf')], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('data.name', 'X-Ray July.pdf')->json('data.id');

        $this->asUser($this->world['admin'])->get("{$url}/{$id}")->assertOk();
        $this->assertTrue(AuditLog::where('action', 'records.file_downloaded')->exists());

        $this->asUser($this->world['staff'])->getJson($url)->assertForbidden();

        $other = $this->makeClinic();
        $this->asUser($other['admin'])->getJson($this->manage($other, "/patients/{$patient->patient->id}/files"))->assertNotFound();
    }

    public function test_the_app_opens_patient_files_through_a_short_signed_link_only(): void
    {
        Storage::fake(PatientFile::DISK);
        $patient = $this->makePatient();
        $this->world['clinic']->patients()->syncWithoutDetaching([$patient->patient->id]);
        $url = $this->manage($this->world, "/patients/{$patient->patient->id}/files");
        $id = $this->asUser($this->world['admin'])->post($url, ['file' => UploadedFile::fake()->create('xray.pdf', 10, 'application/pdf')])->assertCreated()->json('data.id');

        $link = $this->asUser($this->world['admin'])->getJson("{$url}/{$id}/link")->assertOk()->json('data.url');
        $this->get($link)->assertOk();
        $this->get("/api/patient-files/{$id}/download")->assertForbidden();

        $this->travel(6)->minutes();
        $this->get($link)->assertForbidden();
    }

    public function test_only_documents_and_images_can_be_uploaded_as_patient_files(): void
    {
        Storage::fake(PatientFile::DISK);
        $patient = $this->makePatient();
        $this->book($patient, $this->world)->assertCreated();
        $url = $this->manage($this->world, "/patients/{$patient->patient->id}/files");
        $upload = fn (UploadedFile $file) => $this->asUser($this->world['admin'])->post($url, ['file' => $file], ['Accept' => 'application/json']);

        $upload(UploadedFile::fake()->create('script.php', 10, 'application/x-php'))->assertJsonValidationErrors('file');
        $upload(UploadedFile::fake()->create('page.html', 10, 'text/html'))->assertJsonValidationErrors('file');
        $upload(UploadedFile::fake()->create('huge.pdf', 20000, 'application/pdf'))->assertJsonValidationErrors('file');
    }

    // ------------------------------------------------------------ Reviews

    public function test_clinic_replies_to_a_review_and_summary_counts_ratings(): void
    {
        $patient = $this->makePatient();
        $id = $this->book($patient, $this->world)->assertCreated()->json('data.id');
        Appointment::whereKey($id)->update(['status' => Appointment::COMPLETED]);
        $review = new Review(['rating' => 4, 'comment' => 'Good']);
        $review->forceFill(['clinic_id' => $this->world['clinic']->id, 'patient_id' => $patient->patient->id, 'appointment_id' => $id, 'status' => Review::STATUS_APPROVED])->save();

        $this->asUser($this->world['admin'])->postJson($this->manage($this->world, "/reviews/{$review->id}/reply"), ['reply' => 'Thank you!'])
            ->assertOk()->assertJsonPath('data.clinic_reply', 'Thank you!');

        $this->asUser($this->world['admin'])->getJson($this->manage($this->world, '/reviews'))->assertOk()
            ->assertJsonPath('meta.summary.count', 1)
            ->assertJsonPath('meta.summary.breakdown.4', 1)
            ->assertJsonPath('data.0.clinic_reply', 'Thank you!');

        $other = $this->makeClinic();
        $this->asUser($other['admin'])->postJson($this->manage($other, "/reviews/{$review->id}/reply"), ['reply' => 'Not mine'])->assertNotFound();
    }

    // ------------------------------------------------------------ Appointments

    public function test_reassign_needs_a_dentist_of_this_clinic(): void
    {
        $patient = $this->makePatient();
        $id = $this->book($patient, $this->world)->assertCreated()->json('data.id');
        $other = $this->makeClinic();

        $this->asUser($this->world['staff'])->postJson($this->manage($this->world, "/appointments/{$id}/reassign"), ['dentist_id' => $other['dentist']->id])
            ->assertUnprocessable();
    }

    public function test_medical_flags_show_to_records_readers_and_the_front_desk(): void
    {
        $patient = $this->makePatient();
        $id = $this->book($patient, $this->world)->assertCreated()->json('data.id');
        $this->asUser($this->world['admin'])->postJson($this->manage($this->world, "/patients/{$patient->patient->id}/medical-history"), ['conditions' => 'Hypertensive'])->assertCreated();

        $url = $this->manage($this->world, "/appointments/{$id}");
        $this->asUser($this->world['admin'])->getJson($url)->assertOk()->assertJsonPath('data.medical_flags.0', 'Conditions: Hypertensive');
        $this->asUser($this->world['staff'])->getJson($url)->assertOk()->assertJsonPath('data.medical_flags.0', 'Conditions: Hypertensive');
    }

    public function test_patient_list_shows_conditions_to_admins_but_not_receptionists(): void
    {
        $patient = $this->makePatient();
        $this->book($patient, $this->world)->assertCreated();
        $this->asUser($this->world['admin'])->postJson($this->manage($this->world, "/patients/{$patient->patient->id}/medical-history"), ['conditions' => 'Hypertension'])->assertCreated();

        $url = $this->manage($this->world, '/patients');
        $this->asUser($this->world['admin'])->getJson($url)->assertOk()->assertJsonPath('data.0.conditions', 'Hypertension');
        $this->asUser($this->world['staff'])->getJson($url)->assertOk()->assertJsonPath('data.0.conditions', null)->assertDontSee('Hypertension');
    }

    public function test_patient_reported_blood_type_needs_consent(): void
    {
        $patient = $this->makePatient();
        $this->book($patient, $this->world)->assertCreated();
        $this->asUser($patient)->putJson('/api/patient/profile', ['blood_type' => 'O+'])->assertOk();
        $url = $this->manage($this->world, "/patients/{$patient->patient->id}");

        $this->asUser($this->world['admin'])->getJson($url)->assertOk()->assertJsonPath('data.medical_summary.blood_type', null);

        $this->asUser($patient)->putJson('/api/patient/profile', ['consents' => ['share_medical_history' => true]])->assertOk();
        $this->asUser($this->world['admin'])->getJson($url)->assertOk()->assertJsonPath('data.medical_summary.blood_type', 'O+');
    }

    // ------------------------------------------------------------ Services and branches

    public function test_removed_service_disappears_and_past_appointments_keep_it(): void
    {
        $patient = $this->makePatient();
        $this->book($patient, $this->world)->assertCreated();
        $service = $this->world['service'];

        $this->asUser($this->world['admin'])->deleteJson($this->manage($this->world, "/services/{$service->id}"))->assertOk();

        $this->asUser($this->world['admin'])->getJson($this->manage($this->world, '/services'))->assertOk()->assertJsonCount(0, 'data');
        $this->assertNotNull($service->fresh());
        $this->book($this->makePatient(), $this->world, '2026-11-03 11:00')->assertUnprocessable();
    }

    public function test_main_branch_cannot_be_removed(): void
    {
        $branch = $this->world['branch'];
        $branch->forceFill(['is_main' => true])->save();
        $this->asUser($this->world['admin'])->deleteJson($this->manage($this->world, "/branches/{$branch->id}"))->assertStatus(409);
    }

    // ------------------------------------------------------------ Subscription

    private function submitProof(): int
    {
        return $this->asUser($this->world['admin'])->post($this->manage($this->world, '/subscription/payments'), [
            'method' => 'gcash',
            'reference' => 'ABC123',
            'proof' => UploadedFile::fake()->create('receipt.png', 100, 'image/png'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');
    }

    public function test_payment_flow_from_proof_to_verified_renewal_and_invoice(): void
    {
        Storage::fake(SubscriptionPayment::DISK);
        $subscription = $this->manage($this->world, '/subscription');

        $this->asUser($this->world['admin'])->getJson($subscription)->assertOk()
            ->assertJsonPath('data.status', 'none')
            ->assertJsonPath('data.plan.name', 'Professional');

        $id = $this->submitProof();
        $this->asUser($this->world['admin'])->getJson($subscription)->assertOk()->assertJsonPath('data.has_pending_payment', true);
        $this->asUser($this->world['admin'])->getJson($this->manage($this->world, "/subscription/payments/{$id}/invoice"))->assertNotFound();

        // Only one proof at a time.
        $this->asUser($this->world['admin'])->post($this->manage($this->world, '/subscription/payments'), [
            'method' => 'gcash', 'proof' => UploadedFile::fake()->create('again.png', 100, 'image/png'),
        ], ['Accept' => 'application/json'])->assertStatus(409);

        SubscriptionPayment::findOrFail($id)->forceFill(['status' => SubscriptionPayment::VERIFIED, 'invoice_number' => 'INV-2026-001', 'reviewed_at' => now()])->save();

        $pdf = $this->asUser($this->world['admin'])->get($this->manage($this->world, "/subscription/payments/{$id}/invoice"))->assertOk();
        $this->assertStringStartsWith('%PDF', $pdf->getContent());
    }

    public function test_clinic_members_without_the_module_and_other_clinics_cannot_see_the_subscription(): void
    {
        Storage::fake(SubscriptionPayment::DISK);
        $id = $this->submitProof();
        SubscriptionPayment::findOrFail($id)->forceFill(['status' => SubscriptionPayment::VERIFIED, 'invoice_number' => 'INV-2026-002', 'reviewed_at' => now()])->save();

        $this->asUser($this->world['staff'])->getJson($this->manage($this->world, '/subscription'))->assertForbidden();

        $other = $this->makeClinic();
        $this->asUser($other['admin'])->getJson($this->manage($other, "/subscription/payments/{$id}/invoice"))->assertNotFound();
        $this->asUser($this->world['dentistUser'])->getJson('/api/admin/subscription-payments')->assertForbidden();
    }

    public function test_only_images_and_pdfs_are_accepted_as_payment_proof(): void
    {
        Storage::fake(SubscriptionPayment::DISK);
        $this->asUser($this->world['admin'])->post($this->manage($this->world, '/subscription/payments'), [
            'method' => 'gcash', 'proof' => UploadedFile::fake()->create('x.php', 10, 'application/x-php'),
        ], ['Accept' => 'application/json'])->assertJsonValidationErrors('proof');
    }

    public function test_notification_categories_turn_notifications_off(): void
    {
        $this->asUser($this->world['admin'])->putJson('/api/notification-preferences', ['categories' => ['nonsense' => false]])->assertUnprocessable();
        $this->asUser($this->world['admin'])->putJson('/api/notification-preferences', ['categories' => ['appointment_requests' => false]])->assertOk();

        $this->book($this->makePatient(), $this->world)->assertCreated();

        $this->assertSame(0, $this->world['admin']->fresh()->notifications()->where('data->kind', 'appointment')->count());
    }

    public function test_verify_extends_the_plan_from_its_end(): void
    {
        $subscription = new Subscription(['plan' => 'pro', 'status' => 'active', 'renews_at' => now()->addDays(10)]);
        $subscription->clinic_id = $this->world['clinic']->id;
        $subscription->save();
        Storage::fake(SubscriptionPayment::DISK);
        $id = $this->submitProof();

        $controller = app(\App\Http\Controllers\Api\Admin\SubscriptionPaymentController::class);
        $admin = User::factory()->create(['role' => 'system_admin']);
        $request = \Illuminate\Http\Request::create('/', 'POST');
        $request->setUserResolver(fn () => $admin);
        $controller->verify($request, SubscriptionPayment::findOrFail($id));

        $payment = SubscriptionPayment::findOrFail($id);
        $this->assertSame(SubscriptionPayment::VERIFIED, $payment->status);
        $this->assertNotNull($payment->invoice_number);
        $this->assertTrue($subscription->fresh()->renews_at->gt(now()->addDays(35)));
    }
}
