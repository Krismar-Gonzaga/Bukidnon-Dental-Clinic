<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Tamper evidence for the audit log (App\Services\AuditChain). Each sealed
 * entry stores a keyed hash of its own contents and of the previous entry's
 * hash, so editing or deleting a sealed entry breaks the chain. Additive and
 * nullable: entries are written as before and sealed shortly afterwards.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->char('prev_hash', 64)->nullable();
            $table->char('hash', 64)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropColumn(['prev_hash', 'hash']);
        });
    }
};
