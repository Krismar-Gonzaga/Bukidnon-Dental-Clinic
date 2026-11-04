<?php

namespace App\Console\Commands;

use App\Models\Appointment;
use App\Models\FollowUp;
use App\Notifications\PortalNotice;
use App\Support\BusinessTime;
use Illuminate\Console\Command;

/**
 * Each morning: tells dentists how many visits they have today and which follow-ups are due
 * within three days. reminder_sent_at is set first, so a follow-up is announced at most once.
 */
class SendDentistDigest extends Command
{
    private const FOLLOW_UP_DAYS = 3;

    protected $signature = 'dentists:send-digest';

    protected $description = 'Tell dentists about today\'s appointments and follow-ups coming due';

    public function handle(): int
    {
        $today = BusinessTime::today();

        Appointment::query()
            ->whereNotNull('dentist_id')
            ->whereNotIn('status', [Appointment::CANCELLED, Appointment::REJECTED])
            ->whereBetween('starts_at', [BusinessTime::utc($today), BusinessTime::utc($today->endOfDay())])
            ->with('dentist.user')
            ->get()
            ->groupBy(fn (Appointment $a) => $a->dentist_id.'-'.$a->clinic_id)
            ->each(function ($visits) {
                $total = $visits->count();
                $visits->first()->dentist?->user?->notify(new PortalNotice(
                    'appointment',
                    'Appointment Reminder',
                    'You have '.$total.' '.($total === 1 ? 'appointment' : 'appointments').' scheduled for today.',
                    'appointment_reminders',
                ));
            });

        FollowUp::open()
            ->whereNull('reminder_sent_at')
            ->whereNotNull('dentist_id')
            ->where('due_on', '<=', $today->addDays(self::FOLLOW_UP_DAYS)->toDateString())
            ->with(['dentist.user', 'patient.user'])
            ->get()
            ->each(function (FollowUp $followUp) {
                $followUp->forceFill(['reminder_sent_at' => now()])->save();
                $followUp->dentist?->user?->notify(new PortalNotice(
                    'follow_up',
                    'Follow-up Due',
                    "{$followUp->patient?->display_name} has a follow-up due on ".BusinessTime::parse($followUp->due_on->toDateString())->format('F j, Y').'.',
                    'follow_ups',
                ));
            });

        return self::SUCCESS;
    }
}
