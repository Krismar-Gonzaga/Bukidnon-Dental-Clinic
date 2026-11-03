<?php

namespace Tests\Feature\Clinics;

use App\Models\Clinic;
use App\Models\ClinicApplication;
use App\Models\User;
use App\Notifications\ClinicApplicationDecided;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Tests\Support\ClinicWorld;
use Tests\TestCase;

class ClinicApplicationTest extends TestCase
{
    use ClinicWorld, RefreshDatabase;

    private User $owner;

    private User $sysadmin;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        $this->owner = User::factory()->role('clinic_admin')->create();
        $this->sysadmin = User::factory()->role('system_admin')->create();
    }

    private function draft(): int
    {
        return $this->asUser($this->owner)->postJson('/api/clinic-applications', [
            'clinic_name' => 'Quezon Family Dental',
            'address' => 'Purok 3, Poblacion',
            'city' => 'Quezon',
            'contact_number' => '09175550000',
            'representative_name' => 'Dr. Ana Reyes',
        ])->assertCreated()->assertJsonPath('data.status', 'draft')->json('data.id');
    }

    private function uploadAll(int $id): void
    {
        foreach (ClinicApplication::REQUIRED_DOCUMENTS as $type) {
            $this->asUser($this->owner)->post("/api/clinic-applications/{$id}/documents", [
                'document_type' => $type,
                'file' => UploadedFile::fake()->create("{$type}.pdf", 200, 'application/pdf'),
            ], ['Accept' => 'application/json'])->assertCreated();
        }
    }

    public function test_full_application_approval_creates_clinic_branch_and_admin_membership(): void
    {
        Notification::fake();
        $id = $this->draft();

        $this->asUser($this->owner)->postJson("/api/clinic-applications/{$id}/submit")->assertStatus(422);
        $this->uploadAll($id);
        $this->asUser($this->owner)->postJson("/api/clinic-applications/{$id}/submit")->assertOk()->assertJsonPath('data.status', 'pending');
        $this->asUser($this->owner)->putJson("/api/clinic-applications/{$id}", ['clinic_name' => 'Changed'])->assertStatus(409);

        $this->asUser($this->sysadmin)->postJson("/api/admin/clinic-applications/{$id}/start-review")->assertOk()->assertJsonPath('data.status', 'under_review');
        $this->asConfirmedAdmin($this->sysadmin)->postJson("/api/admin/clinic-applications/{$id}/approve", ['notes' => 'Documents verified'])->assertOk();

        $clinic = Clinic::firstWhere('name', 'Quezon Family Dental');
        $this->assertSame('approved', $clinic->status);
        $this->assertFalse($clinic->is_published, 'listed only after the owner publishes');
        $this->assertTrue($clinic->branches()->where('is_main', true)->exists());
        $this->assertTrue($this->owner->hasClinicPermission($clinic, 'clinic.profile.manage'));
        Notification::assertSentTo($this->owner, ClinicApplicationDecided::class);

        // Publishing requires at least one service.
        $this->asUser($this->owner)->putJson("/api/manage/clinics/{$clinic->id}/publish", ['is_published' => true])->assertStatus(422);
    }

    public function test_admins_search_the_queue_and_keep_internal_notes_in_the_review_history(): void
    {
        $id = $this->draft();
        $this->uploadAll($id);
        $this->asUser($this->owner)->postJson("/api/clinic-applications/{$id}/submit")->assertOk();

        $this->asUser($this->sysadmin)->getJson('/api/admin/clinic-applications?search=quezon')->assertOk()->assertJsonCount(1, 'data');
        $this->asUser($this->sysadmin)->getJson('/api/admin/clinic-applications?search=nowhere')->assertOk()->assertJsonCount(0, 'data');

        $this->asUser($this->sysadmin)->postJson("/api/admin/clinic-applications/{$id}/start-review")->assertOk();
        $this->asUser($this->sysadmin)->postJson("/api/admin/clinic-applications/{$id}/notes", ['note' => ''])->assertStatus(422);
        $this->asUser($this->sysadmin)->postJson("/api/admin/clinic-applications/{$id}/notes", ['note' => 'Permit number checked with LGU'])
            ->assertCreated();

        $history = $this->asUser($this->sysadmin)->getJson("/api/admin/clinic-applications/{$id}")->assertOk()->json('data.history');
        $actions = array_column($history, 'action');
        $this->assertSame('clinic_application.submitted', $actions[count(ClinicApplication::REQUIRED_DOCUMENTS)]);
        $this->assertContains('clinic_application.review_started', $actions);
        $note = collect($history)->firstWhere('action', 'clinic_application.note_added');
        $this->assertSame('Permit number checked with LGU', $note['note']);
        $this->assertSame($this->sysadmin->name, $note['actor']);

        // Internal notes never reach the applicant, and only admins can add them.
        $this->asUser($this->owner)->getJson("/api/clinic-applications/{$id}")->assertOk()->assertJsonMissingPath('data.history');
        $this->asUser($this->owner)->postJson("/api/admin/clinic-applications/{$id}/notes", ['note' => 'x'])->assertForbidden();
    }

    public function test_rejected_application_can_be_corrected_and_resubmitted(): void
    {
        $id = $this->draft();
        $this->uploadAll($id);
        $this->asUser($this->owner)->postJson("/api/clinic-applications/{$id}/submit")->assertOk();

        $this->asConfirmedAdmin($this->sysadmin)->postJson("/api/admin/clinic-applications/{$id}/reject")->assertStatus(422); // notes required
        $this->asConfirmedAdmin($this->sysadmin)->postJson("/api/admin/clinic-applications/{$id}/reject", ['notes' => 'DOH license expired'])->assertOk();

        $this->asUser($this->owner)->getJson("/api/clinic-applications/{$id}")->assertJsonPath('data.review_notes', 'DOH license expired');
        $this->asUser($this->owner)->post("/api/clinic-applications/{$id}/documents", [
            'document_type' => 'doh_license',
            'file' => UploadedFile::fake()->create('new.pdf', 100, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonCount(4, 'data.documents');
        $this->asUser($this->owner)->postJson("/api/clinic-applications/{$id}/submit")->assertOk()->assertJsonPath('data.status', 'pending');
    }

    public function test_documents_are_private_and_served_only_through_signed_links(): void
    {
        $id = $this->draft();
        $this->uploadAll($id);
        $documentId = ClinicApplication::find($id)->documents()->first()->id;

        $listing = $this->asUser($this->owner)->getJson("/api/clinic-applications/{$id}")->json('data.documents.0');
        $this->assertArrayNotHasKey('path', $listing);

        $this->getJson("/api/documents/{$documentId}/download")->assertForbidden(); // unsigned

        $url = $this->asUser($this->owner)->getJson("/api/clinic-applications/{$id}/documents/{$documentId}/link")->assertOk()->json('data.url');
        $this->get($url)->assertOk();

        $this->travel(6)->minutes();
        $this->get($url)->assertForbidden(); // expired
    }

    public function test_admin_download_links_are_signed_as_downloads(): void
    {
        $id = $this->draft();
        $this->uploadAll($id);
        $this->asUser($this->owner)->postJson("/api/clinic-applications/{$id}/submit")->assertOk();
        $documentId = ClinicApplication::find($id)->documents()->first()->id;
        $link = "/api/admin/clinic-applications/{$id}/documents/{$documentId}/link";

        $view = $this->asUser($this->sysadmin)->getJson($link)->assertOk()->json('data.url');
        $this->assertStringStartsWith('inline', (string) $this->get($view)->assertOk()->headers->get('Content-Disposition'));

        $download = $this->asUser($this->sysadmin)->getJson("{$link}?download=1")->assertOk()->json('data.url');
        $this->assertStringStartsWith('attachment', (string) $this->get($download)->assertOk()->headers->get('Content-Disposition'));

        // The flag is part of the signature: it cannot be added to a viewing link.
        $this->get("{$view}&download=1")->assertForbidden();
    }

    public function test_only_applicant_and_system_admin_can_reach_an_application(): void
    {
        $id = $this->draft();
        $this->uploadAll($id);
        $this->asUser($this->owner)->postJson("/api/clinic-applications/{$id}/submit")->assertOk();
        $documentId = ClinicApplication::find($id)->documents()->first()->id;

        $stranger = User::factory()->role('clinic_admin')->create();
        $this->asUser($stranger)->getJson("/api/clinic-applications/{$id}")->assertNotFound();
        $this->asUser($stranger)->getJson("/api/clinic-applications/{$id}/documents/{$documentId}/link")->assertNotFound();

        $patient = $this->makePatient();
        $this->asUser($patient)->getJson('/api/admin/clinic-applications')->assertForbidden();
        $this->asUser($patient)->postJson('/api/clinic-applications', ['clinic_name' => 'X'])->assertForbidden();

        $this->asUser($this->sysadmin)->getJson("/api/admin/clinic-applications/{$id}/documents/{$documentId}/link")->assertOk();
    }

    public function test_invalid_file_types_are_rejected(): void
    {
        $id = $this->draft();

        $this->asUser($this->owner)->post("/api/clinic-applications/{$id}/documents", [
            'document_type' => 'business_permit',
            'file' => UploadedFile::fake()->create('permit.exe', 10, 'application/x-msdownload'),
        ], ['Accept' => 'application/json'])->assertStatus(422)->assertJsonValidationErrors('file');

        $this->asUser($this->owner)->post("/api/clinic-applications/{$id}/documents", [
            'document_type' => 'business_permit',
            'file' => UploadedFile::fake()->create('huge.pdf', 6000, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertStatus(422);
    }
}
