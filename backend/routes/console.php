<?php

use App\Services\AuditChain;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('audit:seal', function (AuditChain $chain) {
    $this->info('Sealed '.$chain->seal().' audit log entries.');
})->purpose('Add new audit log entries to the tamper-evident hash chain');

Artisan::command('audit:verify', function (AuditChain $chain) {
    $report = $chain->verify();
    $this->line("Checked {$report['checked']} sealed entries: {$report['status']}.");
    foreach ($report['problems'] as $problem) {
        $this->error("  #{$problem['id']} {$problem['message']}");
    }

    return $report['status'] === 'verified' ? 0 : 1;
})->purpose('Re-check the audit log hash chain');

Schedule::command('audit:seal')->everyFiveMinutes()->withoutOverlapping();

// Remove API tokens that expired more than a day ago.
Schedule::command('sanctum:prune-expired --hours=24')->daily();

// Run `php artisan schedule:work` (development) or a cron calling
// `php artisan schedule:run` every minute (production) for these.
Schedule::command('appointments:send-reminders')->everyFifteenMinutes()->withoutOverlapping();
Schedule::command('appointments:send-check-in-alerts')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('dentists:send-digest')->dailyAt('07:00')->timezone(config('booking.timezone'));
Schedule::command('admin:send-system-alerts')->everyFifteenMinutes()->withoutOverlapping();
Schedule::command('inventory:send-alerts')->dailyAt('07:00')->timezone(config('booking.timezone'));
