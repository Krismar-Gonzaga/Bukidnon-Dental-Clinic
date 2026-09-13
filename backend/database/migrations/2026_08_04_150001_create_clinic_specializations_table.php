<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Pivot table for Clinic::specializations()/Specialization::clinics() belongsToMany.
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clinic_specializations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->onDelete('cascade');
            $table->foreignId('specialization_id')->constrained()->onDelete('cascade');
            $table->timestamps();
            $table->unique(['clinic_id', 'specialization_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clinic_specializations');
    }
};
