<?php

namespace Tests\Feature\Appointments;

use App\Models\Appointment;
use App\Models\ScheduleBlock;
use App\Notifications\AppointmentUpdated;
use App\Notifications\ClinicAppointmentActivity;
use App\Support\BusinessTime;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Support\ClinicWorld;
use Tests\TestCase;

class BookingTest extends TestCase
{
    use ClinicWorld, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->freezeClock();
    }

    public function test_patient_books_an_available_slot(): void
    {
        Notification::fake();
        $world = $this->makeClinic();
        $patient = $this->makePatient();

        $this->book($patient, $world)
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.starts_at', '2026-11-03T09:00:00+08:00')
            ->assertJsonPath('data.appointment_date', '2026-11-03')
            ->assertJsonPath('data.appointment_time', '09:00')
            ->assertJsonPath('data.service.duration_minutes', 30)
            ->assertJsonMissingPath('data.patient');

        $appointment = Appointment::first();
        $this->assertSame('2026-11-03 01:00:00', $appointment->starts_at->utc()->format('Y-m-d H:i:s'), 'stored as UTC');
        $this->assertSame(1, $appointment->statusHistory()->count());
        $this->assertTrue($world['clinic']->patients()->whereKey($patient->patient->id)->exists());

        Notification::assertSentTo($patient, AppointmentUpdated::class);
        Notification::assertSentTo($world['staff'], ClinicAppointmentActivity::class);
        // The dentist whose patient it is hears about it too; other dentists do not.
        Notification::assertSentTo($world['dentistUser'], ClinicAppointmentActivity::class);
    }

    public function test_same_dentist_slot_cannot_be_booked_twice(): void
    {
        $world = $this->makeClinic();
        $this->book($this->makePatient(), $world)->assertCreated();

        $this->book($this->makePatient(), $world)->assertStatus(409)->assertJsonPath('success', false);
        // Overlapping but not identical start (service is 30 min; 09:15 is off-grid anyway).
        $this->book($this->makePatient(), $world, '2026-11-03 09:15')->assertStatus(409);
        $this->assertSame(1, Appointment::count());
    }

    public function test_cancelled_slot_becomes_available_again(): void
    {
        $world = $this->makeClinic();
        $first = $this->makePatient();
        $id = $this->book($first, $world)->json('data.id');
        $this->asUser($first)->postJson("/api/patient/appointments/{$id}/cancel")->assertOk();

        $this->book($this->makePatient(), $world)->assertCreated();
    }

    public function test_idempotency_key_prevents_duplicate_bookings(): void
    {
        $world = $this->makeClinic();
        $patient = $this->makePatient();

        $first = $this->book($patient, $world, headers: ['Idempotency-Key' => 'retry-123'])->assertCreated();
        $retry = $this->book($patient, $world, headers: ['Idempotency-Key' => 'retry-123'])->assertOk();

        $this->assertSame($first->json('data.id'), $retry->json('data.id'));
        $this->assertSame(1, Appointment::count());
    }

    public function test_patient_cannot_hold_two_overlapping_appointments(): void
    {
        $world = $this->makeClinic();
        $other = $this->makeClinic();
        $patient = $this->makePatient();

        $this->book($patient, $world)->assertCreated();
        $this->book($patient, $other)->assertStatus(409)->assertJsonPath('message', 'You already have an appointment at that time.');
    }

    public function test_times_outside_hours_blocks_holidays_and_notice_are_rejected(): void
    {
        $world = $this->makeClinic();
        $patient = $this->makePatient();

        $this->book($patient, $world, '2026-11-03 07:30')->assertStatus(409); // before opening
        $this->book($patient, $world, '2026-11-03 16:45')->assertStatus(409); // would end after closing
        $this->book($patient, $world, '2026-11-02 08:30')->assertStatus(409); // inside minimum notice
        $this->book($patient, $world, '2027-06-01 09:00')->assertStatus(409); // beyond max days ahead

        $world['clinic']->holidays()->create(['date' => '2026-11-04', 'name' => 'Clinic anniversary']);
        $this->book($patient, $world, '2026-11-04 09:00')->assertStatus(409);

        $block = new ScheduleBlock([
            'dentist_id' => $world['dentist']->id,
            'starts_at' => BusinessTime::utc(BusinessTime::parse('2026-11-05 10:00')),
            'ends_at' => BusinessTime::utc(BusinessTime::parse('2026-11-05 12:00')),
        ]);
        $block->clinic_id = $world['clinic']->id;
        $block->save();
        $this->book($patient, $world, '2026-11-05 11:00')->assertStatus(409);
        $this->book($patient, $world, '2026-11-05 12:00')->assertCreated();
    }

    public function test_dentist_service_or_branch_from_another_clinic_is_rejected(): void
    {
        $world = $this->makeClinic();
        $other = $this->makeClinic();

        $this->asUser($this->makePatient())->postJson('/api/patient/appointments', [
            'clinic_id' => $world['clinic']->id,
            'service_rate_id' => $world['service']->id,
            'dentist_id' => $other['dentist']->id, // forged: works elsewhere
            'branch_id' => $world['branch']->id,
            'starts_at' => '2026-11-03 09:00',
        ])->assertStatus(422);
    }

    public function test_unlisted_or_suspended_clinic_cannot_be_booked(): void
    {
        $world = $this->makeClinic(['status' => 'suspended']);

        $this->book($this->makePatient(), $world)->assertNotFound();
    }

    public function test_availability_lists_open_slots_and_hides_taken_ones(): void
    {
        $world = $this->makeClinic();
        $this->book($this->makePatient(), $world)->assertCreated();

        $slots = $this->getJson("/api/clinics/{$world['clinic']->id}/availability?date=2026-11-03&service_rate_id={$world['service']->id}")
            ->assertOk()
            ->assertJsonPath('meta.timezone', 'Asia/Manila')
            ->json('data');

        $times = array_column($slots, 'time');
        $this->assertContains('08:00', $times);
        $this->assertNotContains('09:00', $times);
        $this->assertContains('16:30', $times);
        $this->assertNotContains('17:00', $times);
    }

    public function test_available_dates_follow_schedule_holidays_and_window(): void
    {
        $world = $this->makeClinic();
        // Dentist works weekdays only at this clinic.
        $world['dentist']->schedules()->whereIn('day_of_week', [0, 6])->delete();
        $world['clinic']->holidays()->create(['date' => '2026-11-04', 'name' => 'Holiday']);

        $dates = $this->getJson("/api/clinics/{$world['clinic']->id}/available-dates?service_rate_id={$world['service']->id}&from=2026-11-01&to=2026-11-09")
            ->assertOk()->json('data');

        // Nov 1 is past, Nov 4 a holiday, Nov 7-8 the weekend.
        $this->assertSame(['2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06', '2026-11-09'], $dates);
    }

    public function test_patient_cannot_see_or_change_another_patients_appointment(): void
    {
        $world = $this->makeClinic();
        $owner = $this->makePatient();
        $intruder = $this->makePatient();
        $id = $this->book($owner, $world)->json('data.id');

        $this->asUser($intruder)->getJson("/api/patient/appointments/{$id}")->assertNotFound();
        $this->asUser($intruder)->postJson("/api/patient/appointments/{$id}/cancel")->assertNotFound();
        $this->asUser($intruder)->putJson("/api/patient/appointments/{$id}", ['starts_at' => '2026-11-03 10:00'])->assertNotFound();
        $this->asUser($intruder)->getJson('/api/patient/appointments')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_patient_cannot_cancel_inside_the_cutoff(): void
    {
        $world = $this->makeClinic();
        $patient = $this->makePatient();
        $id = $this->book($patient, $world, '2026-11-02 15:00')->json('data.id');

        $this->asUser($patient)->postJson("/api/patient/appointments/{$id}/cancel")->assertStatus(409);
    }

    public function test_pending_appointment_moves_directly_when_patient_reschedules(): void
    {
        $world = $this->makeClinic();
        $patient = $this->makePatient();
        $id = $this->book($patient, $world)->json('data.id');

        $this->asUser($patient)->putJson("/api/patient/appointments/{$id}", ['appointment_date' => '2026-11-04', 'appointment_time' => '10:00'])
            ->assertOk()
            ->assertJsonPath('data.status', 'pending')
            ->assertJsonPath('data.starts_at', '2026-11-04T10:00:00+08:00');
    }

    public function test_confirmed_appointment_reschedule_needs_clinic_approval(): void
    {
        $world = $this->makeClinic();
        $patient = $this->makePatient();
        $id = $this->book($patient, $world)->json('data.id');
        $this->asUser($world['staff'])->postJson($this->manage($world, "/appointments/{$id}/confirm"))->assertOk();

        $this->asUser($patient)->putJson("/api/patient/appointments/{$id}", ['starts_at' => '2026-11-04 10:00'])
            ->assertOk()
            ->assertJsonPath('data.status', 'reschedule_requested')
            ->assertJsonPath('data.starts_at', '2026-11-03T09:00:00+08:00')
            ->assertJsonPath('data.requested_starts_at', '2026-11-04T10:00:00+08:00');

        $this->asUser($world['staff'])->postJson($this->manage($world, "/appointments/{$id}/approve-reschedule"))
            ->assertOk()
            ->assertJsonPath('data.status', 'confirmed')
            ->assertJsonPath('data.starts_at', '2026-11-04T10:00:00+08:00');
    }

    public function test_non_patient_accounts_cannot_book(): void
    {
        $world = $this->makeClinic();

        $this->book($world['staff'], $world)->assertForbidden();
    }
}
