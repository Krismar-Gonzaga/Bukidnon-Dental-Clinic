<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
| Dentist portal. Additive: new tables plus nullable or defaulted columns, so existing rows
| and older clients keep working.
| - patient_records: the note and treatment fields of the design. `status` defaults to final,
|   so every existing record stays exactly what it was; only drafts can still be edited.
| - appointments.treatment_notes: the dentist's note on one visit (clinical, not front desk).
| - dentists: the rest of the professional profile. The licence numbers are verified by the
|   clinic administrator, not edited by the dentist.
| - clinic_patients.pre_procedure_checklist: what the dentist actually ticked, per clinic.
| - patient_files: what kind of file it is, for the imaging page.
| - dental_chart_teeth / prescriptions / dental_certificates / follow_ups: new clinical data,
|   each tied to one clinic and patient.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patient_records', function (Blueprint $table) {
            $table->text('diagnosis')->nullable();
            $table->text('treatment_plan')->nullable();
            $table->text('follow_up_recommendations')->nullable();
            $table->string('materials_used', 500)->nullable();
            $table->date('performed_on')->nullable();
            $table->string('status', 10)->default('final');
        });

        Schema::table('appointments', function (Blueprint $table) {
            $table->text('treatment_notes')->nullable();
        });

        Schema::table('dentists', function (Blueprint $table) {
            $table->string('secondary_specialization')->nullable();
            $table->string('education')->nullable();
            $table->string('website')->nullable();
            $table->string('ptr_number', 50)->nullable();
            $table->string('s2_number', 50)->nullable();
        });

        Schema::table('clinic_patients', function (Blueprint $table) {
            $table->text('pre_procedure_checklist')->nullable();
        });

        Schema::table('patient_files', function (Blueprint $table) {
            $table->string('category', 40)->nullable();
            $table->string('notes', 500)->nullable();
        });

        Schema::create('dental_chart_teeth', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('tooth_number'); // Universal Numbering System, 1-32
            $table->string('status', 20);
            $table->text('notes')->nullable();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['clinic_id', 'patient_id', 'tooth_number']);
        });

        Schema::create('prescriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('dentist_id')->nullable()->constrained()->nullOnDelete();
            $table->string('medication');
            $table->string('dosage', 100);
            $table->string('frequency', 100);
            $table->string('duration', 100);
            $table->text('instructions')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['clinic_id', 'patient_id', 'created_at']);
        });

        Schema::create('dental_certificates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('dentist_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 20);
            $table->text('purpose')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['clinic_id', 'patient_id', 'created_at']);
        });

        Schema::create('follow_ups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('dentist_id')->nullable()->constrained()->nullOnDelete();
            $table->string('purpose');
            $table->date('due_on');
            $table->string('priority', 10)->default('routine');
            $table->string('status', 15)->default('scheduled');
            $table->string('notes', 500)->nullable();
            $table->timestamp('reminder_sent_at')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['clinic_id', 'dentist_id', 'due_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('follow_ups');
        Schema::dropIfExists('dental_certificates');
        Schema::dropIfExists('prescriptions');
        Schema::dropIfExists('dental_chart_teeth');

        Schema::table('patient_files', function (Blueprint $table) {
            $table->dropColumn(['category', 'notes']);
        });
        Schema::table('clinic_patients', function (Blueprint $table) {
            $table->dropColumn('pre_procedure_checklist');
        });
        Schema::table('dentists', function (Blueprint $table) {
            $table->dropColumn(['secondary_specialization', 'education', 'website', 'ptr_number', 's2_number']);
        });
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropColumn('treatment_notes');
        });
        Schema::table('patient_records', function (Blueprint $table) {
            $table->dropColumn(['diagnosis', 'treatment_plan', 'follow_up_recommendations', 'materials_used', 'performed_on', 'status']);
        });
    }
};
