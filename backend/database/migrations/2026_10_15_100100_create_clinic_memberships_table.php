<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Who works at which clinic, and in what role. This is the source of truth
// for clinic-scoped authorization (see config/permissions.php).
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clinic_memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('clinic_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            // clinic_admin | dentist | staff | inventory_staff
            $table->string('role', 30);
            // invited | active | suspended
            $table->string('status', 20)->default('active');
            $table->foreignId('invited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['clinic_id', 'user_id']);
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clinic_memberships');
    }
};
