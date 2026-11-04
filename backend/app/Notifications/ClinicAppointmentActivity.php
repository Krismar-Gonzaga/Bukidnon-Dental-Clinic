<?php

namespace App\Notifications;

use App\Models\Appointment;
use App\Support\BusinessTime;

/** Tells clinic staff about patient-initiated appointment activity. */
class ClinicAppointmentActivity extends AppNotification
{
    public function __construct(public Appointment $appointment, public string $event)
    {
        $this->afterCommit();
    }

    protected function kind(): string
    {
        return 'appointment';
    }

    protected function category(): ?string
    {
        return match ($this->event) {
            'requested', 'reschedule_requested' => 'appointment_requests',
            'cancelled' => 'appointment_cancellations',
            default => null,
        };
    }

    protected function title(): string
    {
        return match ($this->event) {
            'requested' => 'New appointment request',
            'cancelled' => 'Appointment cancelled by patient',
            'reschedule_requested' => 'Reschedule requested',
            default => 'Appointment activity',
        };
    }

    protected function message(): string
    {
        $when = BusinessTime::local($this->appointment->starts_at)->format('D, M j g:i A');
        $patient = $this->appointment->patient_name;

        return match ($this->event) {
            'requested' => "{$patient} requested an appointment on {$when}.",
            'cancelled' => "{$patient} cancelled their appointment on {$when}.",
            'reschedule_requested' => "{$patient} asked to move their appointment on {$when}.",
            default => "Appointment on {$when} was updated.",
        };
    }

    protected function resource(): ?array
    {
        return ['type' => 'clinic_appointment', 'id' => $this->appointment->id, 'clinic_id' => $this->appointment->clinic_id];
    }
}
