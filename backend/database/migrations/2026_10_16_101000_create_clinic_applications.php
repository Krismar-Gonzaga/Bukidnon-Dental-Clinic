<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
| Clinic registration and verification workflow.
| status: draft → pending → under_review → approved | rejected
| (a rejected application can be corrected and resubmitted → pending).
| Approval creates the clinic, its main branch, and the applicant's
| clinic_admin membership.
|
| verification_documents (previously an empty stub) stores uploaded files on
| the private disk; they are only served through short-lived signed links.
| The older clinic_verifications table is left in place but no longer used.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clinic_applications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('applicant_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('clinic_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 20)->default('draft');
            $table->string('clinic_name');
            $table->text('description')->nullable();
            $table->string('address')->nullable();
            $table->string('city')->nullable();
            $table->string('province')->default('Bukidnon');
            $table->string('contact_number', 30)->nullable();
            $table->string('email')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('representative_name')->nullable();
            $table->string('representative_position')->nullable();
            $table->text('review_notes')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'submitted_at']);
            $table->index('applicant_id');
        });

        if (Schema::hasTable('verification_documents') && DB::table('verification_documents')->count() === 0) {
            Schema::drop('verification_documents');
        }

        Schema::create('verification_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_application_id')->constrained()->cascadeOnDelete();
            // business_permit | doh_license | prc_id | bir_registration | other
            $table->string('document_type', 40);
            $table->string('path');
            $table->string('original_name');
            $table->string('mime_type', 100);
            $table->unsignedInteger('size');
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['clinic_application_id', 'document_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('verification_documents');
        Schema::create('verification_documents', function (Blueprint $table) {
            $table->id();
            $table->timestamps();
        });

        Schema::dropIfExists('clinic_applications');
    }
};
