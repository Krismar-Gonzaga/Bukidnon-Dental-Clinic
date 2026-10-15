<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Remove API tokens that expired more than a day ago.
Schedule::command('sanctum:prune-expired --hours=24')->daily();

// Run `php artisan schedule:work` (development) or a cron calling
// `php artisan schedule:run` every minute (production) for these.
Schedule::command('appointments:send-reminders')->everyFifteenMinutes()->withoutOverlapping();
Schedule::command('inventory:send-alerts')->dailyAt('07:00')->timezone(config('booking.timezone'));
