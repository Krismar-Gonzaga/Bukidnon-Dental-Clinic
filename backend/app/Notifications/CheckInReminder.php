<?php

namespace App\Notifications;

use App\Models\Appointment;
use App\Support\BusinessTime;

/** Tells the front desk a patient is due soon and has not checked in. */
class CheckInReminder extends AppNotification
{
    public function __construct(public Appointment $appointment)
    {
        $this->afterCommit();
    }

    protected function kind(): string
    {
        return 'appointment';
    }

    protected function category(): ?string
    {
        return 'check_in_alerts';
    }

    protected function title(): string
    {
        return 'Check-in Reminder';
    }

    protected function message(): string
    {
        $time = BusinessTime::local($this->appointment->starts_at)->format('g:i A');

        return "{$this->appointment->patient_name}'s appointment is at {$time}. Not yet checked in.";
    }

    protected function resource(): ?array
    {
        return ['type' => 'clinic_appointment', 'id' => $this->appointment->id, 'clinic_id' => $this->appointment->clinic_id];
    }
}
