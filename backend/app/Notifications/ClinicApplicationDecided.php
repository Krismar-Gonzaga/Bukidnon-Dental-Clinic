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
        return match (true) {
            $this->application->status === ClinicApplication::APPROVED => 'Clinic application approved',
            $this->application->documents_requested_at !== null => 'More documents needed for your clinic',
            default => 'Clinic application needs changes',
        };
    }

    protected function message(): string
    {
        $name = $this->application->clinic_name;

        return match (true) {
            $this->application->status === ClinicApplication::APPROVED => "{$name} is verified. You can now set up services, dentists and schedules.",
            $this->application->documents_requested_at !== null => "{$name} needs more documents. Read the request, upload them and submit again.",
            default => "{$name} was not approved yet. Review the notes, update your application and resubmit.",
        };
    }

    protected function resource(): ?array
    {
        return ['type' => 'clinic_application', 'id' => $this->application->id];
    }
}
