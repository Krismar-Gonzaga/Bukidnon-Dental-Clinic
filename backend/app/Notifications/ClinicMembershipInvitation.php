<?php

namespace App\Notifications;

use App\Models\ClinicMembership;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * Sent when a clinic adds someone as staff. New accounts get a link to set
 * their password; existing accounts are asked to accept the invitation.
 */
class ClinicMembershipInvitation extends AppNotification
{
    public function __construct(public ClinicMembership $membership, public ?string $passwordSetupUrl = null)
    {
        $this->afterCommit();
    }

    protected function kind(): string
    {
        return 'clinic_invitation';
    }

    protected function title(): string
    {
        return 'You were added to '.$this->membership->clinic->name;
    }

    protected function message(): string
    {
        $role = str_replace('_', ' ', $this->membership->role);

        return $this->passwordSetupUrl
            ? "{$this->membership->clinic->name} created a {$role} account for you. Set your password to sign in."
            : "{$this->membership->clinic->name} invited you to join as {$role}. Accept the invitation in the portal.";
    }

    protected function resource(): ?array
    {
        return ['type' => 'clinic_membership', 'id' => $this->membership->id];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject($this->title())
            ->line($this->message())
            ->action($this->passwordSetupUrl ? 'Set your password' : 'Open Bukidnon Dental Portal',
                $this->passwordSetupUrl ?? config('app.frontend_url'));
    }
}
