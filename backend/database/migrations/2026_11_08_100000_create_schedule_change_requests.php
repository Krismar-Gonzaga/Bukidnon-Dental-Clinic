<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
| A dentist's proposed working days and hours at one branch. Nothing changes in
| dentist_schedules until someone who manages schedules approves it, so patient bookings keep
| following the current hours. Additive: a new table only.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('schedule_change_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('dentist_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained('clinic_branches')->cascadeOnDelete();
            $table->text('days');
            $table->string('starts_at', 5);
            $table->string('ends_at', 5);
            $table->string('note', 500)->nullable();
            $table->string('status', 10)->default('pending');
            $table->string('review_note', 500)->nullable();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['clinic_id', 'status', 'created_at']);
            $table->index(['dentist_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('schedule_change_requests');
    }
};
