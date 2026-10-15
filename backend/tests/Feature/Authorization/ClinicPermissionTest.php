<?php

namespace Tests\Feature\Authorization;

use App\Models\AuditLog;
use App\Models\Clinic;
use App\Models\ClinicMembership;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use LogicException;
use Tests\TestCase;

class ClinicPermissionTest extends TestCase
{
    use RefreshDatabase;

    private Clinic $clinicA;

    private Clinic $clinicB;

    protected function setUp(): void
    {
        parent::setUp();

        // A probe route standing in for the real clinic-scoped endpoints.
        Route::middleware(['api', 'auth:sanctum', 'active', 'clinic.permission:inventory.manage'])
            ->get('/api/_probe/clinics/{clinic}/inventory', fn (Clinic $clinic) => ['clinic' => $clinic->id]);

        $this->clinicA = Clinic::factory()->create();
        $this->clinicB = Clinic::factory()->create();
    }

    private function probe(User $user, Clinic|int $clinic)
    {
        $id = $clinic instanceof Clinic ? $clinic->id : $clinic;

        return $this->withToken($user->createToken('t')->plainTextToken)
            ->getJson("/api/_probe/clinics/{$id}/inventory");
    }

    public function test_member_with_permission_is_allowed(): void
    {
        $admin = User::factory()->memberOf($this->clinicA, 'clinic_admin')->create();

        $this->probe($admin, $this->clinicA)->assertOk()->assertJson(['clinic' => $this->clinicA->id]);
    }

    public function test_member_of_another_clinic_gets_404_not_403(): void
    {
        $adminOfA = User::factory()->memberOf($this->clinicA, 'clinic_admin')->create();

        $this->probe($adminOfA, $this->clinicB)
            ->assertNotFound()
            ->assertJson(['success' => false, 'message' => 'Resource not found.']);
    }

    public function test_member_without_the_permission_gets_403(): void
    {
        $receptionist = User::factory()->memberOf($this->clinicA, 'staff')->create();

        $this->probe($receptionist, $this->clinicA)->assertForbidden();
    }

    public function test_patients_and_platform_role_strings_grant_nothing(): void
    {
        // A users.role of clinic_admin without a membership is not clinic access.
        $claimsAdmin = User::factory()->role('clinic_admin')->create();
        $patient = User::factory()->role('patient')->create();

        $this->probe($claimsAdmin, $this->clinicA)->assertNotFound();
        $this->probe($patient, $this->clinicA)->assertNotFound();
    }

    public function test_suspended_or_invited_membership_grants_nothing(): void
    {
        $suspended = User::factory()
            ->memberOf($this->clinicA, 'clinic_admin', ClinicMembership::STATUS_SUSPENDED)->create();
        $invited = User::factory()
            ->memberOf($this->clinicA, 'clinic_admin', ClinicMembership::STATUS_INVITED)->create();

        $this->probe($suspended, $this->clinicA)->assertNotFound();
        $this->probe($invited, $this->clinicA)->assertNotFound();
    }

    public function test_unknown_clinic_id_gets_404(): void
    {
        $admin = User::factory()->memberOf($this->clinicA, 'clinic_admin')->create();

        $this->probe($admin, 999999)->assertNotFound();
    }

    public function test_role_permission_map_keeps_clinical_records_restricted(): void
    {
        $permissions = config('permissions.clinic_roles');

        $this->assertNotContains('records.view', $permissions['clinic_admin']);
        $this->assertNotContains('records.write', $permissions['staff']);
        $this->assertContains('records.write', $permissions['dentist']);
    }

    public function test_audit_log_entries_cannot_be_modified_or_deleted(): void
    {
        $entry = AuditLog::create(['action' => 'test.event']);

        try {
            $entry->update(['action' => 'tampered']);
            $this->fail('Audit log update was allowed.');
        } catch (LogicException) {
        }

        $this->expectException(LogicException::class);
        $entry->delete();
    }

    public function test_route_list_loads_without_missing_controllers(): void
    {
        $this->artisan('route:list', ['--path' => 'api'])->assertSuccessful();
    }
}
