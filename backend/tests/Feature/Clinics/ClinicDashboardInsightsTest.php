<?php

namespace Tests\Feature\Clinics;

use App\Models\Appointment;
use App\Models\ClinicMembership;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\ClinicWorld;
use Tests\TestCase;

class ClinicDashboardInsightsTest extends TestCase
{
    use ClinicWorld, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->freezeClock();
    }

    public function test_figures_cover_today_patients_team_chart_and_revenue(): void
    {
        $world = $this->makeClinic();
        $first = $this->makePatient();
        $second = $this->makePatient();
        $today = $this->book($first, $world, '2026-11-02 15:00')->assertCreated()->json('data.id');
        $this->book($second, $world, '2026-11-02 16:00')->assertCreated();
        $this->asUser($world['staff'])->postJson($this->manage($world, "/appointments/{$today}/confirm"))->assertOk();
        // Completed in October, cancelled yesterday: seen by the revenue and the chart.
        $october = $this->book($first, $world, '2026-11-03 09:00')->assertCreated()->json('data.id');
        Appointment::whereKey($october)->update(['status' => Appointment::COMPLETED, 'starts_at' => '2026-10-20 01:00:00', 'ends_at' => '2026-10-20 01:30:00']);
        $yesterday = $this->book($second, $world, '2026-11-03 10:00')->assertCreated()->json('data.id');
        Appointment::whereKey($yesterday)->update(['status' => Appointment::CANCELLED, 'starts_at' => '2026-11-01 01:00:00', 'ends_at' => '2026-11-01 01:30:00']);
        User::factory()->role('dentist')->memberOf($world['clinic'], ClinicMembership::ROLE_DENTIST)->create();
        ClinicMembership::where('clinic_id', $world['clinic']->id)->latest('id')->first()->update(['status' => ClinicMembership::STATUS_SUSPENDED]);

        $data = $this->asUser($world['admin'])->getJson($this->manage($world, '/dashboard/insights'))->assertOk()->json('data');

        $this->assertSame(['date' => '2026-11-02', 'appointments' => 2, 'yesterday' => 0, 'pending_requests' => 1], $data['today']);
        $this->assertSame(2, $data['patients']['total']);
        $this->assertSame(2, $data['patients']['new_this_month']);
        $this->assertSame(['total' => 2, 'active' => 1, 'inactive' => 1], $data['dentists']);
        $this->assertSame(['total' => 1, 'active' => 1, 'inactive' => 0], $data['staff']);

        $this->assertCount(7, $data['appointments_by_day']);
        $this->assertSame(['date' => '2026-11-02', 'confirmed' => 1, 'pending' => 1, 'cancelled' => 0], end($data['appointments_by_day']));
        $this->assertSame(1, $data['appointments_by_day'][5]['cancelled']);

        $this->assertSame(800.0, (float) $data['revenue']['last_month']);
        $this->assertSame(0.0, (float) $data['revenue']['this_month']);
        $this->assertCount(11, $data['revenue']['by_month']);
        $this->assertSame('2026-10', $data['revenue']['by_month'][9]['month']);
        $this->assertSame(800.0, (float) $data['revenue']['by_month'][9]['total']);
    }

    public function test_activity_is_readable_and_leaves_out_clinical_events(): void
    {
        $world = $this->makeClinic();
        $patient = $this->makePatient();
        $id = $this->book($patient, $world, '2026-11-02 15:00')->assertCreated()->json('data.id');
        $this->asUser($world['staff'])->postJson($this->manage($world, "/appointments/{$id}/confirm"))->assertOk();
        $this->asUser($world['dentistUser'])->getJson($this->manage($world, '/records'))->assertOk(); // records.listed

        $activity = $this->asUser($world['admin'])->getJson($this->manage($world, '/dashboard/insights'))->assertOk()->json('data.activity');

        $this->assertSame('Appointment confirmed', $activity[0]['title']);
        $this->assertSame($patient->name.' – Dental Cleaning', $activity[0]['subject']);
        $this->assertSame($world['staff']->name, $activity[0]['actor']);
        $this->assertSame('appointment', $activity[0]['kind']);
        $this->assertArrayNotHasKey('metadata', $activity[0]);
        $this->assertEmpty(array_filter(array_column($activity, 'action'), fn ($a) => str_starts_with($a, 'records.')));
    }

    public function test_only_members_who_can_see_reports_get_the_figures(): void
    {
        $world = $this->makeClinic();
        $other = $this->makeClinic();

        $this->asUser($world['staff'])->getJson($this->manage($world, '/dashboard/insights'))->assertForbidden();
        $this->asUser($world['dentistUser'])->getJson($this->manage($world, '/dashboard/insights'))->assertForbidden();
        // Members of another clinic are not told this one exists.
        $this->asUser($other['admin'])->getJson($this->manage($world, '/dashboard/insights'))->assertNotFound();
    }

    public function test_calendar_counts_booked_days_of_a_month(): void
    {
        $world = $this->makeClinic();
        $patient = $this->makePatient();
        $this->book($patient, $world, '2026-11-03 09:00')->assertCreated();
        $this->book($patient, $world, '2026-11-03 10:00')->assertCreated();
        $declined = $this->book($patient, $world, '2026-11-04 09:00')->assertCreated()->json('data.id');
        $this->asUser($world['staff'])->postJson($this->manage($world, "/appointments/{$declined}/reject"), ['reason' => 'Fully booked'])->assertOk();

        $this->asUser($world['admin'])->getJson($this->manage($world, '/appointments/calendar?month=2026-11'))->assertOk()
            ->assertJsonPath('data.month', '2026-11')
            ->assertJsonPath('data.days', [['date' => '2026-11-03', 'total' => 2]]);
        $this->asUser($world['admin'])->getJson($this->manage($world, '/appointments/calendar?month=2026-12'))->assertOk()->assertJsonPath('data.days', []);
        $this->asUser($world['admin'])->getJson($this->manage($world, '/appointments/calendar?month=soon'))->assertStatus(422);
    }

    public function test_analytics_add_up_and_stay_aggregate(): void
    {
        $world = $this->makeClinic();
        $patient = $this->makePatient();
        $done = $this->book($patient, $world, '2026-11-03 09:00')->assertCreated()->json('data.id');
        Appointment::whereKey($done)->update(['status' => Appointment::COMPLETED, 'starts_at' => '2026-10-20 01:00:00', 'ends_at' => '2026-10-20 01:30:00']);
        $gone = $this->book($patient, $world, '2026-11-03 10:00')->assertCreated()->json('data.id');
        Appointment::whereKey($gone)->update(['status' => Appointment::CANCELLED]);

        $data = $this->asUser($world['admin'])->getJson($this->manage($world, '/reports/analytics'))->assertOk()->json('data');
        $this->assertSame(2026, $data['year']);
        $this->assertCount(11, $data['months']);
        $this->assertSame(['appointments' => 2, 'confirmed' => 1, 'cancelled' => 1, 'active_days' => 2, 'completed_visits' => 1, 'new_patients' => 1, 'patients' => 1], array_intersect_key($data['totals'], array_flip(['appointments', 'confirmed', 'cancelled', 'active_days', 'completed_visits', 'new_patients', 'patients'])));
        $this->assertSame(800.0, (float) $data['months'][9]['revenue']);
        $this->assertSame('Dental Cleaning', $data['treatments'][0]['service']);
        $this->assertStringNotContainsString($patient->name, json_encode($data));

        $this->asUser($world['staff'])->getJson($this->manage($world, '/reports/analytics'))->assertForbidden();
        $this->asUser($world['admin'])->getJson($this->manage($world, '/reports/analytics?year=1999'))->assertStatus(422);
    }

    public function test_lists_carry_the_fields_of_the_management_pages(): void
    {
        $world = $this->makeClinic();
        $patient = $this->makePatient();
        $patient->patient->forceFill(['birth_date' => '1998-11-02'])->save();
        $id = $this->book($patient, $world, '2026-11-02 15:00')->assertCreated()->json('data.id');

        $row = $this->asUser($world['admin'])->getJson($this->manage($world, '/appointments'))->assertOk()->json('data.0');
        $this->assertSame('online', $row['type']);
        $this->assertSame(28, $row['patient']['age']);
        $this->asUser($world['admin'])->getJson($this->manage($world, '/appointments?search=dental%20clean'))->assertOk()->assertJsonCount(1, 'data');

        $dentist = $this->asUser($world['admin'])->getJson($this->manage($world, '/dentists'))->assertOk()->json('data.0');
        $this->assertSame(1, $dentist['appointments_today']);

        Appointment::whereKey($id)->update(['status' => Appointment::COMPLETED]);
        $listed = $this->asUser($world['admin'])->getJson($this->manage($world, '/patients'))->assertOk()->json('data.0');
        $this->assertSame(1, $listed['visits']);
        $this->assertNotNull($listed['last_visit_at']);
        $this->assertSame('active', $listed['status']);
        $this->asUser($world['admin'])->getJson($this->manage($world, '/patients?status=inactive'))->assertOk()->assertJsonCount(0, 'data');
        $this->travel(14)->months();
        $this->asUser($world['admin'])->getJson($this->manage($world, '/patients?status=inactive'))->assertOk()->assertJsonCount(1, 'data');
        $this->asUser($world['admin'])->getJson($this->manage($world, '/patients?status=active'))->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_staff_phone_and_last_sign_in(): void
    {
        $world = $this->makeClinic();
        $created = $this->asUser($world['admin'])->postJson($this->manage($world, '/members'), [
            'email' => 'rosa@example.com', 'name' => 'Rosa Lim', 'role' => 'staff', 'phone' => '0917',
        ])->assertCreated()->assertJsonPath('data.phone', '0917')->json('data.id');
        $this->asUser($world['admin'])->putJson($this->manage($world, "/members/{$created}"), ['phone' => '0918'])->assertOk()->assertJsonPath('data.phone', '0918');

        $this->postJson('/api/login', ['email' => $world['staff']->email, 'password' => 'password'])->assertOk();
        $this->app['auth']->forgetGuards();
        $members = collect($this->asUser($world['admin'])->getJson($this->manage($world, '/members'))->assertOk()->json('data'));
        $this->assertNotNull($members->firstWhere('user_id', $world['staff']->id)['last_active_at']);
        $this->assertNull($members->firstWhere('id', $created)['last_active_at']);
    }

    public function test_inventory_brand_cost_expiry_and_stock_history(): void
    {
        $world = $this->makeClinic();
        $item = $this->asUser($world['admin'])->postJson($this->manage($world, '/inventory/items'), [
            'name' => 'Dental Gloves', 'brand' => 'Medicom', 'unit' => 'pairs', 'unit_cost' => 180.5, 'minimum_stock' => 50,
        ])->assertCreated()->assertJsonPath('data.brand', 'Medicom')->json('data.id');
        $this->asUser($world['admin'])->postJson($this->manage($world, "/inventory/items/{$item}/movements"), [
            'type' => 'receipt', 'quantity' => 45, 'expires_on' => '2027-12-01',
        ])->assertCreated();

        $row = $this->asUser($world['admin'])->getJson($this->manage($world, '/inventory/items'))->assertOk()->json('data.0');
        $this->assertSame(180.5, (float) $row['unit_cost']);
        $this->assertSame(45, $row['quantity_usable']);
        $this->assertSame('2027-12-01', $row['next_expiry']);

        $history = $this->asUser($world['admin'])->getJson($this->manage($world, '/inventory/movements'))->assertOk()->json('data.0');
        $this->assertSame('Dental Gloves', $history['item']);
        $this->assertSame(45, $history['quantity']);
        $this->assertSame($world['admin']->name, $history['performed_by']);

        $other = $this->makeClinic();
        $this->asUser($other['admin'])->getJson($this->manage($other, '/inventory/movements'))->assertOk()->assertJsonCount(0, 'data');
        $this->asUser($world['staff'])->getJson($this->manage($world, '/inventory/movements'))->assertForbidden();
    }

    public function test_walk_ins_are_confirmed_at_once_and_clinic_admins_can_register_patients(): void
    {
        $world = $this->makeClinic();
        $patientId = $this->asUser($world['admin'])->postJson($this->manage($world, '/patients'), [
            'full_name' => 'Jose Reyes', 'phone' => '09171234567',
        ])->assertCreated()->json('data.id');

        $body = [
            'patient_id' => $patientId, 'service_rate_id' => $world['service']->id, 'dentist_id' => $world['dentist']->id,
            'branch_id' => $world['branch']->id, 'starts_at' => '2026-11-02 15:00',
        ];
        $this->asUser($world['admin'])->postJson($this->manage($world, '/appointments'), $body + ['walk_in' => true])
            ->assertCreated()->assertJsonPath('data.status', Appointment::CONFIRMED);
        $this->assertDatabaseHas('audit_logs', ['action' => 'appointment.walk_in', 'clinic_id' => $world['clinic']->id]);

        // Without the flag a staff booking still starts as a request.
        $this->asUser($world['admin'])->postJson($this->manage($world, '/appointments'), array_merge($body, ['starts_at' => '2026-11-02 16:00']))
            ->assertCreated()->assertJsonPath('data.status', Appointment::PENDING);

        // Registering is not clinical access: a receptionist still cannot read records.
        $this->asUser($world['staff'])->getJson($this->manage($world, "/patients/{$patientId}/records"))->assertForbidden();
    }
}
