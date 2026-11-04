<?php

namespace Tests\Feature\Clinics;

use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\ClinicBranch;
use App\Models\DentalCertificate;
use App\Models\Dentist;
use App\Models\FollowUp;
use App\Models\PatientFile;
use App\Models\PatientRecord;
use App\Models\Prescription;
use App\Models\User;
use App\Notifications\PortalNotice;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\Support\ClinicWorld;
use Tests\TestCase;

class DentistPortalTest extends TestCase
{
    use ClinicWorld, RefreshDatabase;

    private array $world;

    protected function setUp(): void
    {
        parent::setUp();
        $this->freezeClock();
        $this->world = $this->makeClinic();
        $this->world['dentist']->update(['license_number' => 'PRC-D-1']);
    }

    private function dentist(): static
    {
        return $this->asUser($this->world['dentistUser']);
    }

    private function url(string $path): string
    {
        return $this->manage($this->world, $path);
    }

    /** A patient with an appointment with this world's dentist, plus that appointment. */
    private function patientWithVisit(string $when = '2026-11-03 09:00'): array
    {
        $user = $this->makePatient();
        $id = $this->book($user, $this->world, $when)->assertCreated()->json('data.id');

        return [$user->patient, Appointment::findOrFail($id)];
    }

    private function otherDentist(): User
    {
        $user = User::factory()->role('dentist')->memberOf($this->world['clinic'], 'dentist')->create();
        $dentist = new Dentist(['is_active' => true]);
        $dentist->user_id = $user->id;
        $dentist->clinic_id = $this->world['clinic']->id;
        $dentist->save();

        return $user;
    }

    // ------------------------------------------------------------ Dashboard

    public function test_overview_counts_only_this_dentists_day(): void
    {
        [$patient] = $this->patientWithVisit('2026-11-02 14:00');
        $this->patientWithVisit('2026-11-04 09:00');
        FollowUp::forceCreate(['clinic_id' => $this->world['clinic']->id, 'patient_id' => $patient->id, 'dentist_id' => $this->world['dentist']->id, 'purpose' => 'Check', 'due_on' => '2026-12-01']);

        $this->otherDentist();
        $response = $this->dentist()->getJson($this->url('/dentist/overview'))->assertOk();

        $response->assertJsonPath('data.counts.today', 1)
            ->assertJsonPath('data.counts.pending', 2)
            ->assertJsonPath('data.counts.upcoming', 1)
            ->assertJsonPath('data.counts.active_patients', 2)
            ->assertJsonPath('data.follow_ups_due.0.due_on', '2026-12-01')
            ->assertJsonCount(7, 'data.week');
        $this->assertSame(1, collect($response->json('data.week'))->firstWhere('date', '2026-11-02')['total']);

        $this->asUser($this->otherDentist())->getJson($this->url('/dentist/overview'))->assertOk()->assertJsonPath('data.counts.today', 0);
        $this->asUser($this->world['staff'])->getJson($this->url('/dentist/overview'))->assertForbidden();
    }

    // ------------------------------------------------------------ Appointments

    public function test_dentist_can_answer_their_own_requests_and_no_others(): void
    {
        [, $mine] = $this->patientWithVisit();
        [, $declined] = $this->patientWithVisit('2026-11-03 10:00');

        $this->dentist()->postJson($this->url("/appointments/{$mine->id}/confirm"))->assertOk()->assertJsonPath('data.status', 'confirmed');
        $this->dentist()->postJson($this->url("/appointments/{$declined->id}/reject"), ['reason' => 'On leave'])->assertOk();
        $this->dentist()->postJson($this->url("/appointments/{$mine->id}/cancel"), ['reason' => 'x'])->assertForbidden();

        [, $another] = $this->patientWithVisit('2026-11-03 11:00');
        $this->asUser($this->otherDentist())->postJson($this->url("/appointments/{$another->id}/confirm"))->assertNotFound();
    }

    public function test_dentist_starts_a_confirmed_visit_on_its_day_only(): void
    {
        [, $today] = $this->patientWithVisit('2026-11-02 14:00');
        [, $later] = $this->patientWithVisit('2026-11-03 09:00');
        foreach ([$today, $later] as $appointment) {
            $this->dentist()->postJson($this->url("/appointments/{$appointment->id}/confirm"))->assertOk();
        }

        $this->dentist()->postJson($this->url("/appointments/{$later->id}/start"))->assertUnprocessable();
        $this->dentist()->postJson($this->url("/appointments/{$today->id}/start"))->assertOk()->assertJsonPath('data.status', 'in_progress');
        $this->assertTrue($today->statusHistory()->where('to_status', 'checked_in')->exists());
        $this->dentist()->postJson($this->url("/appointments/{$today->id}/complete"))->assertOk()->assertJsonPath('data.status', 'completed');
    }

    public function test_treatment_notes_are_clinical_so_the_front_desk_never_gets_them(): void
    {
        [, $appointment] = $this->patientWithVisit();
        $this->dentist()->putJson($this->url("/appointments/{$appointment->id}/treatment-notes"), ['notes' => 'Upper arch wire'])
            ->assertOk()->assertJsonPath('data.treatment_notes', 'Upper arch wire');

        $this->dentist()->getJson($this->url("/appointments/{$appointment->id}"))->assertOk()->assertJsonPath('data.treatment_notes', 'Upper arch wire');
        $staff = $this->asUser($this->world['staff'])->getJson($this->url("/appointments/{$appointment->id}"))->assertOk();
        $this->assertArrayNotHasKey('treatment_notes', $staff->json('data'));
        $this->assertNull($staff->json('data.patient_snapshot'));
        $this->asUser($this->world['staff'])->putJson($this->url("/appointments/{$appointment->id}/treatment-notes"), ['notes' => 'x'])->assertForbidden();

        $this->assertStringNotContainsString('Upper arch wire', AuditLog::where('action', 'records.visit_notes_updated')->first()->toJson());
    }

    // ------------------------------------------------------------ Clinical notes

    public function test_a_draft_stays_with_its_author_until_finalized_and_then_cannot_change(): void
    {
        [$patient] = $this->patientWithVisit();
        $user = $patient->user;
        $records = "/patients/{$patient->id}/records";
        $draftFields = ['record_type' => 'examination', 'chief_complaint' => 'Pain', 'diagnosis' => 'Caries', 'treatment_plan' => 'Fill #3', 'status' => 'draft', 'is_patient_visible' => true];

        $id = $this->dentist()->postJson($this->url($records), $draftFields)->assertCreated()->assertJsonPath('data.status', 'draft')->json('data.id');
        $this->assertFalse(PatientRecord::find($id)->is_patient_visible);

        // Nobody else reads a draft, and it never reaches the patient.
        $this->dentist()->getJson($this->url('/records?kind=notes'))->assertOk()->assertJsonCount(1, 'data');
        $this->asUser($this->world['admin'])->getJson($this->url('/records?kind=notes'))->assertOk()->assertJsonCount(0, 'data');
        $this->asUser($this->world['admin'])->getJson($this->url($records))->assertOk()->assertJsonCount(0, 'data');
        $this->asUser($this->world['admin'])->putJson($this->url("{$records}/{$id}"), $draftFields)->assertNotFound();
        $this->asUser($user)->getJson('/api/patient/records')->assertOk()->assertJsonCount(0, 'data');

        // A draft cannot be corrected, only finished.
        $this->dentist()->postJson($this->url("{$records}/{$id}/amend"), [...$draftFields, 'amendment_reason' => 'x'])->assertNotFound();
        $this->dentist()->putJson($this->url("{$records}/{$id}"), [...$draftFields, 'diagnosis' => 'Deep caries'])->assertOk()->assertJsonPath('data.diagnosis', 'Deep caries');
        $this->dentist()->putJson($this->url("{$records}/{$id}"), [...$draftFields, 'status' => 'final', 'diagnosis' => 'Deep caries'])->assertOk()->assertJsonPath('data.status', 'final');

        $this->asUser($this->world['admin'])->getJson($this->url('/records?kind=notes'))->assertOk()->assertJsonCount(1, 'data');
        $this->dentist()->putJson($this->url("{$records}/{$id}"), [...$draftFields, 'diagnosis' => 'Changed'])->assertNotFound();
        $this->assertSame('Deep caries', PatientRecord::find($id)->diagnosis);

        // Corrections still work on final records.
        $this->dentist()->postJson($this->url("{$records}/{$id}/amend"), [...$draftFields, 'status' => 'final', 'diagnosis' => 'Corrected', 'amendment_reason' => 'Typo'])->assertOk();
    }

    public function test_existing_records_count_as_final_and_the_two_pages_split_by_kind(): void
    {
        [$patient] = $this->patientWithVisit();
        $records = "/patients/{$patient->id}/records";
        $this->dentist()->postJson($this->url($records), ['record_type' => 'consultation', 'chief_complaint' => 'Pain'])->assertCreated()->assertJsonPath('data.status', 'final');
        $this->dentist()->postJson($this->url($records), [
            'record_type' => 'treatment', 'procedures' => 'Zoom Whitening', 'tooth_numbers' => 'Full Mouth',
            'materials_used' => 'HP gel', 'notes' => 'Mild sensitivity', 'performed_on' => '2026-11-01',
        ])->assertCreated()->assertJsonPath('data.performed_on', '2026-11-01')->assertJsonPath('data.materials_used', 'HP gel');

        $this->dentist()->getJson($this->url('/records?kind=notes'))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.record_type', 'consultation');
        $this->dentist()->getJson($this->url('/records?kind=treatments'))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.record_type', 'treatment');
    }

    // ------------------------------------------------------------ Dental chart

    public function test_dental_chart_saves_per_clinic_and_stays_with_the_treating_dentist(): void
    {
        [$patient] = $this->patientWithVisit();
        $chart = "/patients/{$patient->id}/dental-chart";

        $this->dentist()->getJson($this->url($chart))->assertOk()
            ->assertJsonCount(32, 'data.teeth')
            ->assertJsonPath('data.summary.healthy', 32)
            ->assertJsonPath('data.teeth.0.charted', false)
            ->assertJsonPath('data.last_updated_at', null);

        $this->dentist()->putJson($this->url("{$chart}/10"), ['status' => 'caries', 'notes' => 'Early caries, monitor'])->assertOk()
            ->assertJsonPath('data.summary.caries', 1)->assertJsonPath('data.summary.healthy', 31)
            ->assertJsonPath('data.teeth.9.notes', 'Early caries, monitor')->assertJsonPath('data.teeth.9.charted', true);
        $this->dentist()->putJson($this->url("{$chart}/10"), ['status' => 'filled'])->assertOk()->assertJsonPath('data.summary.caries', 0);
        $this->dentist()->putJson($this->url("{$chart}/33"), ['status' => 'filled'])->assertNotFound();
        $this->dentist()->putJson($this->url("{$chart}/1"), ['status' => 'painted'])->assertJsonValidationErrors('status');

        $this->asUser($this->otherDentist())->getJson($this->url($chart))->assertNotFound();
        $this->asUser($this->world['staff'])->getJson($this->url($chart))->assertForbidden();

        $log = AuditLog::where('action', 'records.chart_updated')->latest('id')->first();
        $this->assertSame('caries', $log->metadata['from']);
        $this->assertStringNotContainsString('Early caries', AuditLog::where('action', 'records.chart_updated')->get()->toJson());
    }

    public function test_checklist_is_unticked_until_the_dentist_ticks_it(): void
    {
        [$patient] = $this->patientWithVisit();
        $url = $this->url("/patients/{$patient->id}/checklist");

        $empty = $this->dentist()->getJson($url)->assertOk();
        $this->assertSame([false], array_values(array_unique($empty->json('data.items'))));
        $this->assertNull($empty->json('data.reviewed_at'));

        $this->dentist()->putJson($url, ['items' => ['allergies_reviewed' => true]])->assertOk()->assertJsonPath('data.reviewed_by', $this->world['dentistUser']->name);
        $this->dentist()->getJson($url)->assertOk()
            ->assertJsonPath('data.items.allergies_reviewed', true)
            ->assertJsonPath('data.items.latex_free_required', false);
        $this->dentist()->putJson($url, ['items' => ['made_up' => true]])->assertJsonValidationErrors('items');
    }

    // ------------------------------------------------------------ Prescriptions and certificates

    public function test_only_a_licensed_dentist_issues_prescriptions_and_they_cannot_change(): void
    {
        [$patient] = $this->patientWithVisit();
        $body = ['patient_id' => $patient->id, 'medication' => 'Amoxicillin', 'dosage' => '500mg', 'frequency' => 'Every 8 hours', 'duration' => '5 days', 'instructions' => 'After meals'];

        $this->asUser($this->world['staff'])->postJson($this->url('/prescriptions'), $body)->assertForbidden();
        $this->asUser($this->world['admin'])->postJson($this->url('/prescriptions'), $body)->assertForbidden();
        $this->asUser($this->otherDentist())->postJson($this->url('/prescriptions'), $body)->assertNotFound();

        $this->world['dentist']->update(['license_number' => null]);
        $this->dentist()->postJson($this->url('/prescriptions'), $body)->assertUnprocessable();
        $this->world['dentist']->update(['license_number' => 'PRC-D-1']);

        $id = $this->dentist()->postJson($this->url('/prescriptions'), $body)->assertCreated()->assertJsonPath('data.status', 'issued')->json('data.id');
        $this->dentist()->getJson($this->url('/prescriptions'))->assertOk()->assertJsonCount(1, 'data');

        $this->expectException(\LogicException::class);
        Prescription::find($id)->update(['medication' => 'Other']);
    }

    public function test_prescription_print_needs_the_signed_link_and_escapes_its_text(): void
    {
        [$patient] = $this->patientWithVisit();
        $id = $this->dentist()->postJson($this->url('/prescriptions'), [
            'patient_id' => $patient->id, 'medication' => '<script>alert(1)</script>', 'dosage' => '1', 'frequency' => '1', 'duration' => '1',
        ])->assertCreated()->json('data.id');

        $this->get("/api/prescriptions/{$id}/print")->assertForbidden();

        $link = $this->dentist()->getJson($this->url("/prescriptions/{$id}/print-link"))->assertOk()->json('data.url');
        $page = $this->get($link)->assertOk();
        $page->assertSee('PRC-D-1')->assertSee('&lt;script&gt;alert(1)&lt;/script&gt;', false);
        $page->assertDontSee('<script>alert(1)</script>', false);

        $this->travel(6)->minutes();
        $this->get($link)->assertForbidden();
    }

    public function test_certificate_preview_issues_nothing_and_printing_issues_one(): void
    {
        [$patient] = $this->patientWithVisit();
        $body = ['patient_id' => $patient->id, 'type' => 'treatment', 'purpose' => 'Oral prophylaxis'];

        $this->dentist()->postJson($this->url('/certificates/preview'), $body)->assertOk()
            ->assertJsonPath('data.title', 'Treatment Certificate')
            ->assertJsonPath('data.dentist.license_number', 'PRC-D-1')
            ->assertJsonPath('data.clinic.name', $this->world['clinic']->name);
        $this->assertSame(0, DentalCertificate::count());

        $this->dentist()->postJson($this->url('/certificates/preview'), [...$body, 'purpose' => ''])->assertJsonValidationErrors('purpose');
        $this->asUser($this->world['staff'])->postJson($this->url('/certificates'), $body)->assertForbidden();

        $link = $this->dentist()->postJson($this->url('/certificates'), $body)->assertCreated()->json('data.url');
        $this->assertSame(1, DentalCertificate::count());
        $this->get($link)->assertOk()->assertSee('Oral prophylaxis')->assertSee('PRC-D-1');
    }

    // ------------------------------------------------------------ Imaging

    public function test_files_list_across_own_patients_with_category_and_notes(): void
    {
        Storage::fake(PatientFile::DISK);
        [$patient] = $this->patientWithVisit();
        [$other] = $this->patientWithVisit('2026-11-03 10:00');
        $upload = fn ($to, $category) => $this->dentist()->post($this->url("/patients/{$to->id}/files"), [
            'file' => UploadedFile::fake()->createWithContent('scan.pdf', "%PDF-1.4
%test
"), 'category' => $category, 'notes' => 'Roots stable',
        ], ['Accept' => 'application/json']);

        $upload($patient, 'panoramic_xray')->assertCreated()->assertJsonPath('data.category', 'panoramic_xray');
        $upload($other, 'lab_result')->assertCreated();
        $upload($patient, 'selfie')->assertUnprocessable();

        $this->dentist()->getJson($this->url('/files'))->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('data.0.notes', 'Roots stable');
        $this->dentist()->getJson($this->url("/files?patient_id={$patient->id}"))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.patient.id', $patient->id);
        $this->dentist()->getJson($this->url('/files?category=lab_result'))->assertOk()->assertJsonCount(1, 'data');
        $this->asUser($this->otherDentist())->getJson($this->url('/files'))->assertOk()->assertJsonCount(0, 'data');
        $this->asUser($this->world['staff'])->getJson($this->url('/files'))->assertForbidden();
    }

    // ------------------------------------------------------------ Follow-ups

    public function test_follow_ups_belong_to_their_dentist_and_the_summary_is_real(): void
    {
        [$patient] = $this->patientWithVisit();
        $make = fn (array $extra = []) => $this->dentist()->postJson($this->url('/follow-ups'), ['patient_id' => $patient->id, 'purpose' => 'Retainer check', 'due_on' => '2026-12-01', ...$extra]);

        $id = $make(['priority' => 'high'])->assertCreated()->assertJsonPath('data.status', 'scheduled')->json('data.id');
        $make()->assertCreated();

        $this->dentist()->getJson($this->url('/follow-ups'))->assertOk()
            ->assertJsonPath('meta.summary.total', 2)->assertJsonPath('meta.summary.high_priority', 1)->assertJsonPath('meta.summary.confirmed', 0);

        $this->dentist()->putJson($this->url("/follow-ups/{$id}"), ['purpose' => 'Retainer check', 'due_on' => '2026-12-02', 'status' => 'confirmed'])->assertOk();
        $this->dentist()->getJson($this->url('/follow-ups'))->assertJsonPath('meta.summary.confirmed', 1);

        // Closed ones stop counting as scheduled.
        $this->dentist()->putJson($this->url("/follow-ups/{$id}"), ['purpose' => 'Retainer check', 'due_on' => '2026-12-02', 'status' => 'completed'])->assertOk();
        $this->dentist()->getJson($this->url('/follow-ups'))->assertJsonPath('meta.summary.total', 1)->assertJsonPath('meta.summary.high_priority', 0);

        $other = $this->otherDentist();
        $this->asUser($other)->getJson($this->url('/follow-ups'))->assertOk()->assertJsonCount(0, 'data');
        $this->asUser($other)->putJson($this->url("/follow-ups/{$id}"), ['purpose' => 'x', 'due_on' => '2026-12-02'])->assertNotFound();
    }

    public function test_digest_announces_todays_visits_and_each_follow_up_once(): void
    {
        [$patient] = $this->patientWithVisit('2026-11-02 14:00');
        FollowUp::forceCreate(['clinic_id' => $this->world['clinic']->id, 'patient_id' => $patient->id, 'dentist_id' => $this->world['dentist']->id, 'purpose' => 'Check', 'due_on' => '2026-11-04']);
        FollowUp::forceCreate(['clinic_id' => $this->world['clinic']->id, 'patient_id' => $patient->id, 'dentist_id' => $this->world['dentist']->id, 'purpose' => 'Later', 'due_on' => '2027-01-01']);

        Notification::fake();
        Artisan::call('dentists:send-digest');
        Notification::assertSentTo($this->world['dentistUser'], PortalNotice::class, fn ($n) => $n->noticeTitle === 'Appointment Reminder');
        Notification::assertSentToTimes($this->world['dentistUser'], PortalNotice::class, 2);

        Artisan::call('dentists:send-digest');
        // Today's reminder again, but no second follow-up notice.
        Notification::assertSentToTimes($this->world['dentistUser'], PortalNotice::class, 3);
    }

    // ------------------------------------------------------------ Schedule and profile

    private function changeBody(array $extra = []): array
    {
        return ['days' => [1, 2], 'starts_at' => '08:00', 'ends_at' => '12:00', 'branch_id' => $this->world['branch']->id, ...$extra];
    }

    public function test_a_dentists_schedule_change_applies_only_after_approval(): void
    {
        $changes = $this->url('/dentist/schedule/changes');
        $before = $this->world['dentist']->schedules()->count();

        Notification::fake();
        $id = $this->dentist()->postJson($changes, $this->changeBody(['note' => 'Afternoon classes']))->assertCreated()->assertJsonPath('data.status', 'pending')->json('data.id');
        Notification::assertSentTo($this->world['admin'], PortalNotice::class, fn ($n) => $n->noticeTitle === 'Schedule approval needed');

        // Nothing moved yet: bookings still follow the current hours.
        $this->assertSame($before, $this->world['dentist']->schedules()->count());
        $this->dentist()->getJson($this->url('/dentist/schedule'))->assertOk()
            ->assertJsonPath('data.days', [0, 1, 2, 3, 4, 5, 6])
            ->assertJsonPath('data.pending_change.id', $id)
            ->assertJsonPath('data.pending_change.days', [1, 2]);

        $this->asUser($this->world['admin'])->postJson($this->url("/schedule-changes/{$id}/approve"))->assertOk()->assertJsonPath('data.status', 'approved');
        Notification::assertSentTo($this->world['dentistUser'], PortalNotice::class, fn ($n) => $n->noticeTitle === 'Schedule change approved');

        $this->dentist()->getJson($this->url('/dentist/schedule'))->assertOk()
            ->assertJsonPath('data.days', [1, 2])
            ->assertJsonPath('data.starts_at', '08:00')
            ->assertJsonPath('data.ends_at', '12:00')
            ->assertJsonPath('data.pending_change', null)
            ->assertJsonPath('data.last_decision.status', 'approved');

        // A decided request cannot be decided again.
        $this->asUser($this->world['admin'])->postJson($this->url("/schedule-changes/{$id}/approve"))->assertConflict();
        $this->asUser($this->world['admin'])->postJson($this->url("/schedule-changes/{$id}/reject"), ['reason' => 'x'])->assertConflict();
    }

    public function test_only_those_who_manage_schedules_can_decide_and_dentists_cannot_approve_their_own(): void
    {
        $id = $this->dentist()->postJson($this->url('/dentist/schedule/changes'), $this->changeBody())->assertCreated()->json('data.id');

        $this->dentist()->postJson($this->url("/schedule-changes/{$id}/approve"))->assertForbidden();
        $this->dentist()->getJson($this->url('/schedule-changes'))->assertForbidden();
        $this->asUser($this->world['staff'])->postJson($this->url("/schedule-changes/{$id}/approve"))->assertForbidden();
        $this->dentist()->putJson($this->url('/dentist/schedule'), $this->changeBody())->assertStatus(405);
        $this->dentist()->putJson($this->url("/dentists/{$this->world['dentist']->id}/schedules"), ['schedules' => []])->assertForbidden();

        $other = $this->makeClinic();
        $this->asUser($other['admin'])->postJson($this->manage($other, "/schedule-changes/{$id}/approve"))->assertNotFound();
        $this->assertSame(7, $this->world['dentist']->schedules()->count());
    }

    public function test_declining_needs_a_reason_keeps_the_hours_and_tells_the_dentist(): void
    {
        $id = $this->dentist()->postJson($this->url('/dentist/schedule/changes'), $this->changeBody())->assertCreated()->json('data.id');
        $url = $this->url("/schedule-changes/{$id}/reject");

        $this->asUser($this->world['admin'])->postJson($url, [])->assertJsonValidationErrors('reason');

        Notification::fake();
        $this->asUser($this->world['admin'])->postJson($url, ['reason' => 'Clinic is short-staffed on Fridays'])->assertOk()->assertJsonPath('data.status', 'rejected');
        Notification::assertSentTo($this->world['dentistUser'], PortalNotice::class, fn ($n) => str_contains($n->noticeMessage, 'short-staffed'));

        $this->assertSame(7, $this->world['dentist']->schedules()->count());
        $this->dentist()->getJson($this->url('/dentist/schedule'))->assertOk()
            ->assertJsonPath('data.last_decision.status', 'rejected')
            ->assertJsonPath('data.last_decision.review_note', 'Clinic is short-staffed on Fridays');

        // Free to try again.
        $this->dentist()->postJson($this->url('/dentist/schedule/changes'), $this->changeBody())->assertCreated();
    }

    public function test_one_open_request_at_a_time_and_the_dentist_can_cancel_it(): void
    {
        $changes = $this->url('/dentist/schedule/changes');
        $id = $this->dentist()->postJson($changes, $this->changeBody())->assertCreated()->json('data.id');
        $this->dentist()->postJson($changes, $this->changeBody(['days' => [3]]))->assertConflict();

        $this->asUser($this->otherDentist())->deleteJson("{$changes}/{$id}")->assertNotFound();
        $this->dentist()->deleteJson("{$changes}/{$id}")->assertOk();
        $this->dentist()->deleteJson("{$changes}/{$id}")->assertNotFound();
        $this->asUser($this->world['admin'])->postJson($this->url("/schedule-changes/{$id}/approve"))->assertConflict();
        $this->asUser($this->world['admin'])->getJson($this->url('/schedule-changes'))->assertOk()->assertJsonCount(0, 'data');

        $this->dentist()->postJson($changes, $this->changeBody(['days' => [3]]))->assertCreated();
    }

    public function test_approval_warns_about_booked_visits_keeps_them_and_leaves_other_branches_alone(): void
    {
        [, $visit] = $this->patientWithVisit('2026-11-03 16:00'); // A Tuesday, 4 PM.
        $otherBranch = new ClinicBranch(['name' => 'Second', 'address' => 'Road', 'city' => 'Valencia']);
        $otherBranch->clinic_id = $this->world['clinic']->id;
        $otherBranch->save();
        $this->world['dentist']->schedules()->create(['branch_id' => $otherBranch->id, 'day_of_week' => 6, 'starts_at' => '09:00', 'ends_at' => '10:00']);

        $id = $this->dentist()->postJson($this->url('/dentist/schedule/changes'), $this->changeBody())->assertCreated()->json('data.id');
        $this->asUser($this->world['admin'])->getJson($this->url('/schedule-changes'))->assertOk()
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.0.outside_hours', 1)
            ->assertJsonPath('data.0.dentist.name', $this->world['dentistUser']->name);

        $this->asUser($this->world['admin'])->postJson($this->url("/schedule-changes/{$id}/approve"))->assertOk();

        $this->assertTrue($this->world['dentist']->schedules()->where('branch_id', $otherBranch->id)->exists());
        $this->assertSame('pending', $visit->fresh()->status);
        $this->dentist()->getJson($this->url('/dentist/schedule'))->assertJsonPath('data.days', [1, 2, 6])->assertJsonPath('data.summary.working_days', 3);
    }

    public function test_a_dentist_cannot_be_scheduled_at_two_branches_on_the_same_day(): void
    {
        $other = new ClinicBranch(['name' => 'Valencia Branch', 'address' => 'Road', 'city' => 'Valencia']);
        $other->clinic_id = $this->world['clinic']->id;
        $other->save();
        $dentist = $this->world['dentist'];
        $dentist->schedules()->delete();
        $dentist->schedules()->create(['branch_id' => $this->world['branch']->id, 'day_of_week' => 1, 'starts_at' => '08:00', 'ends_at' => '17:00']);
        $dentist->schedules()->create(['branch_id' => $other->id, 'day_of_week' => 2, 'starts_at' => '09:00', 'ends_at' => '16:00']);
        $changes = $this->url('/dentist/schedule/changes');

        // Tuesday belongs to the other branch.
        $response = $this->dentist()->postJson($changes, $this->changeBody(['days' => [1, 2]]))->assertUnprocessable();
        $this->assertStringContainsString('Valencia Branch on Tue', $response->json('message'));

        $this->dentist()->getJson($this->url('/dentist/schedule'))->assertOk()
            ->assertJsonPath('data.days', [1, 2])
            ->assertJsonPath('data.branches.0.days', [1])
            ->assertJsonPath('data.branches.1.name', 'Valencia Branch')
            ->assertJsonPath('data.branches.1.days', [2])
            ->assertJsonPath('data.branches.1.starts_at', '09:00');

        // Fine when sent; by approval the admin has given that day to the other branch.
        $id = $this->dentist()->postJson($changes, $this->changeBody(['days' => [1, 3]]))->assertCreated()->assertJsonPath('data.branch.id', $this->world['branch']->id)->json('data.id');
        $dentist->schedules()->create(['branch_id' => $other->id, 'day_of_week' => 3, 'starts_at' => '09:00', 'ends_at' => '16:00']);
        $this->asUser($this->world['admin'])->postJson($this->url("/schedule-changes/{$id}/approve"))->assertConflict();
        $this->assertSame(1, $dentist->schedules()->where('branch_id', $this->world['branch']->id)->count());
    }

    public function test_change_requests_are_checked_for_sense(): void
    {
        $changes = $this->url('/dentist/schedule/changes');
        $this->dentist()->postJson($changes, $this->changeBody(['starts_at' => '12:00', 'ends_at' => '08:00']))->assertJsonValidationErrors('ends_at');
        $this->dentist()->postJson($changes, $this->changeBody(['days' => [9]]))->assertJsonValidationErrors('days.0');
        // The hours they already have.
        $this->dentist()->postJson($changes, $this->changeBody(['days' => [0, 1, 2, 3, 4, 5, 6], 'starts_at' => '08:00', 'ends_at' => '17:00']))->assertUnprocessable();
    }

    public function test_a_message_reaches_the_admin_and_admin_edits_reach_the_dentist(): void
    {
        Notification::fake();
        $this->dentist()->postJson($this->url('/dentist/schedule/request-change'), ['message' => 'Off on Friday'])->assertOk();
        Notification::assertSentTo($this->world['admin'], PortalNotice::class, fn ($n) => str_contains($n->noticeMessage, 'Off on Friday'));

        $this->asUser($this->world['admin'])->putJson($this->url("/dentists/{$this->world['dentist']->id}/schedules"), ['schedules' => []])->assertOk();
        Notification::assertSentTo($this->world['dentistUser'], PortalNotice::class, fn ($n) => $n->noticeTitle === 'Schedule Update');
    }

    public function test_dentist_edits_their_profile_but_not_their_licence(): void
    {
        $this->dentist()->putJson($this->url('/dentist/profile'), [
            'name' => 'Dr. New Name', 'phone' => '+63 912', 'address' => 'Poblacion', 'education' => 'UST', 'bio' => 'About me',
            'license_number' => 'FORGED', 'ptr_number' => 'FORGED', 'email' => 'forged@example.com',
        ])->assertOk()->assertJsonPath('data.name', 'Dr. New Name')->assertJsonPath('data.phone', '+63 912')->assertJsonPath('data.education', 'UST');

        $fresh = $this->world['dentist']->fresh();
        $this->assertSame('PRC-D-1', $fresh->license_number);
        $this->assertNull($fresh->ptr_number);
        $this->assertNotSame('forged@example.com', $this->world['dentistUser']->fresh()->email);

        $this->asUser($this->world['admin'])->putJson($this->url("/dentists/{$fresh->id}"), ['ptr_number' => 'PTR-1', 's2_number' => 'S2-1'])->assertOk()
            ->assertJsonPath('data.ptr_number', 'PTR-1');
        $this->dentist()->getJson($this->url('/dentist/profile'))->assertOk()->assertJsonPath('data.s2_number', 'S2-1');
    }

    public function test_medical_flag_tells_the_treating_dentist_without_the_clinical_detail(): void
    {
        [$patient] = $this->patientWithVisit();

        Notification::fake();
        $this->asUser($this->world['admin'])->postJson($this->url("/patients/{$patient->id}/medical-history"), ['allergies' => 'Ibuprofen'])->assertCreated();

        Notification::assertSentTo($this->world['dentistUser'], PortalNotice::class, fn ($n) => str_contains($n->noticeMessage, 'new allergy note') && ! str_contains($n->noticeMessage, 'Ibuprofen'));
    }

    public function test_patient_list_gives_the_flags_only_to_those_who_read_records(): void
    {
        [$patient] = $this->patientWithVisit();
        $this->dentist()->postJson($this->url("/patients/{$patient->id}/medical-history"), ['allergies' => 'Penicillin', 'conditions' => 'Hypertension'])->assertCreated();

        $this->dentist()->getJson($this->url('/patients'))->assertOk()
            ->assertJsonPath('data.0.allergies', 'Penicillin')->assertJsonPath('data.0.conditions', 'Hypertension');
        $this->asUser($this->world['staff'])->getJson($this->url('/patients'))->assertOk()
            ->assertJsonPath('data.0.allergies', null)->assertJsonPath('data.0.conditions', null);
    }
}
