<?php

namespace Tests\Feature;

use App\Models\Clinic;
use App\Models\ClinicMembership;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoClinicDataSeeder;
use Database\Seeders\DemoUsersSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class DatabaseSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_database_seeder_can_be_run_more_than_once(): void
    {
        $seeder = new DatabaseSeeder();
        $seeder->run();

        $serviceCount = DB::table('services')->count();
        $clinicCount = DB::table('clinics')->count();
        $serviceRateCount = DB::table('service_rates')->count();

        $seeder->run();

        $this->assertSame($serviceCount, DB::table('services')->count());
        $this->assertSame($clinicCount, DB::table('clinics')->count());
        $this->assertSame($serviceRateCount, DB::table('service_rates')->count());
        $this->assertSame(
            1,
            DB::table('services')->where('slug', 'general-dentistry')->count()
        );
        $this->assertSame(
            1,
            DB::table('clinics')->where('slug', 'bukidnon-dental-center')->count()
        );

        // Sample clinics show in the public directory, each with one main branch
        // open Monday to Saturday (still true after the second run).
        $this->assertSame(3, Clinic::publiclyListed()->count());
        foreach (Clinic::publiclyListed()->get() as $clinic) {
            $branches = $clinic->branches()->get();
            $this->assertCount(1, $branches);
            $this->assertTrue((bool) $branches->first()->is_main);
            $this->assertSame(6, $branches->first()->operatingHours()->count());
        }
    }

    public function test_demo_users_seeder_creates_one_account_per_role_and_can_rerun(): void
    {
        $this->app['env'] = 'local';

        $this->seed(DemoUsersSeeder::class);
        $this->seed(DemoUsersSeeder::class);

        $users = User::where('email', 'like', 'demo.%@example.test')->get()->keyBy('email');
        $this->assertCount(6, $users);
        $this->assertSame('system_admin', $users['demo.system-admin@example.test']->role);
        $this->assertNotNull($users['demo.patient@example.test']->patient);
        $this->assertNotNull($users['demo.dentist@example.test']->dentist);

        $clinic = Clinic::where('slug', 'local-demo-clinic')->sole();
        $this->assertEqualsCanonicalizing(
            ['clinic_admin', 'dentist', 'staff', 'inventory_staff'],
            ClinicMembership::where('clinic_id', $clinic->id)->active()->pluck('role')->all()
        );
        // The demo clinic is never listed publicly.
        $this->assertFalse(Clinic::publiclyListed()->whereKey($clinic->id)->exists());

        // Every demo account uses the one known password (no random passwords).
        foreach ($users as $email => $user) {
            $this->postJson('/api/login', ['email' => $email, 'password' => 'DemoPass2026'])
                ->assertOk()
                ->assertJsonPath('data.user.role', $user->role);
        }
    }

    public function test_demo_clinic_data_fills_every_dashboard_section_and_can_rerun(): void
    {
        $this->app['env'] = 'local';
        $this->seed(DatabaseSeeder::class);
        $this->seed(DemoUsersSeeder::class);
        $this->seed(DemoClinicDataSeeder::class);

        $clinic = Clinic::where('slug', 'local-demo-clinic')->sole();
        $counts = fn () => [
            $clinic->branches()->count(),
            $clinic->serviceRates()->count(),
            $clinic->appointments()->count(),
            $clinic->inventoryItems()->count(),
            $clinic->reviews()->count(),
            $clinic->patients()->count(),
        ];
        $first = $counts();
        $this->seed(DemoClinicDataSeeder::class);
        $this->assertSame($first, $counts(), 'a second run adds nothing');

        [$branches, $services, $appointments, $items, $reviews, $patients] = $first;
        $this->assertSame(2, $branches);
        $this->assertSame(5, $services);
        $this->assertGreaterThan(10, $appointments);
        $this->assertSame(5, $items);
        $this->assertGreaterThan(0, $reviews);
        $this->assertSame(7, $patients);
        $this->assertTrue(Clinic::publiclyListed()->whereKey($clinic->id)->exists());

        // The owner's dashboard now has figures, branches, services and alerts.
        $admin = User::where('email', 'demo.clinic-admin@example.test')->sole();
        $data = $this->actingAs($admin, 'sanctum')->getJson("/api/manage/clinics/{$clinic->id}/dashboard")->assertOk()->json('data');
        $this->assertCount(2, $data['overview']['branches']);
        $this->assertNotEmpty($data['overview']['treatments']);
        $alertTitles = implode(' | ', array_column($data['alerts'], 'title'));
        $this->assertStringContainsString('Low stock: Nitrile Gloves', $alertTitles);
        $this->assertStringContainsString('Expired: Lidocaine', $alertTitles);
        $this->assertStringContainsString('Expiring soon: Composite Resin Kit', $alertTitles);
        $this->assertStringContainsString('Appointment requests waiting', $alertTitles);
    }

    public function test_demo_users_seeder_refuses_to_run_outside_local(): void
    {
        $this->expectException(\RuntimeException::class);
        $this->seed(DemoUsersSeeder::class);
    }
}
