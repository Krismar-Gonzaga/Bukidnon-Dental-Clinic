<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** System admin portal: platform settings, announcements and "more documents" on registrations. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_settings', function (Blueprint $table) {
            $table->string('key', 60)->primary();
            $table->json('value')->nullable();
            $table->timestamps();
        });

        Schema::create('system_announcements', function (Blueprint $table) {
            $table->id();
            $table->string('title', 150);
            $table->text('content');
            $table->string('audience', 20)->default('all');
            $table->string('status', 20)->default('draft');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('published_at')->nullable();
            $table->timestamp('archived_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
        });

        Schema::table('clinic_applications', function (Blueprint $table) {
            $table->timestamp('documents_requested_at')->nullable();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('phone', 20)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('phone');
        });

        Schema::table('clinic_applications', function (Blueprint $table) {
            $table->dropColumn('documents_requested_at');
        });

        Schema::dropIfExists('system_announcements');
        Schema::dropIfExists('platform_settings');
    }
};
