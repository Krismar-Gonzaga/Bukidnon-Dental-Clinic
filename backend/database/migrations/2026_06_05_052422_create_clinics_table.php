// database/migrations/xxxx_xx_xx_000001_create_clinics_table.php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('clinics', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->string('address');
            $table->string('city');
            $table->string('province')->default('Bukidnon');
            $table->string('contact_number');
            $table->string('email')->nullable();
            $table->string('image')->nullable();
            $table->decimal('rating', 2, 1)->default(0);
            $table->boolean('is_featured')->default(false);
            $table->boolean('is_verified')->default(false);
            $table->time('opening_time')->default('08:00:00');
            $table->time('closing_time')->default('17:00:00');
            $table->json('services_offered')->nullable();
            $table->json('dentists')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clinics');
    }
};