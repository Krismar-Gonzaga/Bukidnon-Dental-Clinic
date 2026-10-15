<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/** Immutable stock movement history. */
class InventoryMovement extends Model
{
    public const RECEIPT = 'receipt';
    public const USAGE = 'usage';
    public const ADJUSTMENT = 'adjustment';
    public const DISPOSAL = 'disposal';

    public const UPDATED_AT = null;

    protected $fillable = [];

    protected $casts = [
        'quantity' => 'integer',
        'balance_after' => 'integer',
        'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Inventory movements cannot be modified.'));
        static::deleting(fn () => throw new LogicException('Inventory movements cannot be deleted.'));
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(InventoryItem::class, 'inventory_item_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(InventoryBatch::class, 'inventory_batch_id');
    }

    public function performedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'performed_by');
    }
}
