<?php

namespace Database\Seeders;

use App\Models\Clinic;
use App\Models\ClinicBranch;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $services = [
            ['name' => 'General Dentistry', 'icon_name' => 'medical-services', 'color' => '#003f87', 'is_popular' => true, 'sort_order' => 1],
            ['name' => 'Cosmetic Dentistry', 'icon_name' => 'brush', 'color' => '#006c4f', 'is_popular' => true, 'sort_order' => 2],
            ['name' => 'Orthodontics', 'icon_name' => 'camera', 'color' => '#ff9800', 'is_popular' => true, 'sort_order' => 3],
            ['name' => 'Oral Surgery', 'icon_name' => 'healing', 'color' => '#e91e63', 'is_popular' => true, 'sort_order' => 4],
            ['name' => 'Root Canal', 'icon_name' => 'health-and-safety', 'color' => '#9c27b0', 'is_popular' => false, 'sort_order' => 5],
            ['name' => 'Dental Implants', 'icon_name' => 'bolt', 'color' => '#00bcd4', 'is_popular' => false, 'sort_order' => 6],
        ];

        $now = now();
        $serviceRows = array_map(fn (array $service) => array_merge($service, [
            'slug' => str()->slug($service['name']),
            'description' => "Professional {$service['name']} services",
            'created_at' => $now,
            'updated_at' => $now,
        ]), $services);

        DB::table('services')->upsert(
            $serviceRows,
            ['slug'],
            ['name', 'description', 'icon_name', 'color', 'is_popular', 'sort_order', 'updated_at']
        );

        $clinics = [
            [
                'name' => 'Bukidnon Dental Center',
                'address' => 'Fortich St.',
                'city' => 'Malaybalay City',
                'contact_number' => '09123456789',
                'email' => 'info@bukidnondental.com',
                'rating' => 4.8,
                'is_featured' => true,
                'is_verified' => true
            ],
            [
                'name' => 'SmilePro Dental Clinic',
                'address' => 'Valencia Town Center',
                'city' => 'Valencia City',
                'contact_number' => '09987654321',
                'email' => 'smilepro@example.com',
                'rating' => 4.6,
                'is_featured' => true,
                'is_verified' => true
            ],
            [
                'name' => 'Dental Wellness Hub',
                'address' => 'Sayre Highway',
                'city' => 'Malaybalay City',
                'contact_number' => '09781234567',
                'email' => 'wellness@example.com',
                'rating' => 4.9,
                'is_featured' => true,
                'is_verified' => true
            ],
        ];

        // Sample clinics are approved and published so they appear in the
        // public directory (Clinic::publiclyListed()).
        $clinicRows = array_map(fn (array $clinic) => array_merge($clinic, [
            'slug' => str()->slug($clinic['name']),
            'province' => 'Bukidnon',
            'opening_time' => '08:00:00',
            'closing_time' => '17:00:00',
            'status' => Clinic::STATUS_APPROVED,
            'is_published' => true,
            'created_at' => $now,
            'updated_at' => $now,
        ]), $clinics);

        DB::table('clinics')->upsert(
            $clinicRows,
            ['slug'],
            [
                'name', 'address', 'city', 'province', 'contact_number', 'email',
                'rating', 'is_featured', 'is_verified', 'opening_time', 'closing_time',
                'status', 'is_published', 'updated_at',
            ]
        );

        // Each sample clinic gets a main branch open Monday to Saturday, 8 AM to 5 PM.
        foreach ($clinicRows as $row) {
            $clinicId = DB::table('clinics')->where('slug', $row['slug'])->value('id');
            $branch = ClinicBranch::where('clinic_id', $clinicId)->where('is_main', true)->first()
                ?? new ClinicBranch;
            $branch->fill(['name' => 'Main Branch', 'address' => $row['address'], 'city' => $row['city']]);
            $branch->clinic_id = $clinicId;
            $branch->is_main = true;
            $branch->save();

            foreach (range(1, 6) as $day) {
                $branch->operatingHours()->updateOrCreate(
                    ['day_of_week' => $day],
                    ['opens_at' => '08:00', 'closes_at' => '17:00']
                );
            }
        }

        $clinicId = DB::table('clinics')
            ->where('slug', str()->slug('Bukidnon Dental Center'))
            ->value('id');
        $serviceId = DB::table('services')
            ->where('slug', str()->slug('General Dentistry'))
            ->value('id');

        if ($clinicId && $serviceId) {
            $rate = [
                'service_name' => 'General Checkup',
                'description' => 'Initial consultation and examination',
                'price' => 500,
            ];
            $existingRate = DB::table('service_rates')
                ->where('clinic_id', $clinicId)
                ->where('service_id', $serviceId)
                ->where('service_name', $rate['service_name'])
                ->exists();

            if ($existingRate) {
                DB::table('service_rates')
                    ->where('clinic_id', $clinicId)
                    ->where('service_id', $serviceId)
                    ->where('service_name', $rate['service_name'])
                    ->update(array_merge($rate, ['updated_at' => $now]));
            } else {
                DB::table('service_rates')->insert(array_merge($rate, [
                    'clinic_id' => $clinicId,
                    'service_id' => $serviceId,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]));
            }
        }
    }
}