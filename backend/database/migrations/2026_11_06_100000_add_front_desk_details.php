<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
| Front desk: scheduling notes on an appointment (not clinical notes), a marker so a
| check-in alert goes out once, and a staff member's working schedule and contact address
| at this clinic. Additive and nullable, so existing rows and older clients are unaffected.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->text('front_desk_notes')->nullable();
            $table->timestamp('check_in_alert_sent_at')->nullable();
        });

        Schema::table('clinic_memberships', function (Blueprint $table) {
            $table->text('work_schedule')->nullable();
            $table->string('address')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropColumn(['front_desk_notes', 'check_in_alert_sent_at']);
        });

        Schema::table('clinic_memberships', function (Blueprint $table) {
            $table->dropColumn(['work_schedule', 'address']);
        });
    }
};
