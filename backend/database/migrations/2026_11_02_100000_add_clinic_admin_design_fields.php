<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Fields the clinic admin pages show: an inventory item's brand and unit cost
 * (Total Value), and a staff member's work phone at this clinic. Additive and
 * nullable, so existing rows and older clients are unaffected.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->string('brand', 100)->nullable();
            $table->decimal('unit_cost', 10, 2)->nullable();
        });

        Schema::table('clinic_memberships', function (Blueprint $table) {
            $table->string('phone', 30)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('inventory_items', function (Blueprint $table) {
            $table->dropColumn(['brand', 'unit_cost']);
        });

        Schema::table('clinic_memberships', function (Blueprint $table) {
            $table->dropColumn('phone');
        });
    }
};
