<?php

namespace Tests\Feature\Administration;

use App\Models\Clinic;
use App\Models\ClinicApplication;
use App\Models\Subscription;
use App\Models\SubscriptionPayment;
use App\Models\SystemAnnouncement;
use App\Models\User;
use App\Models\VerificationDocument;
use App\Support\PlatformSettings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Tests\Support\ClinicWorld;
use Tests\TestCase;

class SystemAdminPortalTest extends TestCase
{
    use ClinicWorld, RefreshDatabase;

    private User $sysadmin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->freezeClock();
        $this->sysadmin = User::factory()->role('system_admin')->create(['name' => 'Rhea Admin']);
    }

    private function registration(string $name = 'Kitaotao Family Dental', string $status = ClinicApplication::PENDING, bool $documents = true): ClinicApplication
    {
        $applicant = User::factory()->role('clinic_admin')->create();
        $application = new ClinicApplication([
            'clinic_name' => $name,
            'address' => 'Poblacion',
            'city' => 'Kitaotao',
            'province' => 'Bukidnon',
            'contact_number' => '09170000000',
            'representative_name' => 'Ramon Villanueva',
        ]);
        $application->applicant_id = $applicant->id;
        $application->status = $status;
        $application->submitted_at = $status === ClinicApplication::DRAFT ? null : now();
        $application->save();

        if ($documents) {
            foreach (ClinicApplication::REQUIRED_DOCUMENTS as $type) {
                $document = new VerificationDocument;
                $document->clinic_application_id = $application->id;
                $document->document_type = $type;
                $document->path = "applications/{$type}.pdf";
                $document->original_name = "{$type}.pdf";
                $document->mime_type = 'application/pdf';
                $document->size = 1000;
                $document->uploaded_by = $applicant->id;
                $document->save();
            }
        }

        return $application;
    }

    private function payment(Clinic $clinic, string $status = SubscriptionPayment::PENDING): SubscriptionPayment
    {
        $payment = new SubscriptionPayment(['plan' => 'starter', 'amount' => 1999, 'method' => 'gcash', 'reference' => 'REF1', 'proof_path' => 'proof.png', 'proof_mime_type' => 'image/png']);
        $payment->clinic_id = $clinic->id;
        $payment->status = $status;
        $payment->save();

        return $payment;
    }

    private function subscribe(Clinic $clinic, string $plan, $renewsAt): Subscription
    {
        $subscription = new Subscription(['plan' => $plan, 'status' => 'active', 'renews_at' => $renewsAt]);
        $subscription->clinic_id = $clinic->id;
        $subscription->save();

        return $subscription;
    }

    public function test_every_new_endpoint_is_for_system_administrators_only(): void
    {
        $world = $this->makeClinic();
        $announcement = SystemAnnouncement::forceCreate(['title' => 'T', 'content' => 'C', 'audience' => 'all', 'status' => 'draft']);
        $calls = [
            ['getJson', '/api/admin/clinics/directory'],
            ['getJson', "/api/admin/clinics/{$world['clinic']->id}"],
            ['getJson', '/api/admin/subscriptions'],
            ['getJson', "/api/admin/subscriptions/{$world['clinic']->id}"],
            ['putJson', "/api/admin/subscriptions/{$world['clinic']->id}/plan"],
            ['getJson', '/api/admin/reports'],
            ['getJson', '/api/admin/reports/export'],
            ['getJson', '/api/admin/announcements'],
            ['postJson', '/api/admin/announcements'],
            ['putJson', "/api/admin/announcements/{$announcement->id}"],
            ['postJson', "/api/admin/announcements/{$announcement->id}/publish"],
            ['postJson', "/api/admin/announcements/{$announcement->id}/archive"],
            ['getJson', '/api/admin/settings'],
            ['putJson', '/api/admin/settings'],
        ];

        foreach ([$this->makePatient(), $world['admin'], $world['dentistUser'], $world['staff']] as $user) {
            foreach ($calls as [$method, $url]) {
                $this->asUser($user)->{$method}($url)->assertForbidden();
            }
        }
    }

    public function test_changing_settings_and_plans_asks_for_the_password_again(): void
    {
        $world = $this->makeClinic();

        $this->asUser($this->sysadmin)->putJson('/api/admin/settings', ['maintenance_mode' => true])->assertStatus(423);
        $this->asUser($this->sysadmin)->putJson("/api/admin/subscriptions/{$world['clinic']->id}/plan", ['plan' => 'starter'])->assertStatus(423);
        $this->assertFalse(PlatformSettings::get('maintenance_mode'));
    }

    public function test_clinic_directory_lists_clinics_and_registrations_with_their_admin_and_plan(): void
    {
        $world = $this->makeClinic();
        $this->subscribe($world['clinic'], 'enterprise', now()->addMonth());
        $this->registration('Kitaotao Family Dental');
        $this->registration('Draft Dental', ClinicApplication::DRAFT);
        $this->registration('Approved Dental', ClinicApplication::APPROVED);

        $rows = collect($this->asUser($this->sysadmin)->getJson('/api/admin/clinics/directory')->assertOk()->json('data'));

        $this->assertNull($rows->firstWhere('name', 'Draft Dental'), 'Drafts stay private to the applicant.');
        $this->assertNull($rows->firstWhere('name', 'Approved Dental'), 'An approved registration is listed as its clinic.');
        $registration = $rows->firstWhere('name', 'Kitaotao Family Dental');
        $this->assertSame('application', $registration['kind']);
        $this->assertSame('pending', $registration['status']);
        $this->assertSame('Ramon Villanueva', $registration['admin']);
        $clinic = $rows->where('kind', 'clinic')->firstWhere('id', $world['clinic']->id);
        $this->assertSame('clinic', $clinic['kind']);
        $this->assertSame('Enterprise', $clinic['plan']);

        $this->assertCount(1, $this->asUser($this->sysadmin)->getJson('/api/admin/clinics/directory?status=pending')->json('data'));
        $this->assertSame(['Kitaotao Family Dental'], collect($this->asUser($this->sysadmin)->getJson('/api/admin/clinics/directory?search=kitaotao')->json('data'))->pluck('name')->all());
    }

    public function test_clinic_details_show_activity_without_names_or_clinical_events(): void
    {
        $world = $this->makeClinic();
        $this->subscribe($world['clinic'], 'starter', now()->addMonth());
        app(\App\Services\AuditLogger::class)->record('records.viewed', metadata: ['patient' => 'Maria Santos'], clinicId: $world['clinic']->id, actor: $world['dentistUser']);
        app(\App\Services\AuditLogger::class)->record('appointment.created', clinicId: $world['clinic']->id, actor: $world['dentistUser']);

        $data = $this->asUser($this->sysadmin)->getJson("/api/admin/clinics/{$world['clinic']->id}")->assertOk()->json('data');

        $this->assertSame('Starter', $data['plan']);
        $this->assertSame('active', $data['subscription_status']);
        $this->assertSame(['New appointment request'], collect($data['activity'])->pluck('label')->all());
        $this->assertStringNotContainsString('Maria', json_encode($data));
    }

    public function test_requesting_more_documents_returns_it_to_the_applicant(): void
    {
        $application = $this->registration();

        $this->asUser($this->sysadmin)->postJson("/api/admin/clinic-applications/{$application->id}/request-documents", ['notes' => 'x'])->assertStatus(423);
        $data = $this->asConfirmedAdmin($this->sysadmin)
            ->postJson("/api/admin/clinic-applications/{$application->id}/request-documents", ['notes' => 'Upload a current DOH license'])
            ->assertOk()->json('data');

        $this->assertSame('rejected', $data['status']);
        $this->assertTrue($data['documents_requested']);
        $this->assertTrue($application->fresh()->isEditableByApplicant());
        $row = collect($this->asUser($this->sysadmin)->getJson('/api/admin/clinic-applications')->json('data'))->firstWhere('id', $application->id);
        $this->assertSame('documents_requested', $row['document_status']);
        $this->assertSame('More documents needed for your clinic', $application->applicant->notifications()->first()->data['title']);
        $this->assertSame('clinic_application.documents_requested', collect($this->asUser($this->sysadmin)->getJson('/api/admin/audit-logs')->json('data'))->first()['action']);
    }

    public function test_required_documents_setting_changes_what_an_application_must_include(): void
    {
        $application = $this->registration('Partial Dental', ClinicApplication::DRAFT, false);

        $this->asConfirmedAdmin($this->sysadmin)->putJson('/api/admin/settings', ['required_documents' => ['business_permit']])->assertOk();
        $this->assertSame(['business_permit'], $application->fresh()->missingDocuments());

        $this->asConfirmedAdmin($this->sysadmin)->putJson('/api/admin/settings', ['required_documents' => []])->assertStatus(422);
        $this->asConfirmedAdmin($this->sysadmin)->putJson('/api/admin/settings', ['required_documents' => ['made_up']])->assertStatus(422);
    }

    public function test_without_required_verification_a_submitted_registration_is_approved_automatically(): void
    {
        $this->asConfirmedAdmin($this->sysadmin)->putJson('/api/admin/settings', ['require_verification' => false])->assertOk();
        $application = $this->registration('Quick Dental', ClinicApplication::DRAFT);

        $result = app(\App\Services\ClinicApplicationService::class)->submit($application);

        $this->assertSame(ClinicApplication::APPROVED, $result->status);
        $clinic = Clinic::find($result->clinic_id);
        $this->assertTrue($clinic->is_verified);
        $this->assertNull($result->reviewed_by);
    }

    public function test_submitting_a_registration_alerts_administrators_who_want_it(): void
    {
        $quiet = User::factory()->role('system_admin')->create();
        $quiet->forceFill(['notification_preferences' => ['categories' => ['admin_verification_requests' => false]]])->save();

        app(\App\Services\ClinicApplicationService::class)->submit($this->registration('Alert Dental', ClinicApplication::DRAFT));

        $this->assertSame('Clinic registration to verify', $this->sysadmin->notifications()->first()->data['title']);
        $this->assertSame(0, $quiet->notifications()->count());
    }

    public function test_subscriptions_list_shows_due_dates_and_status_through_the_grace_period(): void
    {
        $paid = $this->makeClinic()['clinic'];
        $this->subscribe($paid, 'professional', now()->addMonth());
        $this->payment($paid, SubscriptionPayment::VERIFIED);

        $inGrace = Clinic::factory()->create(['name' => 'In Grace', 'status' => 'approved']);
        $this->subscribe($inGrace, 'starter', now()->subDays(3));

        $lapsed = Clinic::factory()->create(['name' => 'Lapsed', 'status' => 'approved']);
        $this->subscribe($lapsed, 'starter', now()->subDays(30));

        $waiting = Clinic::factory()->create(['name' => 'Waiting', 'status' => 'approved']);
        $this->subscribe($waiting, 'starter', now()->subDays(30));
        $this->payment($waiting);

        $rows = collect($this->asUser($this->sysadmin)->getJson('/api/admin/subscriptions')->assertOk()->json('data'))->keyBy('clinic_name');

        $this->assertSame('active', $rows[$paid->name]['status']);
        $this->assertSame('verified', $rows[$paid->name]['payment_status']);
        $this->assertSame(4999, $rows[$paid->name]['amount']);
        $this->assertSame('grace', $rows['In Grace']['status']);
        $this->assertSame('expired', $rows['Lapsed']['status']);
        $this->assertSame('pending_payment', $rows['Waiting']['status']);
        $this->assertSame('pending', $rows['Waiting']['payment_status']);

        // A shorter grace period takes effect straight away.
        $this->asConfirmedAdmin($this->sysadmin)->putJson('/api/admin/settings', ['payment_grace_days' => 1])->assertOk();
        $rows = collect($this->asUser($this->sysadmin)->getJson('/api/admin/subscriptions')->json('data'))->keyBy('clinic_name');
        $this->assertSame('expired', $rows['In Grace']['status']);
    }

    public function test_changing_a_plan_applies_to_the_next_payment_and_survives_verifying_an_older_proof(): void
    {
        $clinic = $this->makeClinic()['clinic'];
        $payment = $this->payment($clinic);

        $row = $this->asConfirmedAdmin($this->sysadmin)->putJson("/api/admin/subscriptions/{$clinic->id}/plan", ['plan' => 'enterprise'])->assertOk()->json('data');
        $this->assertSame('Enterprise', $row['plan']);
        $this->assertSame(9999, $row['amount']);

        $this->asConfirmedAdmin($this->sysadmin)->postJson("/api/admin/subscription-payments/{$payment->id}/verify")->assertOk();

        $this->assertSame('enterprise', Subscription::firstWhere('clinic_id', $clinic->id)->plan);
        $this->asConfirmedAdmin($this->sysadmin)->putJson("/api/admin/subscriptions/{$clinic->id}/plan", ['plan' => 'pro'])->assertStatus(422);
    }

    public function test_subscription_details_include_the_latest_proof_and_available_plans(): void
    {
        $clinic = $this->makeClinic()['clinic'];
        $payment = $this->payment($clinic);

        $data = $this->asUser($this->sysadmin)->getJson("/api/admin/subscriptions/{$clinic->id}")->assertOk()->json('data');

        $this->assertSame($payment->id, $data['payment']['id']);
        $this->assertSame('GCash', $data['payment']['method']);
        $this->assertSame(['Starter', 'Professional', 'Enterprise'], collect($data['plans'])->pluck('name')->all());
        $this->assertArrayNotHasKey('proof_path', $data['payment']);
    }

    public function test_reports_compare_a_month_with_the_one_before_and_contain_no_personal_data(): void
    {
        $month = now('Asia/Manila');
        User::factory()->role('patient')->create(['name' => 'Secret Patient', 'created_at' => now()]);
        User::factory()->role('patient')->create(['created_at' => now()->subMonthNoOverflow()]);
        $world = $this->makeClinic();
        $this->subscribe($world['clinic'], 'enterprise', now()->addMonths(2));
        $this->registration('Report Dental');

        $body = $this->asUser($this->sysadmin)->getJson('/api/admin/reports?month='.$month->format('Y-m'))->assertOk();
        $data = $body->json('data');

        $patients = collect($data['users'])->firstWhere('metric', 'New Patients');
        $this->assertSame(1, $patients['previous']);
        $this->assertSame($patients['current'] - $patients['previous'], $patients['change']);
        $this->assertSame(1, collect($data['clinics'])->firstWhere('metric', 'New Registrations')['current']);
        $this->assertSame(1, collect($data['subscriptions'])->firstWhere('metric', 'Active Subscriptions')['current']);
        $this->assertSame(1, collect($data['overview']['plans'])->firstWhere('key', 'enterprise')['total']);
        $this->assertCount(4, $data['overview']['clinic_growth']);
        $this->assertStringNotContainsString('Secret Patient', $body->getContent());

        $this->asUser($this->sysadmin)->getJson('/api/admin/reports?month=not-a-month')->assertStatus(422);
    }

    public function test_exporting_a_report_is_a_csv_and_is_recorded(): void
    {
        $response = $this->asUser($this->sysadmin)->get('/api/admin/reports/export?section=users')->assertOk();

        $this->assertStringContainsString('text/csv', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('New Patients', $response->streamedContent());
        $this->assertSame('report.exported', collect($this->asUser($this->sysadmin)->getJson('/api/admin/audit-logs')->json('data'))->first()['action']);
    }

    public function test_publishing_an_announcement_notifies_its_audience_only(): void
    {
        $world = $this->makeClinic();
        $patient = $this->makePatient();

        $draft = $this->asUser($this->sysadmin)->postJson('/api/admin/announcements', ['title' => 'Dental Chart v2', 'content' => 'Now per tooth.', 'audience' => 'dentists'])
            ->assertCreated()->json('data');
        $this->assertSame('draft', $draft['status']);
        $this->assertSame(0, $world['dentistUser']->notifications()->count());

        $this->asUser($this->sysadmin)->postJson('/api/admin/announcements', ['title' => '', 'content' => 'x', 'audience' => 'everyone'])->assertStatus(422);
        $this->asUser($this->sysadmin)->putJson("/api/admin/announcements/{$draft['id']}", ['title' => 'Dental Chart v2.1', 'content' => 'Now per tooth.', 'audience' => 'dentists'])->assertOk();
        $this->asUser($this->sysadmin)->postJson("/api/admin/announcements/{$draft['id']}/publish")->assertOk();

        $this->assertSame('Dental Chart v2.1', $world['dentistUser']->notifications()->first()->data['title']);
        $this->assertSame(0, $patient->notifications()->count());
        $this->assertSame(0, $world['staff']->notifications()->count());

        $this->asUser($this->sysadmin)->postJson("/api/admin/announcements/{$draft['id']}/publish")->assertStatus(409);
        $this->asUser($this->sysadmin)->putJson("/api/admin/announcements/{$draft['id']}", ['title' => 'Changed', 'content' => 'x', 'audience' => 'all'])->assertStatus(409);

        $this->assertSame(1, $this->asUser($this->sysadmin)->getJson('/api/admin/dashboard')->json('data.active_announcements'));
        $this->asUser($this->sysadmin)->postJson("/api/admin/announcements/{$draft['id']}/archive")->assertOk();
        $this->assertSame(0, $this->asUser($this->sysadmin)->getJson('/api/admin/dashboard')->json('data.active_announcements'));
    }

    public function test_an_announcement_respects_the_recipients_preference_and_skips_suspended_accounts(): void
    {
        $quiet = $this->makePatient();
        $quiet->forceFill(['notification_preferences' => ['categories' => ['system_announcements' => false]]])->save();
        $suspended = $this->makePatient();
        $suspended->forceFill(['status' => 'suspended'])->save();
        $listening = $this->makePatient();

        $this->asUser($this->sysadmin)->postJson('/api/admin/announcements', ['title' => 'Maintenance', 'content' => 'Tonight', 'audience' => 'all', 'publish' => true])
            ->assertCreated()->assertJsonPath('data.status', 'published');

        $this->assertSame(1, $listening->notifications()->count());
        $this->assertSame(0, $quiet->notifications()->count());
        $this->assertSame(0, $suspended->notifications()->count());
    }

    public function test_maintenance_mode_blocks_everyone_except_system_administrators(): void
    {
        $patient = $this->makePatient();
        $this->asConfirmedAdmin($this->sysadmin)->putJson('/api/admin/settings', ['maintenance_mode' => true])->assertOk();
        Auth::forgetGuards();

        $this->withoutToken()->getJson('/api/home')->assertStatus(503)->assertJsonPath('code', 'maintenance');
        $this->getJson('/api/platform')->assertOk()->assertJsonPath('data.maintenance_mode', true);
        $this->getJson('/api/session')->assertOk();

        $token = $patient->createToken('phone')->plainTextToken;
        $this->withToken($token)->getJson('/api/user')->assertStatus(503);
        Auth::forgetGuards();

        $adminToken = $this->sysadmin->createToken('phone')->plainTextToken;
        $this->withToken($adminToken)->getJson('/api/admin/dashboard')->assertOk();
    }

    public function test_closing_registration_stops_patients_but_not_clinic_owners(): void
    {
        $this->asConfirmedAdmin($this->sysadmin)->putJson('/api/admin/settings', ['allow_self_registration' => false])->assertOk();
        Auth::forgetGuards();
        $form = ['password' => 'Password123', 'password_confirmation' => 'Password123', 'phone' => '09170000000', 'address' => 'Valencia'];

        $this->postJson('/api/register', [...$form, 'name' => 'New Patient', 'email' => 'p@example.test'])->assertForbidden();
        $this->assertDatabaseMissing('users', ['email' => 'p@example.test']);

        $this->postJson('/api/register', [...$form, 'name' => 'New Owner', 'email' => 'o@example.test', 'role' => 'clinic_admin'])->assertCreated();
        $this->getJson('/api/platform')->assertJsonPath('data.allow_self_registration', false);
    }

    public function test_session_timeout_ends_idle_staff_app_sessions_but_not_patient_ones(): void
    {
        $world = $this->makeClinic();
        $patient = $this->makePatient();
        $this->asConfirmedAdmin($this->sysadmin)->putJson('/api/admin/settings', ['session_timeout_minutes' => 30])->assertOk();
        Auth::forgetGuards();

        $staffToken = $world['staff']->createToken('phone')->plainTextToken;
        $patientToken = $patient->createToken('phone')->plainTextToken;

        $this->withToken($staffToken)->getJson('/api/user')->assertOk();
        Auth::forgetGuards();

        $this->travel(31)->minutes();
        $this->withToken($staffToken)->getJson('/api/user')->assertUnauthorized();
        Auth::forgetGuards();
        $this->withToken($patientToken)->getJson('/api/user')->assertOk();
    }

    public function test_session_timeout_sets_the_web_session_lifetime(): void
    {
        $this->asConfirmedAdmin($this->sysadmin)->putJson('/api/admin/settings', ['session_timeout_minutes' => 45])->assertOk();
        $this->getJson('/api/platform')->assertOk();

        $this->assertSame(45, config('session.lifetime'));
        $this->asConfirmedAdmin($this->sysadmin)->putJson('/api/admin/settings', ['session_timeout_minutes' => 1])->assertStatus(422);
    }

    public function test_settings_are_saved_recorded_and_list_the_plans(): void
    {
        $data = $this->asConfirmedAdmin($this->sysadmin)->putJson('/api/admin/settings', [
            'platform_name' => 'Kagay Dental',
            'support_email' => 'help@example.test',
            'payment_grace_days' => 10,
        ])->assertOk()->json('data');

        $this->assertSame('Kagay Dental', $data['platform_name']);
        $this->assertSame(['Starter', 'Professional', 'Enterprise'], collect($data['plans'])->pluck('name')->all());
        $this->assertSame('1 dentist, 1 branch', $data['plans'][0]['limits']);
        $this->assertSame('Kagay Dental', $this->getJson('/api/platform')->json('data.platform_name'));
        $this->assertSame('Kagay Dental', config('app.name'));

        $logs = collect($this->asUser($this->sysadmin)->getJson('/api/admin/audit-logs?category=settings')->json('data'));
        $this->assertSame('Updated system settings', $logs->first()['label']);
        $this->assertSame('System settings', $logs->first()['module']);
    }

    public function test_dashboard_adds_the_platform_figures_of_the_design(): void
    {
        $world = $this->makeClinic();
        $this->subscribe($world['clinic'], 'starter', now()->addMonth());
        $this->payment($world['clinic']);
        $this->asUser($this->sysadmin)->postJson('/api/admin/announcements', ['title' => 'Hello', 'content' => 'World', 'audience' => 'all', 'publish' => true]);

        $data = $this->asUser($this->sysadmin)->getJson('/api/admin/dashboard')->assertOk()->json('data');

        $this->assertSame(1, $data['active_subscriptions']);
        $this->assertSame(1, $data['pending_payments']['total']);
        $this->assertSame($world['clinic']->name, $data['pending_payments']['items'][0]['clinic_name']);
        $this->assertSame(1, $data['active_announcements']);
        $this->assertSame(0, $data['total_appointments']);
        $this->assertCount(6, $data['platform_growth']);
        $this->assertSame(User::count(), end($data['platform_growth'])['total']);
        $this->assertSame('Published an announcement', $data['recent_audit'][0]['label']);
    }

    public function test_audit_log_can_be_searched_by_words_person_and_clinic(): void
    {
        $world = $this->makeClinic();
        app(\App\Services\AuditLogger::class)->record('clinic.suspended', $world['clinic'], clinicId: $world['clinic']->id, actor: $this->sysadmin);
        app(\App\Services\AuditLogger::class)->record('settings.updated', actor: $world['admin']);

        $search = fn (string $term) => collect($this->asUser($this->sysadmin)->getJson('/api/admin/audit-logs?search='.urlencode($term))->assertOk()->json('data'))->pluck('action');

        $this->assertTrue($search('Suspended clinic')->contains('clinic.suspended'));
        $this->assertFalse($search('Suspended clinic')->contains('settings.updated'));
        $this->assertTrue($search('Rhea')->contains('clinic.suspended'));
        $this->assertTrue($search($world['clinic']->name)->contains('clinic.suspended'));
    }

    public function test_a_burst_of_admin_actions_does_not_refuse_the_password_check(): void
    {
        for ($i = 0; $i < 8; $i++) {
            $this->asUser($this->sysadmin)->postJson('/api/admin/announcements', ['title' => "Notice {$i}", 'content' => 'x', 'audience' => 'all'])->assertCreated();
        }

        $this->asUser($this->sysadmin)->postJson('/api/admin/confirm-password', ['password' => 'wrong-password'])->assertStatus(422);
    }

    public function test_a_payment_proof_opens_through_a_signed_link_that_is_recorded(): void
    {
        Storage::fake(SubscriptionPayment::DISK);
        Storage::disk(SubscriptionPayment::DISK)->put('proof.png', 'image');
        $world = $this->makeClinic();
        $payment = $this->payment($world['clinic']);

        $this->asUser($world['admin'])->getJson("/api/admin/subscription-payments/{$payment->id}/proof-link")->assertForbidden();
        $url = $this->asUser($this->sysadmin)->getJson("/api/admin/subscription-payments/{$payment->id}/proof-link")->assertOk()->json('data.url');

        $this->withoutToken()->get($url)->assertOk();
        $this->withoutToken()->getJson("/api/subscription-proofs/{$payment->id}/download")->assertForbidden();
        $this->assertSame('subscription.proof_opened', collect($this->asUser($this->sysadmin)->getJson('/api/admin/audit-logs')->json('data'))->first()['action']);
    }

    public function test_users_list_names_the_clinic_and_system_alerts_fire_once(): void
    {
        $world = $this->makeClinic();
        $row = collect($this->asUser($this->sysadmin)->getJson('/api/admin/users?role=staff')->assertOk()->json('data'))->firstWhere('id', $world['staff']->id);
        $this->assertSame($world['clinic']->name, $row['clinic_name']);

        config(['app.env' => 'testing']);
        \Illuminate\Support\Facades\Schema::dropIfExists('no_such_table');
        $health = \Mockery::mock(\App\Services\SystemHealth::class);
        $health->shouldReceive('report')->andReturn(['status' => 'down', 'checks' => [['label' => 'Database', 'status' => 'fail']]]);
        $this->app->instance(\App\Services\SystemHealth::class, $health);

        Artisan::call('admin:send-system-alerts');
        Artisan::call('admin:send-system-alerts');

        $this->assertSame(1, $this->sysadmin->notifications()->where('data->kind', 'system_alert')->count());
    }
}
