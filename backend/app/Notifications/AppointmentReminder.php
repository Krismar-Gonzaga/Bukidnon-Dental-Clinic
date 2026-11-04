<?php

namespace App\Notifications;

use App\Models\Appointment;
use App\Support\BusinessTime;

class AppointmentReminder extends AppNotification
{
    public function __construct(public Appointment $appointment)
    {
    }

    protected function kind(): string
    {
        return 'reminder';
    }

    protected function title(): string
    {
        return 'Upcoming appointment';
    }

    protected function message(): string
    {
        $clinic = $this->appointment->clinic?->name ?? 'your clinic';
        $when = BusinessTime::local($this->appointment->starts_at)->format('D, M j g:i A');

        return "Reminder: you have an appointment at {$clinic} on {$when}.";
    }

    protected function resource(): ?array
    {
        return ['type' => 'appointment', 'id' => $this->appointment->id];
    }
}
