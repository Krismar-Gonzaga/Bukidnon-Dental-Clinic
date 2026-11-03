<?php

namespace Database\Seeders;

use App\Models\Appointment;
use App\Models\Clinic;
use App\Models\ClinicBranch;
use App\Models\Dentist;
use App\Models\InventoryItem;
use App\Models\Patient;
use App\Models\Review;
use App\Models\Service;
use App\Models\ServiceRate;
use App\Models\User;
use App\Services\InventoryService;
use App\Support\BusinessTime;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Fills the local demo clinic (created by DemoUsersSeeder) with realistic
 * test data so every clinic-portal screen has something to show: two
 * branches with hours, services with prices, the demo dentist's weekly
 * schedule, sample patients, appointments from last month to the coming
 * weeks in every status, reviews, and inventory that triggers each alert.
 *
 * Local only. Safe to re-run: existing rows are reused, and appointments,
 * reviews and stock are only created the first time.
 *
 *   php artisan db:seed --class=DemoUsersSeeder
 *   php artisan db:seed --class=DemoClinicDataSeeder
 */
class DemoClinicDataSeeder extends Seeder
{
    private const SERVICES = [
        // name, catalog slug, price, minutes
        ['Dental Cleaning', 'general-dentistry', 800, 30],
        ['Tooth Filling', 'general-dentistry', 1500, 45],
        ['Tooth Extraction', 'oral-surgery', 1200, 30],
        ['Orthodontic Consultation', 'orthodontics', 1000, 30],
        ['Teeth Whitening', 'cosmetic-dentistry', 5000, 60],
    ];

    private const SAMPLE_PATIENTS = [
        ['Maria Santos', '09171230001', 'Purok 5, Casisang, Malaybalay City'],
        ['Jose Rizal Dela Cruz', '09171230002', 'Sumpong, Malaybalay City'],
        ['Ana Liza Reyes', '09171230003', 'Poblacion, Valencia City'],
        ['Carlo Mendoza', '09171230004', 'Lumbo, Valencia City'],
        ['Grace Villanueva', '09171230005', 'San Jose, Malaybalay City'],
        ['Paolo Garcia', '09171230006', 'Bagontaas, Valencia City'],
    ];

    public function run(InventoryService $inventory): void
    {
        if (! app()->environment('local')) {
            throw new RuntimeException('Demo clinic data may only be seeded in the local environment.');
        }

        $clinic = Clinic::where('slug', 'local-demo-clinic')->first();
        $admin = User::where('email', 'demo.clinic-admin@example.test')->first();
        $dentistUser = User::where('email', 'demo.dentist@example.test')->first();
        $patientUser = User::where('email', 'demo.patient@example.test')->first();
        if (! $clinic || ! $admin || ! $dentistUser || ! $patientUser) {
            throw new RuntimeException('Run DemoUsersSeeder first: php artisan db:seed --class=DemoUsersSeeder');
        }

        DB::transaction(function () use ($clinic, $admin, $dentistUser, $patientUser, $inventory) {
            // Listed and bookable, so the patient app can find and book it.
            $clinic->forceFill([
                'description' => 'Demo clinic for testing the portal. Not a real clinic.',
                'address' => 'Fortich Street',
                'city' => 'Malaybalay City',
                'province' => 'Bukidnon',
                'contact_number' => '09170000000',
                'latitude' => 8.1575,
                'longitude' => 125.1278,
                'status' => Clinic::STATUS_APPROVED,
                'is_published' => true,
                'is_verified' => true,
            ])->save();

            $main = $this->branch($clinic, 'Main Branch', 'Fortich Street', 'Malaybalay City', 8.1575, 125.1278, true);
            $valencia = $this->branch($clinic, 'Valencia Branch', 'Sayre Highway, Poblacion', 'Valencia City', 7.9064, 125.0940, false);

            $services = collect(self::SERVICES)->map(fn ($s) => $this->service($clinic, ...$s));

            $dentist = Dentist::firstOrNew(['user_id' => $dentistUser->id]);
            $dentist->fill(['years_experience' => 8, 'license_number' => 'PRC-DEMO-0001', 'is_active' => true]);
            $dentist->clinic_id = $clinic->id;
            $dentist->save();
            // Main: Mon, Wed, Fri, Sat. Valencia: Tue, Thu.
            $dentist->schedules()->whereIn('branch_id', [$main->id, $valencia->id])->delete();
            foreach ([1, 3, 5, 6] as $day) {
                $dentist->schedules()->create(['branch_id' => $main->id, 'day_of_week' => $day, 'starts_at' => '08:00', 'ends_at' => '17:00']);
            }
            foreach ([2, 4] as $day) {
                $dentist->schedules()->create(['branch_id' => $valencia->id, 'day_of_week' => $day, 'starts_at' => '09:00', 'ends_at' => '16:00']);
            }

            $patients = collect([$this->patient($patientUser, 'Demo Patient', '09170000001', 'Kalasungay, Malaybalay City')]);
            foreach (self::SAMPLE_PATIENTS as $index => [$name, $phone, $address]) {
                $user = User::firstOrNew(['email' => 'demo.sample-'.($index + 1).'@example.test']);
                // Same known password as the other local demo accounts.
                $user->name = $name;
                $user->password = config('app.demo_password');
                $user->role = 'patient';
                $user->status = User::STATUS_ACTIVE;
                $user->save();
                $patients->push($this->patient($user, $name, $phone, $address));
            }
            $patients->each(fn (Patient $p) => $p->registerWith($clinic, $admin));

            if (! $clinic->appointments()->exists()) {
                $this->appointments($clinic, $dentist, $main, $valencia, $services->all(), $patients->all(), $admin);
            }

            if (! $clinic->inventoryItems()->exists()) {
                $this->inventory($clinic, $main, $admin, $inventory);
            }

            $clinic->refreshRating();
        });

        $this->command?->info('Demo clinic data ready: Local Demo Dental Clinic (2 branches, services, schedule, appointments, reviews, inventory).');
    }

    private function branch(Clinic $clinic, string $name, string $address, string $city, float $lat, float $lng, bool $isMain): ClinicBranch
    {
        $branch = ClinicBranch::where('clinic_id', $clinic->id)->where('name', $name)->first() ?? new ClinicBranch;
        $branch->fill(['name' => $name, 'address' => $address, 'city' => $city, 'province' => 'Bukidnon', 'latitude' => $lat, 'longitude' => $lng, 'is_active' => true]);
        $branch->clinic_id = $clinic->id;
        $branch->is_main = $isMain;
        $branch->save();

        foreach (range(1, 6) as $day) {
            $branch->operatingHours()->updateOrCreate(['day_of_week' => $day], ['opens_at' => '08:00', 'closes_at' => '17:00']);
        }

        return $branch;
    }

    private function service(Clinic $clinic, string $name, string $slug, int $price, int $minutes): ServiceRate
    {
        $catalog = Service::where('slug', $slug)->first()
            ?? Service::unguarded(fn () => Service::firstOrCreate(['slug' => $slug], ['name' => Str::headline($slug), 'description' => Str::headline($slug)]));

        $rate = ServiceRate::where('clinic_id', $clinic->id)->where('service_name', $name)->first() ?? new ServiceRate;
        $rate->fill(['service_name' => $name, 'description' => "{$name} at the demo clinic", 'price' => $price, 'currency' => 'PHP', 'duration_minutes' => $minutes, 'is_available' => true]);
        $rate->clinic_id = $clinic->id;
        $rate->service_id = $catalog->id;
        $rate->save();

        return $rate;
    }

    private function patient(User $user, string $name, string $phone, string $address): Patient
    {
        $patient = Patient::firstOrNew(['user_id' => $user->id]);
        $patient->fill(['phone' => $patient->phone ?: $phone, 'address' => $patient->address ?: $address, 'full_name' => $name, 'email' => $user->email]);
        $patient->user_id = $user->id;
        $patient->save();

        return $patient;
    }

    /**
     * Last month and earlier this month: mostly completed (plus a cancelled
     * and a no-show). Today: confirmed, checked in, pending. Coming weeks:
     * confirmed, pending requests and a reschedule request.
     */
    private function appointments(Clinic $clinic, Dentist $dentist, ClinicBranch $main, ClinicBranch $valencia, array $services, array $patients, User $admin): void
    {
        $today = BusinessTime::today();
        $branchFor = fn (CarbonImmutable $day) => in_array($day->dayOfWeek, [2, 4], true) ? $valencia : ($day->dayOfWeek === 0 ? null : $main);
        $plan = [];

        // Past working days from the start of last month up to yesterday, two visits a day.
        for ($day = $today->subMonthNoOverflow()->startOfMonth(); $day->lt($today); $day = $day->addDay()) {
            if (! $branchFor($day) || $day->day % 3 === 0) {
                continue;
            }
            $plan[] = [$day, '09:00', Appointment::COMPLETED];
            $plan[] = [$day, '14:00', $day->day % 7 === 0 ? Appointment::NO_SHOW : ($day->day % 11 === 0 ? Appointment::CANCELLED : Appointment::COMPLETED)];
        }

        if ($branchFor($today)) {
            $plan[] = [$today, '09:00', Appointment::CHECKED_IN];
            $plan[] = [$today, '11:00', Appointment::CONFIRMED];
            $plan[] = [$today, '15:00', Appointment::PENDING];
        }

        $future = [Appointment::CONFIRMED, Appointment::PENDING, Appointment::CONFIRMED, Appointment::RESCHEDULE_REQUESTED, Appointment::PENDING, Appointment::CONFIRMED, Appointment::CONFIRMED];
        $day = $today->addDay();
        foreach ($future as $index => $status) {
            while (! $branchFor($day)) {
                $day = $day->addDay();
            }
            $plan[] = [$day, $index % 2 === 0 ? '10:00' : '13:30', $status];
            $day = $day->addDays(2);
        }

        $reviewsLeft = [[5, 'Very gentle and the clinic was spotless.', Review::STATUS_APPROVED], [4, 'Quick cleaning, friendly staff.', Review::STATUS_APPROVED], [5, 'Painless extraction. Thank you, doc!', Review::STATUS_PENDING]];

        foreach ($plan as $i => [$day, $time, $status]) {
            $service = $services[$i % count($services)];
            $patient = $patients[$i % count($patients)];
            $start = BusinessTime::parse($day->toDateString().' '.$time);
            $end = $start->addMinutes($service->duration_minutes);

            $appointment = new Appointment(['reason' => $service->service_name, 'notes' => null]);
            $appointment->forceFill([
                'clinic_id' => $clinic->id,
                'branch_id' => $branchFor($day)->id,
                'dentist_id' => $dentist->id,
                'service_rate_id' => $service->id,
                'service_id' => $service->service_id,
                'patient_id' => $patient->id,
                'patient_name' => $patient->full_name ?? 'Patient',
                'patient_email' => $patient->email ?? '',
                'patient_phone' => $patient->phone ?? '',
                'status' => $status,
                'status_changed_at' => now(),
                'created_by' => $admin->id,
                'starts_at' => BusinessTime::utc($start),
                'ends_at' => BusinessTime::utc($end),
                'appointment_date' => $start->toDateString(),
                'appointment_time' => $start->format('H:i:s'),
                'requested_starts_at' => $status === Appointment::RESCHEDULE_REQUESTED ? BusinessTime::utc($start->addDays(1)) : null,
                'requested_ends_at' => $status === Appointment::RESCHEDULE_REQUESTED ? BusinessTime::utc($end->addDays(1)) : null,
                'cancellation_reason' => $status === Appointment::CANCELLED ? 'Patient had a schedule conflict.' : null,
            ])->save();
            $appointment->statusHistory()->create(['from_status' => null, 'to_status' => $status, 'changed_by' => $admin->id]);

            if ($status === Appointment::COMPLETED && $reviewsLeft && $i % 5 === 0) {
                [$rating, $comment, $reviewStatus] = array_shift($reviewsLeft);
                $review = new Review(['rating' => $rating, 'comment' => $comment]);
                $review->forceFill([
                    'clinic_id' => $clinic->id,
                    'patient_id' => $patient->id,
                    'appointment_id' => $appointment->id,
                    'is_verified_purchase' => true,
                    'status' => $reviewStatus,
                ])->save();
            }
        }
    }

    /** Stock that sets off every inventory alert: low stock, expiring soon and expired. */
    private function inventory(Clinic $clinic, ClinicBranch $branch, User $actor, InventoryService $inventory): void
    {
        $today = BusinessTime::today();
        $items = [
            // name, unit, minimum, batches [quantity, batch number, expires]
            ['Nitrile Gloves (Medium)', 'box', 20, [[8, 'GLV-2410', $today->addYear()]]],
            ['Composite Resin Kit', 'kit', 5, [[12, 'CRK-2405', $today->addDays(20)]]],
            ['Lidocaine 2% Cartridges', 'cartridge', 50, [[200, 'LID-2501', $today->addYear()], [10, 'LID-2310', $today->subDays(10)]]],
            ['Surgical Face Masks', 'box', 30, [[120, 'MSK-2502', $today->addMonths(18)]]],
            ['Fluoride Varnish', 'tube', 10, [[25, 'FLV-2412', $today->addMonths(8)]]],
        ];

        foreach ($items as [$name, $unit, $minimum, $batches]) {
            $item = new InventoryItem(['name' => $name, 'unit' => $unit, 'minimum_stock' => $minimum, 'is_active' => true, 'branch_id' => $branch->id]);
            $item->clinic_id = $clinic->id;
            $item->save();

            foreach ($batches as [$quantity, $number, $expires]) {
                $inventory->receive($item, $quantity, ['batch_number' => $number, 'expires_on' => $expires->toDateString()], $actor, 'Opening stock (demo data)');
            }
        }
    }
}
