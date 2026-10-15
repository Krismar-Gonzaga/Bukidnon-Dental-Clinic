<?php

namespace App\Notifications;

use App\Models\Appointment;
use App\Support\BusinessTime;

/** Tells a patient that something happened to their appointment. */
class AppointmentUpdated extends AppNotification
{
    private const TITLES = [
        'requested' => 'Appointment request received',
        'confirmed' => 'Appointment confirmed',
        'rejected' => 'Appointment request declined',
        'cancelled' => 'Appointment cancelled',
        'rescheduled' => 'Appointment rescheduled',
        'reschedule_requested' => 'Reschedule request sent',
        'checked_in' => 'You are checked in',
        'completed' => 'Appointment completed',
        'no_show' => 'Appointment marked as missed',
    ];

    public function __construct(public Appointment $appointment, public string $event)
    {
        $this->afterCommit();
    }

    protected function kind(): string
    {
        return 'appointment';
    }

    protected function title(): string
    {
        return self::TITLES[$this->event] ?? 'Appointment updated';
    }

    protected function message(): string
    {
        $clinic = $this->appointment->clinic?->name ?? 'the clinic';
        $when = BusinessTime::local($this->appointment->starts_at)->format('D, M j, Y g:i A');

        return match ($this->event) {
            'requested' => "Your request at {$clinic} for {$when} was sent and is waiting for confirmation.",
            'confirmed' => "Your appointment at {$clinic} on {$when} is confirmed.",
            'rejected' => "{$clinic} could not accept your request for {$when}.",
            'cancelled' => "Your appointment at {$clinic} on {$when} was cancelled.",
            'rescheduled' => "Your appointment at {$clinic} is now on {$when}.",
            'reschedule_requested' => "Your request to move your appointment at {$clinic} was sent.",
            'checked_in' => "You are checked in at {$clinic}.",
            'completed' => "Your visit at {$clinic} is complete. You can now leave a review.",
            'no_show' => "Your appointment at {$clinic} on {$when} was marked as missed.",
            default => "Your appointment at {$clinic} on {$when} was updated.",
        };
    }

    protected function resource(): ?array
    {
        return ['type' => 'appointment', 'id' => $this->appointment->id];
    }
}
