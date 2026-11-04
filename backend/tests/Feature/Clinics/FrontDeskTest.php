<?php

namespace Tests\Feature\Clinics;

use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\ClinicMembership;
use App\Models\User;
use App\Notifications\CheckInReminder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\Support\ClinicWorld;
use Tests\TestCase;

class FrontDeskTest extends TestCase
{
    use ClinicWorld, RefreshDatabase;

    private array $world;

    protected function setUp(): void
    {
        parent::setUp();
        $this->freezeClock();
        $this->world = $this->makeClinic();
    }

    private function confirmedToday(string $time): Appointment
    {
        $id = $this->book($this->makePatient(), $this->world, $this->today($time))->assertCreated()->json('data.id');
        $this->asUser($this->world['staff'])->postJson($this->manage($this->world, "/appointments/{$id}/confirm"))->assertOk();

        return Appointment::findOrFail($id);
    }

    private function today(string $time): string
    {
        return now()->setTimezone(config('booking.timezone'))->format('Y-m-d')." {$time}";
    }

    public function test_queue_numbers_follow_check_in_order_and_do_not_shift(): void
    {
        $first = $this->confirmedToday('15:00');
        $second = $this->confirmedToday('16:00');
        $url = fn (Appointment $a, string $step) => $this->manage($this->world, "/appointments/{$a->id}/{$step}");
        $staff = $this->asUser($this->world['staff']);

        // Checked in out of booking order: the later appointment arrives first.
        $staff->postJson($url($second, 'check-in'))->assertOk();
        $this->travel(5)->minutes();
        $staff->postJson($url($first, 'check-in'))->assertOk();

        $queue = $staff->getJson($this->manage($this->world, '/appointments/queue'))->assertOk();
        $queue->assertJsonPath('data.0.id', $second->id)->assertJsonPath('data.0.queue_number', 1);
        $queue->assertJsonPath('data.1.id', $first->id)->assertJsonPath('data.1.queue_number', 2);

        // Once the first is finished the second keeps number 2.
        $staff->postJson($url($second, 'start'))->assertOk();
        $staff->postJson($url($second, 'complete'))->assertOk();
        $staff->getJson($this->manage($this->world, '/appointments/queue'))->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $first->id)
            ->assertJsonPath('data.0.queue_number', 2);
    }

    public function test_front_desk_notes_save_are_logged_and_stay_inside_the_clinic(): void
    {
        $appointment = $this->confirmedToday('15:00');
        $url = $this->manage($this->world, "/appointments/{$appointment->id}/front-desk-notes");

        $this->asUser($this->world['staff'])->putJson($url, ['notes' => 'Prefers morning calls'])->assertOk();
        $this->asUser($this->world['staff'])->getJson($this->manage($this->world, "/appointments/{$appointment->id}"))
            ->assertJsonPath('data.front_desk_notes', 'Prefers morning calls');
        $this->assertTrue(AuditLog::where('action', 'appointment.front_desk_notes_updated')->exists());

        $other = $this->makeClinic();
        $this->asUser($other['admin'])->putJson($this->manage($other, "/appointments/{$appointment->id}/front-desk-notes"), ['notes' => 'x'])->assertNotFound();
        $this->asUser($this->world['dentistUser'])->putJson($url, ['notes' => 'x'])->assertForbidden();
    }

    public function test_medical_alerts_reach_the_front_desk_logged_without_clinical_records(): void
    {
        $appointment = $this->confirmedToday('15:00');
        $patientId = $appointment->patient_id;
        $this->asUser($this->world['admin'])->postJson($this->manage($this->world, "/patients/{$patientId}/medical-history"), [
            'allergies' => 'Penicillin',
            'conditions' => 'Hypertension',
            'notes' => 'Private clinic note',
        ])->assertSuccessful();
        AuditLog::query()->where('action', 'records.alerts_viewed')->delete();

        $response = $this->asUser($this->world['staff'])->getJson($this->manage($this->world, "/appointments/{$appointment->id}"))->assertOk();
        $this->assertSame(['Conditions: Hypertension', 'Allergies: Penicillin'], $response->json('data.medical_flags'));
        $this->assertStringNotContainsString('Private clinic note', $response->getContent());
        $this->assertTrue(AuditLog::where('action', 'records.alerts_viewed')->exists());

        // Alerts do not open the records themselves.
        $this->asUser($this->world['staff'])->getJson($this->manage($this->world, "/patients/{$patientId}/records"))->assertForbidden();
        $this->asUser($this->world['staff'])->getJson($this->manage($this->world, "/patients/{$patientId}/medical-history"))->assertForbidden();
    }

    public function test_a_member_with_a_custom_list_without_alerts_does_not_see_them(): void
    {
        $appointment = $this->confirmedToday('15:00');
        $this->asUser($this->world['admin'])->postJson($this->manage($this->world, "/patients/{$appointment->patient_id}/medical-history"), ['allergies' => 'Penicillin'])->assertSuccessful();

        $user = User::factory()->create(['role' => 'staff']);
        $membership = new ClinicMembership(['status' => ClinicMembership::STATUS_ACTIVE]);
        $membership->clinic_id = $this->world['clinic']->id;
        $membership->user_id = $user->id;
        $membership->role = ClinicMembership::ROLE_STAFF;
        $membership->forceFill(['custom_permissions' => ['appointments.view_all']])->save();

        $this->asUser($user)->getJson($this->manage($this->world, "/appointments/{$appointment->id}"))
            ->assertOk()
            ->assertJsonPath('data.medical_flags', []);
    }

    public function test_members_edit_their_contact_details_but_not_their_schedule(): void
    {
        $url = $this->manage($this->world, '/me');
        $this->asUser($this->world['staff'])->putJson($url, [
            'phone' => '0917',
            'address' => 'Purok 3',
            'work_schedule' => ['days' => [0], 'starts_at' => '00:00', 'ends_at' => '01:00'],
            'role' => 'clinic_admin',
        ])->assertOk();

        $this->asUser($this->world['staff'])->getJson($url)->assertOk()
            ->assertJsonPath('data.phone', '0917')
            ->assertJsonPath('data.address', 'Purok 3')
            ->assertJsonPath('data.work_schedule', null)
            ->assertJsonPath('data.position_label', 'Front Desk Staff');
        $this->assertSame(ClinicMembership::ROLE_STAFF, ClinicMembership::where('user_id', $this->world['staff']->id)->value('role'));
    }

    public function test_the_clinic_admin_sets_a_staff_members_schedule(): void
    {
        $membership = ClinicMembership::where('user_id', $this->world['staff']->id)->firstOrFail();
        $url = $this->manage($this->world, "/members/{$membership->id}");
        $schedule = ['days' => [1, 2, 3], 'starts_at' => '07:30', 'ends_at' => '17:00'];

        $this->asUser($this->world['admin'])->putJson($url, ['work_schedule' => [...$schedule, 'ends_at' => '07:00']])
            ->assertJsonValidationErrors('work_schedule.ends_at');
        $this->asUser($this->world['admin'])->putJson($url, ['work_schedule' => $schedule])->assertOk();
        $this->assertEquals($schedule, $this->asUser($this->world['staff'])->getJson($this->manage($this->world, '/me'))->json('data.work_schedule'));
    }

    public function test_check_in_alerts_go_once_to_front_desk_staff_who_want_them(): void
    {
        Notification::fake();
        $appointment = $this->confirmedToday('15:00');
        $this->travelTo($appointment->starts_at->copy()->subMinutes(10));

        $this->artisan('appointments:send-check-in-alerts')->assertSuccessful();
        $this->artisan('appointments:send-check-in-alerts')->assertSuccessful();

        Notification::assertSentToTimes($this->world['staff'], CheckInReminder::class, 1);
        Notification::assertNotSentTo($this->world['admin'], CheckInReminder::class);

        $staff = $this->world['staff']->fresh();
        $staff->notification_preferences = ['categories' => ['check_in_alerts' => false]];
        $this->assertSame([], (new CheckInReminder($appointment))->via($staff));
    }

    public function test_checked_in_patients_get_no_check_in_alert(): void
    {
        Notification::fake();
        $appointment = $this->confirmedToday('15:00');
        $this->asUser($this->world['staff'])->postJson($this->manage($this->world, "/appointments/{$appointment->id}/check-in"))->assertOk();
        $this->travelTo($appointment->starts_at->copy()->subMinutes(10));

        $this->artisan('appointments:send-check-in-alerts')->assertSuccessful();

        Notification::assertNotSentTo($this->world['staff'], CheckInReminder::class);
    }
}
