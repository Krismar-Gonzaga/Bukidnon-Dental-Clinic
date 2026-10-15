<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
| Reviews: status stays pending | approved (published) | rejected (hidden).
| One review per appointment; reports let users flag a review for a
| system administrator to moderate.
*/
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->foreignId('moderated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('moderated_at')->nullable();
            $table->text('moderation_note')->nullable();

            $table->unique('appointment_id');
            $table->index(['clinic_id', 'status']);
        });

        Schema::create('review_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('review_id')->constrained()->cascadeOnDelete();
            $table->foreignId('reported_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reason');
            $table->string('status', 20)->default('open'); // open | resolved
            $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            $table->unique(['review_id', 'reported_by']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('review_reports');

        Schema::table('reviews', function (Blueprint $table) {
            $table->dropUnique(['appointment_id']);
            $table->dropIndex(['clinic_id', 'status']);
            $table->dropConstrainedForeignId('moderated_by');
            $table->dropColumn(['moderated_at', 'moderation_note']);
        });
    }
};
