<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
| Details the patient keeps on their own profile. health_profile is what the
| patient reports about themselves (allergies, medications, vitals...): it is
| sensitive personal information, so it is stored encrypted. It is separate
| from patient_medical_histories, which is what clinics record.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->string('civil_status', 20)->nullable();
            $table->string('blood_type', 3)->nullable();
            $table->string('city', 100)->nullable();
            $table->string('province', 100)->nullable();
            $table->string('zip_code', 10)->nullable();
            $table->string('photo_path')->nullable();
            $table->string('emergency_contact_relationship', 50)->nullable();
            $table->string('emergency_contact_address')->nullable();
            $table->text('health_profile')->nullable();
            $table->text('consents')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropColumn([
                'civil_status',
                'blood_type',
                'city',
                'province',
                'zip_code',
                'photo_path',
                'emergency_contact_relationship',
                'emergency_contact_address',
                'health_profile',
                'consents',
            ]);
        });
    }
};
