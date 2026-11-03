<?php

namespace Tests\Feature\Clinics;

use App\Models\Appointment;
use App\Models\Review;
use App\Notifications\ContactMessageReceived;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Tests\Support\ClinicWorld;
use Tests\TestCase;

class GuestSiteTest extends TestCase
{
    use ClinicWorld, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->freezeClock();
    }

    /** A published review of a completed visit with the clinic's dentist. */
    private function reviewedVisit(array $world, int $rating = 5): void
    {
        $patient = $this->makePatient();
        $id = $this->book($patient, $world)->assertCreated()->json('data.id');
        Appointment::whereKey($id)->update(['status' => Appointment::COMPLETED]);
        $review = new Review(['rating' => $rating, 'comment' => 'Great care']);
        $review->forceFill([
            'clinic_id' => $world['clinic']->id,
            'patient_id' => $patient->patient->id,
            'appointment_id' => $id,
            'status' => Review::STATUS_APPROVED,
        ])->save();
    }

    public function test_directory_and_profile_show_real_rating_availability_and_clinic(): void
    {
        $world = $this->makeClinic();
        $this->reviewedVisit($world, 4);

        $row = $this->getJson('/api/dentists')->assertOk()->json('data.0');
        $this->assertEquals(4.0, $row['rating']);
        $this->assertSame(1, $row['review_count']);
        $this->assertTrue($row['is_available']);
        $this->assertSame($world['clinic']->id, $row['clinics'][0]['id']);

        $profile = $this->getJson("/api/dentists/{$world['dentist']->id}")->assertOk()->json('data');
        $this->assertSame($row['name'], $profile['name']);
        $this->assertCount(7, $profile['schedules']);
        $this->assertNotEmpty($profile['clinics'][0]['address']);
        $this->assertArrayNotHasKey('email', $profile);

        $clinic = $this->getJson("/api/clinics/{$world['clinic']->id}")->assertOk()->json('data');
        $this->assertEquals(4.0, $clinic['dentists'][0]['rating']);
        $this->assertTrue($clinic['dentists'][0]['is_available']);
    }

    public function test_dentists_without_hours_are_unavailable_and_hidden_ones_are_not_found(): void
    {
        $world = $this->makeClinic();
        $world['dentist']->schedules()->delete();
        $this->assertFalse($this->getJson('/api/dentists')->assertOk()->json('data.0.is_available'));
        $this->assertNull($this->getJson('/api/dentists')->json('data.0.rating'));

        $world['dentist']->update(['is_active' => false]);
        $this->getJson("/api/dentists/{$world['dentist']->id}")->assertNotFound();
        $world['dentist']->update(['is_active' => true]);

        $world['clinic']->forceFill(['is_published' => false])->save();
        $this->getJson("/api/dentists/{$world['dentist']->id}")->assertNotFound();
        $this->getJson('/api/dentists/999999')->assertNotFound();
    }

    public function test_home_figures_are_counted_from_real_records(): void
    {
        $world = $this->makeClinic();
        $this->reviewedVisit($world, 5);
        $this->reviewedVisit($world, 2);

        $data = $this->getJson('/api/home')->assertOk()->json('data');
        $this->assertSame(1, $data['stats']['verified_clinics']);
        $this->assertSame(1, $data['stats']['municipalities']);
        $this->assertSame(2, $data['stats']['patients']);
        $this->assertSame(50, $data['stats']['satisfaction_rate']);
        $this->assertSame(2, $data['featured_clinics'][0]['review_count']);

        DB::table('reviews')->delete();
        $this->assertNull($this->getJson('/api/home')->json('data.stats.satisfaction_rate'));
    }

    private function message(array $overrides = []): array
    {
        return $overrides + ['first_name' => 'Juan', 'last_name' => 'Dela Cruz', 'email' => 'juan@example.com', 'subject' => 'Clinic hours', 'message' => 'Are you open on holidays?'];
    }

    public function test_contact_form_emails_support_and_records_only_that_it_arrived(): void
    {
        Notification::fake();
        config(['mail.contact_address' => 'support@example.test']);

        $this->postJson('/api/contact', $this->message())->assertCreated();

        Notification::assertSentOnDemand(ContactMessageReceived::class, function ($notification, $channels, AnonymousNotifiable $notifiable) {
            $mail = $notification->toMail($notifiable);

            return $notifiable->routes['mail'] === 'support@example.test'
                && $mail->replyTo[0][0] === 'juan@example.com'
                && in_array('Are you open on holidays?', $mail->introLines, true);
        });
        $this->assertDatabaseHas('audit_logs', ['action' => 'contact.message_received']);
        $this->assertStringNotContainsString('holidays', (string) DB::table('audit_logs')->where('action', 'contact.message_received')->value('metadata'));
    }

    public function test_contact_form_validates_and_stops_bots_quietly(): void
    {
        Notification::fake();

        $this->postJson('/api/contact', $this->message(['email' => 'not-an-email']))->assertStatus(422);
        $this->postJson('/api/contact', $this->message(['subject' => "Hello\r\nBcc: x@example.com"]))->assertStatus(422);
        $this->postJson('/api/contact', ['first_name' => 'Juan'])->assertStatus(422);

        // The hidden field filled in: looks fine to the bot, nothing is sent.
        $this->postJson('/api/contact', $this->message(['website' => 'http://spam.example']))->assertCreated();
        Notification::assertNothingSent();
    }

    public function test_contact_form_is_rate_limited(): void
    {
        Notification::fake();
        foreach (range(1, 5) as $ignored) {
            $this->postJson('/api/contact', $this->message())->assertCreated();
        }
        $this->postJson('/api/contact', $this->message())->assertStatus(429);
    }
}
