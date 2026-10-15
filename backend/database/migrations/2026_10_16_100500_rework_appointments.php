<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/*
| Appointments become real scheduled time ranges linked to a patient,
| branch, dentist and clinic service.
|
| - status widens to the full state machine (see App\Models\Appointment).
| - starts_at/ends_at (timestamptz) are the authoritative schedule;
|   appointment_date/appointment_time are kept in sync for older clients.
| - On PostgreSQL an exclusion constraint makes the database itself refuse
|   two active appointments overlapping for the same dentist, even under
|   concurrent requests. Application code checks first for a friendly error.
*/
return new class extends Migration
{
    private const ACTIVE_STATUSES = "'pending','confirmed','reschedule_requested','checked_in','in_progress'";

    public function up(): void
    {
        $pgsql = DB::getDriverName() === 'pgsql';

        if ($pgsql) {
            DB::statement('ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check');
        }

        Schema::table('appointments', function (Blueprint $table) {
            $table->string('status', 30)->default('pending')->change();
        });

        Schema::table('appointments', function (Blueprint $table) {
            $table->foreignId('patient_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained('clinic_branches')->nullOnDelete();
            $table->foreignId('dentist_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('service_rate_id')->nullable()->constrained('service_rates')->nullOnDelete();
            $table->timestampTz('starts_at')->nullable();
            $table->timestampTz('ends_at')->nullable();
            $table->string('reason')->nullable();
            $table->text('cancellation_reason')->nullable();
            $table->timestampTz('requested_starts_at')->nullable();
            $table->timestampTz('requested_ends_at')->nullable();
            $table->timestamp('status_changed_at')->nullable();
            $table->timestamp('reminder_sent_at')->nullable();
            $table->string('idempotency_key', 64)->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            $table->unique(['patient_id', 'idempotency_key']);
            $table->index(['clinic_id', 'starts_at']);
            $table->index(['dentist_id', 'starts_at']);
            $table->index('status');
        });

        Schema::create('appointment_status_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('appointment_id')->constrained()->cascadeOnDelete();
            $table->string('from_status', 30)->nullable();
            $table->string('to_status', 30);
            $table->text('reason')->nullable();
            $table->foreignId('changed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['appointment_id', 'created_at']);
        });

        if ($pgsql) {
            try {
                // Nested transaction = savepoint: a failure here must not
                // abort the migration's surrounding PostgreSQL transaction.
                DB::transaction(function () {
                    DB::statement('CREATE EXTENSION IF NOT EXISTS btree_gist');
                    DB::statement(
                        'ALTER TABLE appointments ADD CONSTRAINT appointments_no_dentist_overlap '
                        .'EXCLUDE USING gist (dentist_id WITH =, tstzrange(starts_at, ends_at) WITH &&) '
                        .'WHERE (dentist_id IS NOT NULL AND starts_at IS NOT NULL AND status IN ('.self::ACTIVE_STATUSES.'))'
                    );
                });
            } catch (Throwable $e) {
                // Without btree_gist the application-level locking still applies.
                Log::warning('Appointment overlap constraint not created: '.$e->getMessage());
            }
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_no_dentist_overlap');
        }

        Schema::dropIfExists('appointment_status_histories');

        Schema::table('appointments', function (Blueprint $table) {
            $table->dropUnique(['patient_id', 'idempotency_key']);
            $table->dropIndex(['clinic_id', 'starts_at']);
            $table->dropIndex(['dentist_id', 'starts_at']);
            $table->dropIndex(['status']);
            $table->dropConstrainedForeignId('patient_id');
            $table->dropConstrainedForeignId('branch_id');
            $table->dropConstrainedForeignId('dentist_id');
            $table->dropConstrainedForeignId('service_rate_id');
            $table->dropConstrainedForeignId('created_by');
            $table->dropColumn([
                'starts_at', 'ends_at', 'reason', 'cancellation_reason', 'requested_starts_at',
                'requested_ends_at', 'status_changed_at', 'reminder_sent_at', 'idempotency_key',
            ]);
        });

        // Statuses outside the original four cannot be restored automatically.
        if (DB::getDriverName() === 'pgsql') {
            DB::statement(
                "ALTER TABLE appointments ADD CONSTRAINT appointments_status_check CHECK (status IN ('pending','confirmed','completed','cancelled')) NOT VALID"
            );
        }
    }
};
