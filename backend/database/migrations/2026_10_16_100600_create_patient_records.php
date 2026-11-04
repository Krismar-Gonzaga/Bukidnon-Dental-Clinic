<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
| Patient demographics vs clinical data:
| - patients: identity and contact (user_id now optional so clinic staff can
|   register walk-in patients who have no portal account).
| - clinic_patients: which clinics a patient is registered with; this is the
|   tenant boundary for every patient lookup.
| - patient_medical_histories: append-only snapshots (allergies, medications,
|   conditions); the newest row is current, older rows are history.
| - patient_records: treatment/examination entries. Never edited in place: a
|   correction is a new row pointing at the one it amends, and the original
|   gets superseded_at. patient_records was an empty stub and is recreated.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->change();
        });

        Schema::table('patients', function (Blueprint $table) {
            $table->string('full_name')->nullable();
            $table->string('email')->nullable();
            $table->string('emergency_contact_name')->nullable();
            $table->string('emergency_contact_phone', 20)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
        });

        Schema::create('clinic_patients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('registered_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['clinic_id', 'patient_id']);
        });

        Schema::create('patient_medical_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->text('allergies')->nullable();
            $table->text('medications')->nullable();
            $table->text('conditions')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['patient_id', 'clinic_id', 'created_at']);
        });

        if (Schema::hasTable('patient_records') && DB::table('patient_records')->count() === 0) {
            Schema::drop('patient_records');
        }

        Schema::create('patient_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('appointment_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('dentist_id')->nullable()->constrained()->nullOnDelete();
            $table->string('record_type', 30); // examination | treatment | consultation
            $table->text('chief_complaint')->nullable();
            $table->text('findings')->nullable();
            $table->text('procedures')->nullable();
            $table->string('tooth_numbers')->nullable();
            $table->text('notes')->nullable();
            $table->text('care_instructions')->nullable();
            // Only care instructions of visible records are shown to the patient.
            $table->boolean('is_patient_visible')->default(false);
            $table->foreignId('amends_record_id')->nullable()->constrained('patient_records')->nullOnDelete();
            $table->text('amendment_reason')->nullable();
            $table->timestamp('superseded_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['clinic_id', 'patient_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_records');
        Schema::create('patient_records', function (Blueprint $table) {
            $table->id();
            $table->timestamps();
        });

        Schema::dropIfExists('patient_medical_histories');
        Schema::dropIfExists('clinic_patients');

        Schema::table('patients', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by');
            $table->dropColumn(['full_name', 'email', 'emergency_contact_name', 'emergency_contact_phone']);
        });
        // user_id stays nullable: walk-in patients may exist by then.
    }
};
