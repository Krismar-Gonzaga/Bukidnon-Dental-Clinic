<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
| Branches, weekly operating hours, and holidays.
|
| clinic_branches previously existed only as an empty stub (id + timestamps);
| it is recreated with its real columns. Every existing clinic gets a
| "Main Branch" built from its own address and its opening/closing time,
| open Monday to Saturday (assumption: closed Sundays; clinic admins can
| change this).
*/
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('clinic_branches') && DB::table('clinic_branches')->count() === 0) {
            Schema::drop('clinic_branches');
        }

        Schema::create('clinic_branches', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('address');
            $table->string('city');
            $table->string('province')->default('Bukidnon');
            $table->string('contact_number')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->boolean('is_main')->default(false);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['clinic_id', 'is_active']);
        });

        Schema::create('branch_operating_hours', function (Blueprint $table) {
            $table->id();
            $table->foreignId('branch_id')->constrained('clinic_branches')->cascadeOnDelete();
            $table->unsignedTinyInteger('day_of_week'); // 0 = Sunday ... 6 = Saturday
            $table->time('opens_at');
            $table->time('closes_at');
            $table->timestamps();

            $table->unique(['branch_id', 'day_of_week']);
        });

        Schema::create('clinic_holidays', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            // Null applies to every branch of the clinic.
            $table->foreignId('branch_id')->nullable()->constrained('clinic_branches')->cascadeOnDelete();
            $table->date('date');
            $table->string('name');
            $table->timestamps();

            $table->index(['clinic_id', 'date']);
        });

        $now = now();
        foreach (DB::table('clinics')->get() as $clinic) {
            $branchId = DB::table('clinic_branches')->insertGetId([
                'clinic_id' => $clinic->id,
                'name' => 'Main Branch',
                'address' => $clinic->address,
                'city' => $clinic->city,
                'province' => $clinic->province ?? 'Bukidnon',
                'contact_number' => $clinic->contact_number,
                'is_main' => true,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            foreach (range(1, 6) as $day) {
                DB::table('branch_operating_hours')->insert([
                    'branch_id' => $branchId,
                    'day_of_week' => $day,
                    'opens_at' => $clinic->opening_time ?? '08:00:00',
                    'closes_at' => $clinic->closing_time ?? '17:00:00',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('clinic_holidays');
        Schema::dropIfExists('branch_operating_hours');
        Schema::dropIfExists('clinic_branches');

        // Restore the original stub.
        Schema::create('clinic_branches', function (Blueprint $table) {
            $table->id();
            $table->timestamps();
        });
    }
};
