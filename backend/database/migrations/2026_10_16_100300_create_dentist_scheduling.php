<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
| Dentist working hours per branch (which also records branch assignment)
| and one-off blocked time (leave, meetings, equipment downtime).
|
| Existing dentist profiles that already point at a clinic get:
|   - an active `dentist` membership in that clinic, and
|   - a default schedule copying their clinic's main-branch hours.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dentists', function (Blueprint $table) {
            $table->text('qualifications')->nullable();
            $table->index('clinic_id');
        });

        Schema::create('dentist_schedules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dentist_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('clinic_branches')->cascadeOnDelete();
            $table->unsignedTinyInteger('day_of_week'); // 0 = Sunday ... 6 = Saturday
            $table->time('starts_at');
            $table->time('ends_at');
            $table->timestamps();

            $table->unique(['dentist_id', 'branch_id', 'day_of_week']);
        });

        Schema::create('schedule_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('clinic_branches')->cascadeOnDelete();
            $table->foreignId('dentist_id')->nullable()->constrained()->cascadeOnDelete();
            $table->timestampTz('starts_at');
            $table->timestampTz('ends_at');
            $table->string('reason')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['clinic_id', 'starts_at']);
        });

        $now = now();
        $dentists = DB::table('dentists')->whereNotNull('clinic_id')->whereNotNull('user_id')->get();

        foreach ($dentists as $dentist) {
            $hasMembership = DB::table('clinic_memberships')
                ->where('clinic_id', $dentist->clinic_id)
                ->where('user_id', $dentist->user_id)
                ->exists();

            if (! $hasMembership) {
                DB::table('clinic_memberships')->insert([
                    'clinic_id' => $dentist->clinic_id,
                    'user_id' => $dentist->user_id,
                    'role' => 'dentist',
                    'status' => 'active',
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }

            $mainBranch = DB::table('clinic_branches')
                ->where('clinic_id', $dentist->clinic_id)
                ->where('is_main', true)
                ->first();

            if (! $mainBranch) {
                continue;
            }

            foreach (DB::table('branch_operating_hours')->where('branch_id', $mainBranch->id)->get() as $hours) {
                DB::table('dentist_schedules')->insert([
                    'dentist_id' => $dentist->id,
                    'branch_id' => $mainBranch->id,
                    'day_of_week' => $hours->day_of_week,
                    'starts_at' => $hours->opens_at,
                    'ends_at' => $hours->closes_at,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
            }
        }
    }

    public function down(): void
    {
        // Remove only the dentist memberships this migration could have created.
        foreach (DB::table('dentists')->whereNotNull('clinic_id')->whereNotNull('user_id')->get() as $dentist) {
            DB::table('clinic_memberships')
                ->where('clinic_id', $dentist->clinic_id)
                ->where('user_id', $dentist->user_id)
                ->where('role', 'dentist')
                ->delete();
        }

        Schema::dropIfExists('schedule_blocks');
        Schema::dropIfExists('dentist_schedules');

        Schema::table('dentists', function (Blueprint $table) {
            $table->dropIndex(['clinic_id']);
            $table->dropColumn('qualifications');
        });
    }
};
