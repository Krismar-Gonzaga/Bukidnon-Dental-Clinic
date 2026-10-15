<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
| The shared Supabase database gained these columns outside of migrations.
| This migration records them so fresh databases match. Each column is only
| added when missing, so it is a no-op on the shared database.
|
| down() is intentionally empty: on the shared database these columns (and
| the dentist profiles stored in them) existed before this migration.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dentists', function (Blueprint $table) {
            $add = fn (string $column) => ! Schema::hasColumn('dentists', $column);

            if ($add('user_id')) {
                $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            }
            if ($add('clinic_id')) {
                $table->foreignId('clinic_id')->nullable()->constrained()->nullOnDelete();
            }
            if ($add('specialization_id')) {
                $table->foreignId('specialization_id')->nullable()->constrained()->nullOnDelete();
            }
            if ($add('license_number')) {
                $table->string('license_number')->nullable();
            }
            if ($add('years_experience')) {
                $table->integer('years_experience')->default(0);
            }
            if ($add('bio')) {
                $table->text('bio')->nullable();
            }
            if ($add('photo')) {
                $table->string('photo')->nullable();
            }
            if ($add('is_active')) {
                $table->boolean('is_active')->default(true);
            }
        });

        Schema::table('services', function (Blueprint $table) {
            if (! Schema::hasColumn('services', 'category')) {
                $table->string('category')->nullable();
            }
            if (! Schema::hasColumn('services', 'price_min')) {
                $table->decimal('price_min', 10, 2)->nullable();
            }
            if (! Schema::hasColumn('services', 'duration_minutes')) {
                $table->integer('duration_minutes')->nullable();
            }
        });
    }

    public function down(): void
    {
        // See header comment.
    }
};
