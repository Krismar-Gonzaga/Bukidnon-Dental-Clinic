<?php

namespace Tests\Feature\Administration;

use App\Models\AuditLog;
use App\Models\ClinicApplication;
use App\Models\User;
use App\Services\AuditChain;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Tests\Support\ClinicWorld;
use Tests\TestCase;

class AuditAndVerificationTest extends TestCase
{
    use ClinicWorld, RefreshDatabase;

    private User $sysadmin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->freezeClock();
        Storage::fake('local');
        $this->sysadmin = User::factory()->role('system_admin')->create(['name' => 'Sam Admin']);
    }

    /** A few audited events, old enough to be sealed. */
    private function someEvents(): array
    {
        $world = $this->makeClinic();
        $this->postJson('/api/login', ['email' => $this->sysadmin->email, 'password' => 'wrong-password'])->assertUnauthorized();
        $this->asConfirmedAdmin($this->sysadmin)->postJson("/api/admin/clinics/{$world['clinic']->id}/suspend", ['reason' => 'Expired permit'])->assertOk();
        $this->asConfirmedAdmin($this->sysadmin)->postJson("/api/admin/clinics/{$world['clinic']->id}/reactivate")->assertOk();
        $this->travel(1)->minutes();

        return $world;
    }

    private function submittedApplication(string $name = 'Quezon Family Dental'): int
    {
        $owner = User::factory()->role('clinic_admin')->create();
        $id = $this->asUser($owner)->postJson('/api/clinic-applications', [
            'clinic_name' => $name, 'address' => 'Purok 3', 'city' => 'Quezon', 'contact_number' => '09175550000', 'representative_name' => '=HYPERLINK("x")',
        ])->assertCreated()->json('data.id');
        foreach (ClinicApplication::REQUIRED_DOCUMENTS as $type) {
            $this->asUser($owner)->post("/api/clinic-applications/{$id}/documents", [
                'document_type' => $type, 'file' => UploadedFile::fake()->create("{$type}.pdf", 50, 'application/pdf'),
            ], ['Accept' => 'application/json'])->assertCreated();
        }
        $this->asUser($owner)->postJson("/api/clinic-applications/{$id}/submit")->assertOk();

        return $id;
    }

    public function test_the_hash_chain_detects_edited_deleted_and_removed_entries(): void
    {
        $this->someEvents();
        $chain = app(AuditChain::class);

        $report = $chain->verify();
        $this->assertSame('verified', $report['status']);
        $this->assertSame(AuditLog::count(), $report['checked']);
        $this->assertSame(0, AuditLog::whereNull('hash')->count());

        $ids = AuditLog::orderBy('id')->pluck('id');

        // Edited directly in the database: the edited entry is reported.
        DB::table('audit_logs')->where('id', $ids[1])->update(['metadata' => json_encode(['reason' => 'Nothing to see'])]);
        $report = $chain->verify();
        $this->assertSame('failed', $report['status']);
        $this->assertSame(['id' => $ids[1], 'type' => 'modified'], array_intersect_key($report['problems'][0], ['id' => 0, 'type' => 0]));

        // Deleted: the entry after the gap is reported.
        DB::table('audit_logs')->where('id', $ids[1])->delete();
        $this->assertSame('chain_broken', $chain->verify()['problems'][0]['type']);
    }

    public function test_removing_the_newest_entries_is_detected(): void
    {
        $this->someEvents();
        $chain = app(AuditChain::class);
        $this->assertSame('verified', $chain->verify()['status']);

        DB::table('audit_logs')->where('id', AuditLog::max('id'))->delete();
        $types = array_column($chain->verify()['problems'], 'type');
        $this->assertContains('tail_removed', $types);
    }

    public function test_entries_wait_before_they_are_sealed_and_the_check_is_audited(): void
    {
        $this->someEvents();
        $this->asUser($this->sysadmin)->getJson('/api/admin/dashboard')->assertOk(); // no audit entry

        $report = $this->asUser($this->sysadmin)->postJson('/api/admin/audit-logs/integrity')->assertOk()->json('data');
        $this->assertSame('verified', $report['status']);
        $this->assertSame(0, $report['pending']);

        // The check's own entry is too new to seal yet.
        $summary = $this->asUser($this->sysadmin)->getJson('/api/admin/audit-logs/summary')->assertOk()->json('data');
        $this->assertSame(1, $summary['integrity']['unsealed']);
        $this->assertSame('verified', $summary['integrity']['last_report']['status']);

        $world = $this->makeClinic();
        $this->asUser($world['admin'])->postJson('/api/admin/audit-logs/integrity')->assertForbidden();
    }

    public function test_entries_are_readable_and_filterable(): void
    {
        $this->someEvents();

        $rows = $this->asUser($this->sysadmin)->getJson('/api/admin/audit-logs?category=security')->assertOk()->json('data');
        $failed = collect($rows)->firstWhere('action', 'auth.login_failed');
        $this->assertSame('Failed sign-in attempt', $failed['label']);
        $this->assertSame('failed', $failed['outcome']);
        $this->assertSame('security', $failed['category']);
        $this->assertStringContainsString($this->sysadmin->email, $failed['detail']);
        $this->assertNotContains('clinic.suspended', array_column($rows, 'action'));

        $suspended = collect($this->asUser($this->sysadmin)->getJson('/api/admin/audit-logs?role=system_admin&category=clinics')->json('data'))
            ->firstWhere('action', 'clinic.suspended');
        $this->assertSame('Sam Admin', $suspended['user_name']);
        $this->assertSame('system_admin', $suspended['user_role']);
        $this->assertSame('Reason: Expired permit', $suspended['detail']);
        $this->assertNotNull($suspended['subject_label']);

        $this->asUser($this->sysadmin)->getJson('/api/admin/audit-logs?range=24h')->assertOk()->assertJsonPath('meta.total', AuditLog::count());
        $this->travel(2)->days();
        $this->asUser($this->sysadmin)->getJson('/api/admin/audit-logs?range=24h')->assertOk()->assertJsonPath('meta.total', 0);
        $this->asUser($this->sysadmin)->getJson('/api/admin/audit-logs?range=forever')->assertStatus(422);
    }

    public function test_summary_counts_the_window_and_the_one_before(): void
    {
        $this->someEvents();
        $this->travel(30)->hours(); // yesterday's events fall in the 24 hours before the last 24
        $this->postJson('/api/login', ['email' => 'nobody@example.test', 'password' => 'x'])->assertUnauthorized();

        $data = $this->asUser($this->sysadmin)->getJson('/api/admin/audit-logs/summary?range=7d')->assertOk()->json('data');
        $this->assertSame(2, $data['failed_logins']);
        $this->assertSame(1, $data['failed_login_ips']);
        $this->assertSame(2, $data['critical_actions']); // suspended + reactivated
        $this->assertSame(0, $data['previous_total']);

        $today = $this->asUser($this->sysadmin)->getJson('/api/admin/audit-logs/summary?range=24h')->json('data');
        $this->assertSame(1, $today['failed_logins']);
        $this->assertGreaterThan(0, $today['previous_total']);
    }

    public function test_exports_need_the_password_and_neutralise_spreadsheet_formulas(): void
    {
        $this->someEvents();
        $this->submittedApplication();

        $this->asUser($this->sysadmin)->get('/api/admin/audit-logs/export')->assertStatus(423);
        $this->asUser($this->sysadmin)->get('/api/admin/clinic-applications/export')->assertStatus(423);

        $csv = $this->asConfirmedAdmin($this->sysadmin)->get('/api/admin/clinic-applications/export')->assertOk()->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBFReference,Clinic", $csv);
        $this->assertStringContainsString("'=HYPERLINK", $csv);

        $audit = $this->asConfirmedAdmin($this->sysadmin)->get('/api/admin/audit-logs/export?category=security')->assertOk();
        $this->assertStringContainsString('text/csv', $audit->headers->get('Content-Type'));
        $this->assertStringContainsString('Failed sign-in attempt', $audit->streamedContent());

        $this->assertDatabaseHas('audit_logs', ['action' => 'audit.exported', 'user_id' => $this->sysadmin->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'clinic_application.exported', 'user_id' => $this->sysadmin->id]);
        $world = $this->makeClinic();
        $this->asConfirmedAdmin($world['admin'])->get('/api/admin/audit-logs/export')->assertForbidden();
    }

    public function test_registrations_show_document_status_priority_and_summary(): void
    {
        $fresh = $this->submittedApplication('Fresh Dental');
        $old = $this->submittedApplication('Old Dental');
        ClinicApplication::whereKey($old)->update(['submitted_at' => now()->subDays(5)]);
        DB::table('verification_documents')->where('clinic_application_id', $fresh)->where('document_type', 'prc_id')->delete();

        $rows = collect($this->asUser($this->sysadmin)->getJson('/api/admin/clinic-applications')->assertOk()->json('data'))->keyBy('id');
        $this->assertSame(sprintf('REG-%05d', $fresh), $rows[$fresh]['reference']);
        $this->assertSame('missing_info', $rows[$fresh]['document_status']);
        $this->assertSame('high', $rows[$fresh]['priority']);
        $this->assertSame('pending', $rows[$old]['document_status']);
        $this->assertSame('high', $rows[$old]['priority']);

        $this->asUser($this->sysadmin)->getJson('/api/admin/clinic-applications?view=attention')->assertOk()->assertJsonCount(2, 'data');

        $this->asConfirmedAdmin($this->sysadmin)->postJson("/api/admin/clinic-applications/{$old}/approve")->assertOk();
        $this->asUser($this->sysadmin)->getJson("/api/admin/clinic-applications/{$old}")->assertOk()
            ->assertJsonPath('data.document_status', 'verified')->assertJsonPath('data.priority', null);

        $summary = $this->asUser($this->sysadmin)->getJson('/api/admin/clinic-applications/summary')->assertOk()->json('data');
        $this->assertSame(1, $summary['pending']);
        $this->assertSame(1, $summary['missing_info']);
        $this->assertSame(1, $summary['needs_attention']);
        $this->assertSame(1, $summary['verified_today']);
        $this->assertSame(1, $summary['decisions_last_30_days']);
        $this->assertSame($fresh, $summary['oldest_open_id']);
        $this->assertSame(ClinicApplication::REQUIRED_DOCUMENTS, $summary['required_documents']);
    }
}
