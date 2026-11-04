<?php

namespace App\Notifications;

use App\Models\Clinic;

class InventoryAlert extends AppNotification
{
    public function __construct(
        public Clinic $clinic,
        public int $lowStock,
        public int $nearExpiry,
        public int $expired,
        public string $date,
    ) {
    }

    protected function kind(): string
    {
        return 'inventory';
    }

    /** Stock and expiry share one daily digest, sent if the person still wants either. */
    public function via(object $notifiable): array
    {
        $categories = $notifiable->notification_preferences['categories'] ?? [];
        $wantsStock = $this->lowStock > 0 && (($categories['inventory_low_stock'] ?? true) || ($categories['inventory_critical'] ?? true));
        $wantsExpiry = ($this->nearExpiry + $this->expired) > 0 && ($categories['inventory_expiry'] ?? true);

        return $wantsStock || $wantsExpiry ? parent::via($notifiable) : [];
    }

    protected function title(): string
    {
        return 'Inventory needs review';
    }

    protected function message(): string
    {
        $parts = array_filter([
            $this->lowStock ? "{$this->lowStock} low on stock" : null,
            $this->nearExpiry ? "{$this->nearExpiry} expiring soon" : null,
            $this->expired ? "{$this->expired} expired" : null,
        ]);

        return "{$this->clinic->name}: ".implode(', ', $parts).'.';
    }

    protected function resource(): ?array
    {
        return ['type' => 'inventory_alerts', 'clinic_id' => $this->clinic->id, 'date' => $this->date];
    }
}
