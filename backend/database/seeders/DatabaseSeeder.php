<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Clinic;
use App\Models\Service;
use App\Models\ServiceRate;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Create services
        $services = [
            ['name' => 'General Dentistry', 'icon_name' => 'medical-services', 'color' => '#003f87', 'is_popular' => true, 'sort_order' => 1],
            ['name' => 'Cosmetic Dentistry', 'icon_name' => 'brush', 'color' => '#006c4f', 'is_popular' => true, 'sort_order' => 2],
            ['name' => 'Orthodontics', 'icon_name' => 'camera', 'color' => '#ff9800', 'is_popular' => true, 'sort_order' => 3],
            ['name' => 'Oral Surgery', 'icon_name' => 'healing', 'color' => '#e91e63', 'is_popular' => true, 'sort_order' => 4],
            ['name' => 'Root Canal', 'icon_name' => 'health-and-safety', 'color' => '#9c27b0', 'is_popular' => false, 'sort_order' => 5],
            ['name' => 'Dental Implants', 'icon_name' => 'bolt', 'color' => '#00bcd4', 'is_popular' => false, 'sort_order' => 6],
        ];
        
        foreach ($services as $service) {
            Service::create(array_merge($service, [
                'slug' => str()->slug($service['name']),
                'description' => "Professional {$service['name']} services"
            ]));
        }
        
        // Create clinics
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
        
        foreach ($clinics as $clinic) {
            Clinic::create(array_merge($clinic, [
                'slug' => str()->slug($clinic['name']),
                'province' => 'Bukidnon',
                'opening_time' => '08:00:00',
                'closing_time' => '17:00:00',
            ]));
        }
        
        // Create service rates
        $clinic1 = Clinic::first();
        $generalService = Service::where('name', 'General Dentistry')->first();
        
        if ($clinic1 && $generalService) {
            ServiceRate::create([
                'clinic_id' => $clinic1->id,
                'service_id' => $generalService->id,
                'service_name' => 'General Checkup',
                'description' => 'Initial consultation and examination',
                'price' => 500
            ]);
        }
    }
}