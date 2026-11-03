<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The PostgreSQL trigger from create_audit_logs_table keeps audit_logs
 * append-only. Sealing (App\Services\AuditChain) must write hash and
 * prev_hash once, so the trigger now allows exactly that: an UPDATE of an
 * unsealed row that sets the hash and changes no other column. Edits,
 * deletes and re-sealing are still refused by the database itself.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION audit_logs_prevent_change() RETURNS trigger AS $$
            BEGIN
                IF TG_OP = 'UPDATE'
                   AND OLD.hash IS NULL AND OLD.prev_hash IS NULL AND NEW.hash IS NOT NULL
                   AND (to_jsonb(NEW) - 'hash' - 'prev_hash') = (to_jsonb(OLD) - 'hash' - 'prev_hash') THEN
                    RETURN NEW;
                END IF;
                RAISE EXCEPTION 'audit_logs is append-only';
            END;
            $$ LANGUAGE plpgsql;
        SQL);
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        DB::unprepared(<<<'SQL'
            CREATE OR REPLACE FUNCTION audit_logs_prevent_change() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'audit_logs is append-only';
            END;
            $$ LANGUAGE plpgsql;
        SQL);
    }
};
