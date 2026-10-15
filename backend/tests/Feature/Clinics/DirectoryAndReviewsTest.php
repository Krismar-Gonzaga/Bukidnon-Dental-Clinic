<?php

namespace Tests\Feature\Clinics;

use App\Models\Appointment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\ClinicWorld;
use Tests\TestCase;

class DirectoryAndReviewsTest extends TestCase
{
    use ClinicWorld, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->freezeClock();
    }

    public function test_directory_lists_only_approved_published_clinics(): void
    {
        $listed = $this->makeClinic(['name' => 'Listed Dental']);
        $this->makeClinic(['name' => 'Hidden Dental', 'is_published' => false]);
        $this->makeClinic(['name' => 'Suspended Dental', 'status' => 'suspended']);

        $names = array_column($this->getJson('/api/clinics/search')->assertOk()->json('data.data'), 'name');
        $this->assertSame(['Listed Dental'], $names);

        $this->getJson("/api/clinics/{$listed['clinic']->id}")->assertOk()
            ->assertJsonPath('data.services.0.name', 'Dental Cleaning')
            ->assertJsonPath('data.branches.0.operating_hours.0.opens_at', '08:00')
            ->assertJsonPath('data.dentists.0.name', $listed['dentistUser']->name)
            ->assertJsonMissingPath('data.dentists.0.email');

        $hidden = \App\Models\Clinic::firstWhere('name', 'Hidden Dental');
        $this->getJson("/api/clinics/{$hidden->id}")->assertNotFound();
    }

    public function test_directory_filters_by_service_and_search(): void
    {
        $this->makeClinic(['name' => 'Alpha Dental', 'city' => 'Valencia City']);
        $this->makeClinic(['name' => 'Beta Dental', 'city' => 'Malaybalay City']);

        $this->assertCount(1, $this->getJson('/api/clinics/search?search=alpha')->json('data.data'));
        $this->assertCount(1, $this->getJson('/api/clinics/search?city=Malaybalay%20City')->json('data.data'));
        $this->assertCount(2, $this->getJson('/api/clinics/search?service=cleaning')->json('data.data'));
        $this->assertCount(0, $this->getJson('/api/clinics/search?service=implant')->json('data.data'));
        $this->getJson('/api/clinics/search?sort=reviews')->assertOk();

        $services = $this->getJson('/api/services')->assertOk()->json('data');
        $this->assertEquals(800, $services[0]['price_min']);
        $this->assertSame(2, $services[0]['clinic_count']);
    }

    private function completedAppointment(array $world, User $patient): int
    {
        $id = $this->book($patient, $world)->json('data.id');
        Appointment::whereKey($id)->update(['status' => Appointment::COMPLETED]);

        return $id;
    }

    public function test_patient_reviews_a_completed_appointment_once(): void
    {
        $world = $this->makeClinic();
        $patient = $this->makePatient();
        $pendingId = $this->book($patient, $world, '2026-11-04 09:00')->json('data.id');
        $doneId = $this->completedAppointment($world, $patient);

        $this->asUser($patient)->getJson('/api/patient/reviews/eligible')->assertOk()->assertJsonCount(1, 'data');
        $this->asUser($patient)->postJson("/api/patient/appointments/{$pendingId}/review", ['rating' => 5])->assertStatus(409);
        $this->asUser($patient)->postJson("/api/patient/appointments/{$doneId}/review", ['rating' => 6])->assertStatus(422);
        $this->asUser($patient)->postJson("/api/patient/appointments/{$doneId}/review", ['rating' => 4, 'comment' => 'Gentle and on time'])->assertCreated();
        $this->asUser($patient)->postJson("/api/patient/appointments/{$doneId}/review", ['rating' => 1])->assertStatus(409);

        $this->assertSame('4.0', $world['clinic']->fresh()->rating_stars);
        $this->getJson("/api/clinics/{$world['clinic']->id}/reviews")->assertOk()->assertJsonPath('data.0.comment', 'Gentle and on time');
    }

    public function test_patient_cannot_review_someone_elses_appointment(): void
    {
        $world = $this->makeClinic();
        $doneId = $this->completedAppointment($world, $this->makePatient());

        $this->asUser($this->makePatient())->postJson("/api/patient/appointments/{$doneId}/review", ['rating' => 1])->assertNotFound();
    }

    public function test_reported_review_can_be_hidden_by_moderation_with_audit_trail(): void
    {
        $world = $this->makeClinic();
        $patient = $this->makePatient();
        $doneId = $this->completedAppointment($world, $patient);
        $reviewId = $this->asUser($patient)->postJson("/api/patient/appointments/{$doneId}/review", ['rating' => 1, 'comment' => 'Spam link'])->json('data.id');

        $this->asUser($world['admin'])->postJson($this->manage($world, "/reviews/{$reviewId}/report"), ['reason' => 'Spam'])->assertCreated();

        $sysadmin = User::factory()->role('system_admin')->create();
        $this->asUser($sysadmin)->getJson('/api/admin/reviews')->assertOk()->assertJsonPath('data.0.open_reports', 1);
        $this->asUser($sysadmin)->postJson("/api/admin/reviews/{$reviewId}/moderate", ['status' => 'rejected', 'note' => 'Spam content'])->assertOk();

        $this->getJson("/api/clinics/{$world['clinic']->id}/reviews")->assertJsonCount(0, 'data');
        $this->assertDatabaseHas('reviews', ['id' => $reviewId, 'status' => 'rejected', 'moderated_by' => $sysadmin->id]);
        $this->assertDatabaseHas('audit_logs', ['action' => 'review.moderated', 'subject_id' => $reviewId]);
    }
}
