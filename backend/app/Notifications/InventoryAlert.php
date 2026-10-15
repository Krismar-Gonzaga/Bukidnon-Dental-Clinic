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
