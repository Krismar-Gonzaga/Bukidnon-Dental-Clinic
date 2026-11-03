<?php

namespace Database\Seeders;

use App\Models\Clinic;
use App\Models\ClinicMembership;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class DemoUsersSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local')) {
            throw new RuntimeException('Demo users may only be seeded in the local environment.');
        }

        $credentials = [];

        DB::transaction(function () use (&$credentials): void {
            $accounts = [
                ['role' => 'patient', 'name' => 'Demo Patient', 'email' => 'demo.patient@example.test'],
                ['role' => 'clinic_admin', 'name' => 'Demo Clinic Administrator', 'email' => 'demo.clinic-admin@example.test'],
                ['role' => 'dentist', 'name' => 'Demo Dentist', 'email' => 'demo.dentist@example.test'],
                ['role' => 'staff', 'name' => 'Demo Clinic Staff', 'email' => 'demo.staff@example.test'],
                ['role' => 'inventory_staff', 'name' => 'Demo Inventory Staff', 'email' => 'demo.inventory@example.test'],
                ['role' => 'system_admin', 'name' => 'Demo System Administrator', 'email' => 'demo.system-admin@example.test'],
            ];

            $users = [];

            foreach ($accounts as $account) {
                // One known password for every local demo account (config/app.php
                // demo_password), so the login page's auto-fill buttons work.
                $password = config('app.demo_password');
                $user = User::firstOrNew(['email' => $account['email']]);
                $user->name = $account['name'];
                $user->password = $password;
                $user->role = $account['role'] === 'inventory_staff' ? 'staff' : $account['role'];
                $user->status = User::STATUS_ACTIVE;
                $user->email_verified_at = now();
                $user->save();

                $users[$account['role']] = $user;
                $credentials[] = [
                    'Role' => $account['role'],
                    'Email' => $user->email,
                    'Password' => $password,
                ];
            }

            $users['patient']->patient()->firstOrCreate([]);
            $users['dentist']->dentist()->firstOrCreate([], ['is_active' => true]);

            $clinic = Clinic::firstOrCreate(
                ['slug' => 'local-demo-clinic'],
                [
                    'name' => 'Local Demo Dental Clinic',
                    'description' => 'Sample clinic for local development only.',
                    'address' => 'Demo address',
                    'city' => 'Malaybalay City',
                    'province' => 'Bukidnon',
                    'contact_number' => '09000000000',
                    'email' => 'demo-clinic@example.test',
                ]
            );

            if ($clinic->owner_id === null) {
                $clinic->owner_id = $users['clinic_admin']->id;
                $clinic->save();
            }

            foreach ([
                'clinic_admin' => 'clinic_admin',
                'dentist' => 'dentist',
                'staff' => 'staff',
                'inventory_staff' => 'inventory_staff',
            ] as $accountRole => $membershipRole) {
                $membership = ClinicMembership::firstOrNew([
                    'clinic_id' => $clinic->id,
                    'user_id' => $users[$accountRole]->id,
                ]);
                $membership->role = $membershipRole;
                $membership->status = ClinicMembership::STATUS_ACTIVE;
                $membership->save();
            }
        });

        $this->command?->warn('Local demo accounts (password from DEMO_USER_PASSWORD, default DemoPass2026). Never use these on a real deployment.');
        $this->command?->table(['Role', 'Email', 'Password'], $credentials);
    }
}
