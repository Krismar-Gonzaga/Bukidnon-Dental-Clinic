<?php

namespace Tests\Support;

use App\Models\Clinic;
use App\Models\ClinicBranch;
use App\Models\ClinicMembership;
use App\Models\Dentist;
use App\Models\Patient;
use App\Models\ServiceRate;
use App\Models\User;
use App\Support\BusinessTime;
use Illuminate\Testing\TestResponse;

/**
 * Builds a listed clinic with a branch open every day 08:00–17:00, a dentist
 * scheduled for the same hours, and a 30-minute service. Time is frozen at
 * Monday 2026-11-02 08:00 Manila so "tomorrow 09:00" is always bookable.
 */
trait ClinicWorld
{
    protected function freezeClock(): void
    {
        // Freeze with a UTC instance: Carbon parses stored timestamps in the frozen clock's timezone.
        $this->travelTo(BusinessTime::parse('2026-11-02 08:00')->utc());
    }

    /** @return array{clinic: Clinic, branch: ClinicBranch, dentist: Dentist, dentistUser: User, service: ServiceRate, admin: User, staff: User} */
    protected function makeClinic(array $clinicAttributes = []): array
    {
        $clinic = Clinic::factory()->create($clinicAttributes + ['status' => 'approved', 'is_published' => true, 'is_verified' => true]);

        $branch = new ClinicBranch(['name' => 'Main Branch', 'address' => 'Sayre Highway', 'city' => $clinic->city]);
        $branch->clinic_id = $clinic->id;
        $branch->is_main = true;
        $branch->save();
        foreach (range(0, 6) as $day) {
            $branch->operatingHours()->create(['day_of_week' => $day, 'opens_at' => '08:00', 'closes_at' => '17:00']);
        }

        $dentistUser = User::factory()->role('dentist')->memberOf($clinic, ClinicMembership::ROLE_DENTIST)->create();
        $dentist = new Dentist(['years_experience' => 5, 'is_active' => true]);
        $dentist->user_id = $dentistUser->id;
        $dentist->clinic_id = $clinic->id;
        $dentist->save();
        foreach (range(0, 6) as $day) {
            $dentist->schedules()->create(['branch_id' => $branch->id, 'day_of_week' => $day, 'starts_at' => '08:00', 'ends_at' => '17:00']);
        }

        $service = new ServiceRate(['service_name' => 'Dental Cleaning', 'description' => 'Oral prophylaxis', 'price' => 800, 'currency' => 'PHP', 'duration_minutes' => 30, 'is_available' => true]);
        $service->clinic_id = $clinic->id;
        $service->service_id = $this->catalogServiceId();
        $service->save();

        $admin = User::factory()->role('clinic_admin')->memberOf($clinic, ClinicMembership::ROLE_CLINIC_ADMIN)->create();
        $staff = User::factory()->role('staff')->memberOf($clinic, ClinicMembership::ROLE_STAFF)->create();

        return compact('clinic', 'branch', 'dentist', 'dentistUser', 'service', 'admin', 'staff');
    }

    protected function makePatient(): User
    {
        $user = User::factory()->role('patient')->create();
        $patient = new Patient(['phone' => '09170000000', 'address' => 'Valencia City']);
        $patient->user_id = $user->id;
        $patient->save();

        return $user->load('patient');
    }

    /** Book through the API as the patient. */
    protected function book(User $patient, array $world, string $startsAt = '2026-11-03 09:00', array $headers = []): TestResponse
    {
        return $this->asUser($patient)->withHeaders($headers)->postJson('/api/patient/appointments', [
            'clinic_id' => $world['clinic']->id,
            'service_rate_id' => $world['service']->id,
            'dentist_id' => $world['dentist']->id,
            'branch_id' => $world['branch']->id,
            'starts_at' => $startsAt,
            'reason' => 'Cleaning',
        ]);
    }

    /** System admin whose password was just re-confirmed (RequireRecentPassword). */
    protected function asConfirmedAdmin(User $admin): static
    {
        $this->app['auth']->forgetGuards();
        $token = $admin->createToken('test');
        \Illuminate\Support\Facades\Cache::put("admin-password-confirmed:{$admin->id}:token:{$token->accessToken->getKey()}", true, 600);

        return $this->withToken($token->plainTextToken);
    }

    protected function asUser(User $user): static
    {
        // Fresh token per call keeps tests independent of Sanctum's guard cache.
        $this->app['auth']->forgetGuards();

        return $this->withToken($user->createToken('test')->plainTextToken);
    }

    protected function manage(array $world, string $path = ''): string
    {
        return '/api/manage/clinics/'.$world['clinic']->id.$path;
    }

    private function catalogServiceId(): int
    {
        return \App\Models\Service::unguarded(fn () => \App\Models\Service::firstOrCreate(
            ['slug' => 'general-dentistry'],
            ['name' => 'General Dentistry', 'description' => 'General care', 'icon_name' => 'tooth', 'sort_order' => 1]
        ))->id;
    }
}
