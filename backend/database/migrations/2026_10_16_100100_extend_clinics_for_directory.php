<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
| Clinic lifecycle and map data.
| status: pending | approved | suspended (approval itself is tracked on
| clinic_applications). Only approved + published clinics are listed
| publicly; is_verified is kept in sync for existing clients.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clinics', function (Blueprint $table) {
            $table->string('status', 20)->default('pending');
            $table->boolean('is_published')->default(false);
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->foreignId('owner_id')->nullable()->constrained('users')->nullOnDelete();
            $table->text('suspension_reason')->nullable();
            $table->timestamp('suspended_at')->nullable();

            $table->index(['status', 'is_published']);
            $table->index('city');
        });

        // Existing verified clinics stay publicly listed.
        DB::table('clinics')->where('is_verified', true)->update(['status' => 'approved', 'is_published' => true]);
    }

    public function down(): void
    {
        Schema::table('clinics', function (Blueprint $table) {
            $table->dropIndex(['status', 'is_published']);
            $table->dropIndex(['city']);
            $table->dropConstrainedForeignId('owner_id');
            $table->dropColumn(['status', 'is_published', 'latitude', 'longitude', 'suspension_reason', 'suspended_at']);
        });
    }
};
