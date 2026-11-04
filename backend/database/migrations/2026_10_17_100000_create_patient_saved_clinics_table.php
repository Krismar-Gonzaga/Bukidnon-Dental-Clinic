<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Clinics a patient bookmarked ("Saved Clinics" in the patient portal).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patient_saved_clinics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('patient_id')->constrained()->cascadeOnDelete();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['patient_id', 'clinic_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_saved_clinics');
    }
};
