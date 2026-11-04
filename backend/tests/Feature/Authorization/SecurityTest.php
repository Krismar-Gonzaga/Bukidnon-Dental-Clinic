<?php

namespace Tests\Feature\Authorization;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\Support\ClinicWorld;
use Tests\TestCase;

/** Object-level access checks (IDOR) and response hardening not covered elsewhere. */
class SecurityTest extends TestCase
{
    use ClinicWorld, RefreshDatabase;

    public function test_clinic_application_and_its_documents_are_private_to_the_applicant(): void
    {
        Storage::fake('local');
        $owner = User::factory()->role('clinic_admin')->create();
        $other = User::factory()->role('clinic_admin')->create();

        $id = $this->asUser($owner)->postJson('/api/clinic-applications', [
            'clinic_name' => 'Quezon Family Dental', 'address' => 'Poblacion', 'city' => 'Quezon',
            'contact_number' => '09175550000', 'representative_name' => 'Dr. Ana Reyes',
        ])->assertCreated()->json('data.id');

        $documentId = $this->asUser($owner)->post("/api/clinic-applications/{$id}/documents", [
            'document_type' => 'business_permit',
            'file' => UploadedFile::fake()->create('permit.pdf', 100, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');

        $this->asUser($other)->getJson("/api/clinic-applications/{$id}")->assertNotFound();
        $this->asUser($other)->putJson("/api/clinic-applications/{$id}", ['clinic_name' => 'Taken'])->assertNotFound();
        $this->asUser($other)->getJson("/api/clinic-applications/{$id}/documents/{$documentId}/link")->assertNotFound();
        $this->asUser($other)->deleteJson("/api/clinic-applications/{$id}/documents/{$documentId}")->assertNotFound();
        $this->asUser($other)->postJson("/api/clinic-applications/{$id}/submit")->assertNotFound();

        // The file itself is only reachable through a signed, expiring link.
        $this->getJson("/api/documents/{$documentId}/download")->assertForbidden();
        $link = $this->asUser($owner)->getJson("/api/clinic-applications/{$id}/documents/{$documentId}/link")
            ->assertOk()->json('data.url');
        $this->app['auth']->forgetGuards();
        $this->get($link)->assertOk();
        $this->travel(6)->minutes();
        $this->get($link)->assertForbidden();
    }

    public function test_users_cannot_read_or_mark_each_others_notifications(): void
    {
        $alice = $this->makePatient();
        $bob = $this->makePatient();
        $notification = $alice->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => 'test',
            'data' => ['kind' => 'test', 'title' => 'Private', 'message' => 'For Alice only'],
        ]);

        $this->asUser($bob)->getJson('/api/notifications')->assertOk()->assertJsonCount(0, 'data');
        $this->asUser($bob)->postJson("/api/notifications/{$notification->id}/read")->assertNotFound();
        $this->assertNull($notification->fresh()->read_at);

        $this->asUser($alice)->getJson('/api/notifications')->assertOk()->assertJsonPath('data.0.title', 'Private');
    }

    public function test_inventory_items_cannot_be_reached_through_another_clinics_url(): void
    {
        $a = $this->makeClinic();
        $b = $this->makeClinic();

        $itemId = $this->asUser($a['admin'])->postJson($this->manage($a, '/inventory/items'), [
            'name' => 'Lidocaine', 'unit' => 'cartridge', 'minimum_stock' => 5,
        ])->assertCreated()->json('data.id');

        // B's admin has inventory rights, but only for B: A's item under B's URL does not exist.
        $this->asUser($b['admin'])->getJson($this->manage($b, "/inventory/items/{$itemId}"))->assertNotFound();
        $this->asUser($b['admin'])->postJson($this->manage($b, "/inventory/items/{$itemId}/movements"), [
            'type' => 'receipt', 'quantity' => 10,
        ])->assertNotFound();
        // And A's URL is not B's clinic.
        $this->asUser($b['admin'])->getJson($this->manage($a, "/inventory/items/{$itemId}"))->assertNotFound();
    }

    public function test_passwords_need_letters_and_numbers(): void
    {
        $payload = fn (string $password) => [
            'name' => 'Juan Dela Cruz', 'email' => 'juan.weak@example.com', 'phone' => '09171234567',
            'address' => 'Valencia City', 'password' => $password, 'password_confirmation' => $password,
        ];

        $this->postJson('/api/register', $payload('onlyletters'))->assertStatus(422)->assertJsonValidationErrors('password');
        $this->postJson('/api/register', $payload('12345678'))->assertStatus(422)->assertJsonValidationErrors('password');
    }

    public function test_api_responses_are_not_cached_or_framed(): void
    {
        $response = $this->getJson('/api/specializations')->assertOk();

        $response->assertHeader('X-Content-Type-Options', 'nosniff');
        $response->assertHeader('X-Frame-Options', 'DENY');
        $response->assertHeader('Referrer-Policy', 'no-referrer');
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
    }

    public function test_server_errors_do_not_leak_details(): void
    {
        config(['app.debug' => false]);
        \Illuminate\Support\Facades\Route::get('/api/_boom', fn () => throw new \RuntimeException('SQLSTATE secret detail'));

        $this->getJson('/api/_boom')
            ->assertStatus(500)
            ->assertJsonPath('message', 'Something went wrong. Please try again later.')
            ->assertDontSee('SQLSTATE');
    }
}
