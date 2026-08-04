<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Superseded by 2026_06_05_052422_create_clinics_table.php, which already creates
// the full `clinics` table. Kept as a guarded no-op so existing migration history
// (this file already ran on some environments) doesn't break `migrate`.
return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasTable('clinics')) {
            Schema::create('clinics', function (Blueprint $table) {
                $table->id();
                $table->timestamps();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op: dropping `clinics` here could also drop the table owned by
        // 2026_06_05_052422_create_clinics_table.php.
    }
};
