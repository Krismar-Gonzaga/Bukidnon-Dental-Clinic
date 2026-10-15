<?php

namespace App\Console\Commands;

use App\Models\Appointment;
use App\Notifications\AppointmentReminder;
use Illuminate\Console\Command;

/**
 * Reminds patients of confirmed appointments starting within the reminder
 * window. reminder_sent_at is set first, so a reminder is sent at most once
 * even if the command runs again.
 */
class SendAppointmentReminders extends Command
{
    protected $signature = 'appointments:send-reminders';

    protected $description = 'Send reminders for upcoming confirmed appointments';

    public function handle(): int
    {
        $due = Appointment::where('status', Appointment::CONFIRMED)
            ->whereNull('reminder_sent_at')
            ->where('starts_at', '>', now())
            ->where('starts_at', '<=', now()->addHours(config('booking.reminder_hours_before')))
            ->whereHas('patient.user')
            ->with(['patient.user', 'clinic'])
            ->get();

        $sent = 0;
        foreach ($due as $appointment) {
            $claimed = Appointment::whereKey($appointment->id)->whereNull('reminder_sent_at')->update(['reminder_sent_at' => now()]);
            if ($claimed) {
                $appointment->patient->user->notify(new AppointmentReminder($appointment));
                $sent++;
            }
        }

        $this->info("Sent {$sent} reminder(s).");

        return self::SUCCESS;
    }
}
