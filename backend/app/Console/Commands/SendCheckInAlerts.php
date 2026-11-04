<?php

namespace App\Console\Commands;

use App\Models\Appointment;
use App\Models\ClinicMembership;
use App\Models\User;
use App\Notifications\CheckInReminder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

/**
 * Tells front desk staff about confirmed appointments starting soon that have not checked in.
 * check_in_alert_sent_at is set first, so an alert goes out at most once.
 */
class SendCheckInAlerts extends Command
{
    protected $signature = 'appointments:send-check-in-alerts';

    protected $description = 'Alert the front desk about patients due soon who have not checked in';

    public function handle(): int
    {
        $due = Appointment::where('status', Appointment::CONFIRMED)
            ->whereNull('check_in_alert_sent_at')
            ->where('starts_at', '>', now())
            ->where('starts_at', '<=', now()->addMinutes(config('booking.check_in_alert_minutes')))
            ->get();

        $sent = 0;
        foreach ($due as $appointment) {
            $claimed = Appointment::whereKey($appointment->id)->whereNull('check_in_alert_sent_at')->update(['check_in_alert_sent_at' => now()]);
            if (! $claimed) {
                continue;
            }

            $recipients = User::where('status', User::STATUS_ACTIVE)
                ->whereIn('id', ClinicMembership::where('clinic_id', $appointment->clinic_id)
                    ->where('status', ClinicMembership::STATUS_ACTIVE)
                    ->where('role', ClinicMembership::ROLE_STAFF)
                    ->with('clinic')
                    ->get()
                    ->filter(fn (ClinicMembership $m) => $m->grants('appointments.manage'))
                    ->pluck('user_id'))
                ->get();

            Notification::send($recipients, new CheckInReminder($appointment));
            $sent++;
        }

        $this->info("Sent {$sent} check-in alert(s).");

        return self::SUCCESS;
    }
}
