<?php

namespace Tests\Feature\Clinics;

use App\Models\Appointment;
use App\Models\ScheduleBlock;
use App\Support\BusinessTime;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\ClinicWorld;
use Tests\TestCase;

/** Clinic admin dashboard figures and the staff directory extras. */
class ClinicOverviewTest extends TestCase
{
    use ClinicWorld, RefreshDatabase;

    private array $world;

    protected function setUp(): void
    {
        parent::setUp();
        $this->freezeClock(); // Monday 2026-11-02 08:00 Manila
        $this->world = $this->makeClinic();

        $alice = $this->makePatient();
        $bob = $this->makePatient();

        // This month: one completed (counts toward revenue), one still pending.
        $completed = $this->book($alice, $this->world, '2026-11-03 09:00')->assertCreated()->json('data.id');
        $this->book($bob, $this->world, '2026-11-03 10:00')->assertCreated();
        Appointment::whereKey($completed)->update(['status' => Appointment::COMPLETED]);

        // Last month: one completed visit.
        $old = $this->book($alice, $this->world, '2026-11-04 09:00')->assertCreated()->json('data.id');
        Appointment::whereKey($old)->update([
            'status' => Appointment::COMPLETED,
            'starts_at' => BusinessTime::utc(BusinessTime::parse('2026-10-15 09:00')),
            'ends_at' => BusinessTime::utc(BusinessTime::parse('2026-10-15 09:30')),
        ]);
    }

    public function test_dentist_sees_their_new_patients_and_last_weeks_count(): void
    {
        $carol = $this->makePatient();
        $this->book($carol, $this->world, '2026-11-02 15:00')->assertCreated(); // first visit, today

        $data = $this->asUser($this->world['dentistUser'])->getJson($this->manage($this->world, '/dashboard'))
            ->assertOk()->json('data');

        // Alice's first visit was last month; Bob's and Carol's are this month.
        $this->assertSame(['total' => 3, 'new_this_month' => 2, 'new_today' => 1], $data['my_patients']);
        $this->assertSame(0, $data['appointments']['same_day_last_week']);
        $this->assertArrayNotHasKey('overview', $data);

        $this->asUser($this->world['admin'])->getJson($this->manage($this->world, '/dashboard'))
            ->assertOk()->assertJsonMissingPath('data.my_patients');
    }

    public function test_owner_sees_month_figures_branch_activity_and_services(): void
    {
        $overview = $this->asUser($this->world['admin'])->getJson($this->manage($this->world, '/dashboard'))
            ->assertOk()->json('data.overview');

        $this->assertSame(['this_month' => 2, 'last_month' => 1], $overview['appointments']);
        // Estimated revenue = listed price (800) of each completed appointment.
        $this->assertEquals(800, $overview['revenue_estimate']['this_month']);
        $this->assertEquals(800, $overview['revenue_estimate']['last_month']);
        $this->assertSame(['active' => 3, 'dentists' => 1], $overview['staff']);

        $branch = $overview['branches'][0];
        $this->assertSame('Main Branch', $branch['name']);
        $this->assertSame(2, $branch['appointments_this_month']);
        $this->assertSame(2, $branch['patients_this_month']);
        $this->assertEquals(800, $branch['revenue_this_month']);
        $this->assertTrue($branch['open_now']); // open 08:00–17:00 every day
        $this->assertSame(['opens_at' => '08:00', 'closes_at' => '17:00'], $branch['hours_today']);

        $this->assertSame([['service' => 'Dental Cleaning', 'total' => 2]], $overview['treatments']);
    }

    public function test_alerts_follow_permissions_and_figures_are_owner_only(): void
    {
        $owner = $this->asUser($this->world['admin'])->getJson($this->manage($this->world, '/dashboard'))->assertOk();
        $this->assertContains('Appointment requests waiting', array_column($owner->json('data.alerts'), 'title'));

        // Receptionist: handles requests, but no business figures.
        $staff = $this->asUser($this->world['staff'])->getJson($this->manage($this->world, '/dashboard'))->assertOk();
        $this->assertNull($staff->json('data.overview'));
        $this->assertContains('Appointment requests waiting', array_column($staff->json('data.alerts'), 'title'));

        // Dentist: neither figures nor request alerts.
        $dentist = $this->asUser($this->world['dentistUser'])->getJson($this->manage($this->world, '/dashboard'))->assertOk();
        $this->assertNull($dentist->json('data.overview'));
        $this->assertSame([], $dentist->json('data.alerts'));
    }

    public function test_staff_directory_shows_dentist_branches_and_leave_today(): void
    {
        $block = new ScheduleBlock([
            'dentist_id' => $this->world['dentist']->id,
            'starts_at' => BusinessTime::utc(BusinessTime::parse('2026-11-02 00:00')),
            'ends_at' => BusinessTime::utc(BusinessTime::parse('2026-11-03 00:00')),
            'reason' => 'Seminar',
        ]);
        $block->clinic_id = $this->world['clinic']->id;
        $block->save();

        $members = collect($this->asUser($this->world['admin'])->getJson($this->manage($this->world, '/members'))
            ->assertOk()->json('data'))->keyBy('role');

        $this->assertSame(['Main Branch'], $members['dentist']['branches']);
        $this->assertTrue($members['dentist']['on_leave_today']);
        $this->assertNull($members['staff']['branches']); // works at every branch
        $this->assertFalse($members['staff']['on_leave_today']);
        $this->assertNotNull($members['staff']['joined_at']);
    }
}
