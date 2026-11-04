<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

/**
 * Clinic schedules are defined in the business timezone (Asia/Manila by
 * default); timestamps are stored as UTC-aware values. Convert here.
 */
final class BusinessTime
{
    public static function zone(): string
    {
        return config('booking.timezone');
    }

    public static function now(): CarbonImmutable
    {
        return CarbonImmutable::now(self::zone());
    }

    public static function today(): CarbonImmutable
    {
        return self::now()->startOfDay();
    }

    /** Parse a date or datetime string as business-local time. */
    public static function parse(string $value): CarbonImmutable
    {
        return CarbonImmutable::parse($value, self::zone())->setTimezone(self::zone());
    }

    public static function local(CarbonInterface $moment): CarbonImmutable
    {
        return CarbonImmutable::instance($moment)->setTimezone(self::zone());
    }

    /**
     * Convert to the application timezone (UTC) before storing or binding
     * in queries: Laravel writes datetimes without an offset, so a
     * business-local value would otherwise be stored 8 hours off.
     */
    public static function utc(CarbonInterface $moment): CarbonImmutable
    {
        return CarbonImmutable::instance($moment)->setTimezone(config('app.timezone'));
    }

    /** SQL for a stored UTC timestamp's Philippine calendar day (YYYY-MM-DD), for grouping. */
    public static function daySql(string $column): string
    {
        return match (DB::connection()->getDriverName()) {
            'pgsql' => "to_char({$column} + interval '8 hours', 'YYYY-MM-DD')",
            'sqlite' => "date({$column}, '+8 hours')",
            default => "DATE(DATE_ADD({$column}, INTERVAL 8 HOUR))",
        };
    }

    /** SQL for a stored UTC timestamp's Philippine calendar month (YYYY-MM), for grouping. */
    public static function monthSql(string $column): string
    {
        return match (DB::connection()->getDriverName()) {
            'pgsql' => "to_char({$column} + interval '8 hours', 'YYYY-MM')",
            'sqlite' => "strftime('%Y-%m', {$column}, '+8 hours')",
            default => "DATE_FORMAT(DATE_ADD({$column}, INTERVAL 8 HOUR), '%Y-%m')",
        };
    }

    /** ISO 8601 with the business offset, e.g. 2026-10-20T09:00:00+08:00 */
    public static function iso(?CarbonInterface $moment): ?string
    {
        return $moment ? self::local($moment)->toIso8601String() : null;
    }
}
