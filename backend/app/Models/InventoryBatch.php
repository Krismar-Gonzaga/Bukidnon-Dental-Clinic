<?php

namespace App\Models;

use App\Support\BusinessTime;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One lot of an item. quantity_on_hand changes only via InventoryService. */
class InventoryBatch extends Model
{
    protected $fillable = ['supplier_id', 'batch_number', 'expires_on'];

    protected $casts = [
        'expires_on' => 'date:Y-m-d',
        'quantity_on_hand' => 'integer',
        'received_at' => 'datetime',
    ];

    public function item(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function supplier(): BelongsTo
    {
        return $this->belongsTo(Supplier::class);
    }

    public function isExpired(): bool
    {
        return $this->expires_on !== null && $this->expires_on->lt(BusinessTime::today());
    }

    public function scopeUsable(Builder $query): Builder
    {
        return $query->where('quantity_on_hand', '>', 0)
            ->where(fn (Builder $q) => $q->whereNull('expires_on')
                ->orWhere('expires_on', '>=', BusinessTime::today()->toDateString()));
    }

    public function scopeExpired(Builder $query): Builder
    {
        return $query->where('quantity_on_hand', '>', 0)
            ->whereNotNull('expires_on')
            ->where('expires_on', '<', BusinessTime::today()->toDateString());
    }
}
