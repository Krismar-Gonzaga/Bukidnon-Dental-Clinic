<?php

namespace Tests\Feature\Appointments;

use App\Models\Appointment;
use App\Models\ClinicMembership;
use App\Models\Dentist;
use App\Models\User;
use App\Notifications\AppointmentUpdated;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Support\ClinicWorld;
use Tests\TestCase;

class ClinicWorkflowTest extends TestCase
{
    use ClinicWorld, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->freezeClock();
    }

    public function test_full_lifecycle_with_history_and_patient_notifications(): void
    {
        $world = $this->makeClinic();
        $patient = $this->makePatient();
        $id = $this->book($patient, $world)->json('data.id');
        Notification::fake();

        $this->asUser($world['staff'])->postJson($this->manage($world, "/appointments/{$id}/confirm"))->assertOk()->assertJsonPath('data.status', 'confirmed');
        $this->asUser($world['staff'])->postJson($this->manage($world, "/appointments/{$id}/check-in"))->assertOk();
        $this->asUser($world['dentistUser'])->postJson($this->manage($world, "/appointments/{$id}/start"))->assertOk();
        $this->asUser($world['dentistUser'])->postJson($this->manage($world, "/appointments/{$id}/complete"))->assertOk()->assertJsonPath('data.status', 'completed');

        $history = $this->asUser($world['staff'])->getJson($this->manage($world, "/appointments/{$id}"))
            ->assertOk()
            ->assertJsonPath('data.patient.name', $patient->name)
            ->json('data.status_history');
        $this->assertSame(['pending', 'confirmed', 'checked_in', 'in_progress', 'completed'], array_column($history, 'to'));

        Notification::assertSentTo($patient, AppointmentUpdated::class, fn ($n) => $n->event === 'confirmed');
        Notification::assertSentTo($patient, AppointmentUpdated::class, fn ($n) => $n->event === 'completed');
    }

    public function test_invalid_transitions_are_rejected(): void
    {
        $world = $this->makeClinic();
        $id = $this->book($this->makePatient(), $world)->json('data.id');

        $this->asUser($world['staff'])->postJson($this->manage($world, "/appointments/{$id}/complete"))->assertStatus(409);
        $this->asUser($world['staff'])->postJson($this->manage($world, "/appointments/{$id}/reject"))->assertStatus(422); // reason required
        $this->asUser($world['staff'])->postJson($this->manage($world, "/appointments/{$id}/reject"), ['reason' => 'Fully booked'])->assertOk();
        $this->asUser($world['staff'])->postJson($this->manage($world, "/appointments/{$id}/confirm"))->assertStatus(409);

        $this->assertSame('rejected', Appointment::find($id)->status);
    }

    public function test_dentist_only_sees_and_progresses_their_own_appointments(): void
    {
        $world = $this->makeClinic();
        $otherDentistUser = User::factory()->role('dentist')->memberOf($world['clinic'], ClinicMembership::ROLE_DENTIST)->create();
        $otherDentist = new Dentist(['is_active' => true]);
        $otherDentist->user_id = $otherDentistUser->id;
        $otherDentist->save();
        foreach (range(0, 6) as $day) {
            $otherDentist->schedules()->create(['branch_id' => $world['branch']->id, 'day_of_week' => $day, 'starts_at' => '08:00', 'ends_at' => '17:00']);
        }

        $mine = $this->book($this->makePatient(), $world)->json('data.id');
        $theirs = $this->asUser($this->makePatient())->postJson('/api/patient/appointments', [
            'clinic_id' => $world['clinic']->id, 'service_rate_id' => $world['service']->id,
            'dentist_id' => $otherDentist->id, 'branch_id' => $world['branch']->id, 'starts_at' => '2026-11-03 09:00',
        ])->assertCreated()->json('data.id');

        $list = $this->asUser($world['dentistUser'])->getJson($this->manage($world, '/appointments'))->assertOk()->json('data');
        $this->assertSame([$mine], array_column($list, 'id'));

        $this->asUser($world['dentistUser'])->getJson($this->manage($world, "/appointments/{$theirs}"))->assertNotFound();
        $this->asUser($world['dentistUser'])->postJson($this->manage($world, "/appointments/{$theirs}/complete"))->assertNotFound();
        // Dentists answer requests made to them, but cancelling stays with the front desk.
        $this->asUser($world['dentistUser'])->postJson($this->manage($world, "/appointments/{$mine}/cancel"), ['reason' => 'x'])->assertForbidden();
    }

    public function test_staff_of_another_clinic_cannot_reach_this_clinics_appointments(): void
    {
        $world = $this->makeClinic();
        $other = $this->makeClinic();
        $id = $this->book($this->makePatient(), $world)->json('data.id');

        // Their own clinic id with our appointment id → not found (scoped).
        $this->asUser($other['staff'])->getJson($this->manage($other, "/appointments/{$id}"))->assertNotFound();
        $this->asUser($other['staff'])->postJson($this->manage($other, "/appointments/{$id}/confirm"))->assertNotFound();
        // Our clinic id (forged) → not a member → not found.
        $this->asUser($other['staff'])->getJson($this->manage($world, '/appointments'))->assertNotFound();
    }

    public function test_staff_reschedule_validates_the_new_slot(): void
    {
        $world = $this->makeClinic();
        $a = $this->book($this->makePatient(), $world)->json('data.id');
        $this->book($this->makePatient(), $world, '2026-11-03 10:00')->assertCreated();

        $this->asUser($world['staff'])->postJson($this->manage($world, "/appointments/{$a}/reschedule"), ['starts_at' => '2026-11-03 10:00'])->assertStatus(409);
        $this->asUser($world['staff'])->postJson($this->manage($world, "/appointments/{$a}/reschedule"), ['starts_at' => '2026-11-03 11:00'])
            ->assertOk()->assertJsonPath('data.starts_at', '2026-11-03T11:00:00+08:00');
    }

    public function test_staff_can_book_for_a_registered_walk_in_patient(): void
    {
        $world = $this->makeClinic();

        $patientId = $this->asUser($world['staff'])->postJson($this->manage($world, '/patients'), [
            'full_name' => 'Maria Walk-in', 'phone' => '09181112222',
        ])->assertCreated()->json('data.id');

        $this->asUser($world['staff'])->postJson($this->manage($world, '/appointments'), [
            'patient_id' => $patientId, 'service_rate_id' => $world['service']->id,
            'dentist_id' => $world['dentist']->id, 'branch_id' => $world['branch']->id, 'starts_at' => '2026-11-03 14:00',
        ])->assertCreated()->assertJsonPath('data.patient.name', 'Maria Walk-in');
    }

    public function test_dashboard_sections_follow_permissions(): void
    {
        $world = $this->makeClinic();
        $this->book($this->makePatient(), $world)->assertCreated();

        $this->asUser($world['admin'])->getJson($this->manage($world, '/dashboard'))->assertOk()
            ->assertJsonPath('data.appointments.pending_requests', 1)
            ->assertJsonStructure(['data' => ['appointments', 'active_patients', 'inventory', 'feedback']]);

        $this->asUser($world['dentistUser'])->getJson($this->manage($world, '/dashboard'))->assertOk()
            ->assertJsonMissingPath('data.inventory')
            ->assertJsonMissingPath('data.feedback');
    }
}
