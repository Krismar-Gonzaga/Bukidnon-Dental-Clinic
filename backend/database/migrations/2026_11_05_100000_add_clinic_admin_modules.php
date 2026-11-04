<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
| Clinic admin modules: staff positions and permissions, clinic settings, replies to
| reviews, patient files, two-factor sign-in, and subscriptions with payment proofs.
| Everything is additive. The specialization list is only filled in when it is empty:
| clinics and dentists need it, and nothing else created it.
*/
return new class extends Migration
{
    private const SPECIALIZATIONS = [
        'General Dentistry',
        'Orthodontics',
        'Pediatric Dentistry',
        'Oral Surgery',
        'Cosmetic Dentistry',
        'Endodontics',
        'Periodontics',
        'Prosthodontics',
    ];

    public function up(): void
    {
        Schema::table('clinic_memberships', function (Blueprint $table) {
            $table->string('position', 40)->nullable();
            $table->text('custom_permissions')->nullable();
        });

        Schema::table('clinics', function (Blueprint $table) {
            $table->text('settings')->nullable();
        });

        Schema::table('reviews', function (Blueprint $table) {
            $table->text('clinic_reply')->nullable();
            $table->timestamp('clinic_replied_at')->nullable();
            $table->foreignId('clinic_replied_by')->nullable()->constrained('users')->nullOnDelete();
        });

        Schema::table('service_rates', function (Blueprint $table) {
            $table->decimal('price_max', 10, 2)->nullable();
            $table->unsignedSmallInteger('duration_max')->nullable();
            $table->timestamp('archived_at')->nullable();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->text('two_factor_secret')->nullable();
            $table->text('two_factor_recovery_codes')->nullable();
            $table->timestamp('two_factor_confirmed_at')->nullable();
        });

        Schema::create('patient_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('path');
            $table->string('mime_type', 100);
            $table->unsignedBigInteger('size');
            $table->timestamps();

            $table->index(['clinic_id', 'patient_id']);
        });

        Schema::table('subscriptions', function (Blueprint $table) {
            $table->foreignId('clinic_id')->nullable()->unique()->constrained()->cascadeOnDelete();
            $table->string('plan', 40)->nullable();
            $table->string('status', 20)->nullable();
            $table->timestamp('renews_at')->nullable();
        });

        Schema::create('subscription_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('submitted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('plan', 40);
            $table->decimal('amount', 10, 2);
            $table->string('method', 20);
            $table->string('reference', 100)->nullable();
            $table->string('proof_path');
            $table->string('proof_mime_type', 100);
            $table->string('status', 20)->default('pending');
            $table->string('invoice_number', 30)->nullable()->unique();
            $table->text('review_note')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();

            $table->index(['clinic_id', 'status']);
        });

        if (Schema::hasTable('specializations') && DB::table('specializations')->count() === 0) {
            $now = now();
            DB::table('specializations')->insert(array_map(fn (string $name) => [
                'name' => $name,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ], self::SPECIALIZATIONS));
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('subscription_payments');
        Schema::table('subscriptions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('clinic_id');
            $table->dropColumn(['plan', 'status', 'renews_at']);
        });
        Schema::dropIfExists('patient_files');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['two_factor_secret', 'two_factor_recovery_codes', 'two_factor_confirmed_at']);
        });
        Schema::table('service_rates', function (Blueprint $table) {
            $table->dropColumn(['price_max', 'duration_max', 'archived_at']);
        });
        Schema::table('reviews', function (Blueprint $table) {
            $table->dropConstrainedForeignId('clinic_replied_by');
            $table->dropColumn(['clinic_reply', 'clinic_replied_at']);
        });
        Schema::table('clinics', function (Blueprint $table) {
            $table->dropColumn('settings');
        });
        Schema::table('clinic_memberships', function (Blueprint $table) {
            $table->dropColumn(['position', 'custom_permissions']);
        });
    }
};
