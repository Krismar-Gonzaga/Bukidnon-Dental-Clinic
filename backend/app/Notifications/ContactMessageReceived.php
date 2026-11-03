<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** A message from the public contact form, sent to the support address. */
class ContactMessageReceived extends Notification
{
    public function __construct(private readonly array $data)
    {
    }

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $name = trim($this->data['first_name'].' '.$this->data['last_name']);

        return (new MailMessage)
            ->subject('Contact form: '.$this->data['subject'])
            ->replyTo($this->data['email'], $name)
            ->greeting('New message from the website')
            ->line("From: {$name} ({$this->data['email']})")
            ->line("Subject: {$this->data['subject']}")
            ->line($this->data['message']);
    }
}
