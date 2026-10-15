<?php

namespace App\Notifications;

use App\Models\ClinicApplication;

class ClinicApplicationDecided extends AppNotification
{
    public function __construct(public ClinicApplication $application)
    {
        $this->afterCommit();
    }

    protected function kind(): string
    {
        return 'clinic_verification';
    }

    protected function title(): string
    {
        return $this->application->status === ClinicApplication::APPROVED
            ? 'Clinic application approved'
            : 'Clinic application needs changes';
    }

    protected function message(): string
    {
        $name = $this->application->clinic_name;

        return $this->application->status === ClinicApplication::APPROVED
            ? "{$name} is verified. You can now set up services, dentists and schedules."
            : "{$name} was not approved yet. Review the notes, update your application and resubmit.";
    }

    protected function resource(): ?array
    {
        return ['type' => 'clinic_application', 'id' => $this->application->id];
    }
}
