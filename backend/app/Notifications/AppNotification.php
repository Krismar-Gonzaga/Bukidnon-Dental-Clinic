<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Base for application notifications.
 *
 * - Always stored in the in-app notification center (database channel),
 *   written immediately so it shows up without a queue worker.
 * - Also emailed, through the queue, unless the user turned email off in
 *   users.notification_preferences ({"email": false}).
 * - Text must not contain clinical details: emails and push previews can be
 *   read on lock screens or by other people.
 */
abstract class AppNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public array $backoff = [60, 300];

    /** Short category, e.g. "appointment", used by clients for icons/filters. */
    abstract protected function kind(): string;

    abstract protected function title(): string;

    abstract protected function message(): string;

    /** Client route hint, e.g. ['type' => 'appointment', 'id' => 5]. */
    protected function resource(): ?array
    {
        return null;
    }

    /** The preference that can turn this notification off, if any. */
    protected function category(): ?string
    {
        return null;
    }

    public function via(object $notifiable): array
    {
        $channels = ['database'];
        $preferences = $notifiable->notification_preferences ?? [];

        if (($category = $this->category()) && ($preferences['categories'][$category] ?? true) === false) {
            return [];
        }

        if (($preferences['email'] ?? true) && ! empty($notifiable->email)) {
            $channels[] = 'mail';
        }

        return $channels;
    }

    public function viaConnections(): array
    {
        return ['database' => 'sync'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'kind' => $this->kind(),
            'title' => $this->title(),
            'message' => $this->message(),
            'resource' => $this->resource(),
        ];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject($this->title())
            ->line($this->message())
            ->action('Open Bukidnon Dental Portal', config('app.frontend_url'));
    }
}
