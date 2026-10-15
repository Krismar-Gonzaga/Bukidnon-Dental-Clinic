<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// service_rates is each clinic's priced service list. Bookings need a
// duration to reserve the right amount of the dentist's time.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_rates', function (Blueprint $table) {
            $table->unsignedSmallInteger('duration_minutes')->default(30);
            $table->index(['clinic_id', 'is_available']);
        });
    }

    public function down(): void
    {
        Schema::table('service_rates', function (Blueprint $table) {
            $table->dropIndex(['clinic_id', 'is_available']);
            $table->dropColumn('duration_minutes');
        });
    }
};
