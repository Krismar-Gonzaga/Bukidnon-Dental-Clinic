<?php

namespace App\Http\Resources;

use App\Support\BusinessTime;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\InventoryItem */
class InventoryItemResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $nearExpiryCutoff = BusinessTime::today()->addDays(config('booking.near_expiry_days'));
        $usable = $this->usableQuantity();

        return [
            'id' => $this->id,
            'name' => $this->name,
            'brand' => $this->brand,
            'description' => $this->description,
            'unit' => $this->unit,
            'unit_cost' => $this->unit_cost,
            'next_expiry' => $this->whenLoaded('batches', fn () => $this->batches
                ->filter(fn ($b) => $b->quantity_on_hand > 0 && $b->expires_on && ! $b->isExpired())
                ->min(fn ($b) => $b->expires_on->toDateString())),
            'category' => $this->category?->name,
            'category_id' => $this->category_id,
            'branch_id' => $this->branch_id,
            'minimum_stock' => $this->minimum_stock,
            'is_active' => $this->is_active,
            'quantity_usable' => $usable,
            'quantity_expired' => $this->expiredQuantity(),
            'is_low_stock' => $this->is_active && $usable <= $this->minimum_stock,
            'batches' => $this->whenLoaded('batches', fn () => $this->batches->map(fn ($b) => [
                'id' => $b->id,
                'batch_number' => $b->batch_number,
                'expires_on' => $b->expires_on?->toDateString(),
                'quantity_on_hand' => $b->quantity_on_hand,
                'supplier' => $b->supplier?->name,
                'is_expired' => $b->isExpired(),
                'is_near_expiry' => ! $b->isExpired() && $b->expires_on && $b->expires_on->lte($nearExpiryCutoff),
            ])),
            'movements' => $this->whenLoaded('movements', fn () => $this->movements->map(fn ($m) => [
                'id' => $m->id,
                'type' => $m->type,
                'quantity' => $m->quantity,
                'balance_after' => $m->balance_after,
                'batch_id' => $m->inventory_batch_id,
                'reason' => $m->reason,
                'performed_by' => $m->performedBy?->name,
                'at' => BusinessTime::iso($m->created_at),
            ])),
        ];
    }
}
