<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InventoryItem extends Model
{
    protected $fillable = ['branch_id', 'category_id', 'name', 'description', 'unit', 'minimum_stock', 'is_active'];

    protected $casts = [
        'minimum_stock' => 'integer',
        'is_active' => 'boolean',
    ];

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(ClinicBranch::class, 'branch_id');
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(InventoryCategory::class, 'category_id');
    }

    public function batches(): HasMany
    {
        return $this->hasMany(InventoryBatch::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(InventoryMovement::class)->latest('created_at')->latest('id');
    }

    /** Stock that can be used: batches with quantity that have not expired. */
    public function usableQuantity(): int
    {
        return (int) $this->batches()->usable()->sum('quantity_on_hand');
    }

    public function expiredQuantity(): int
    {
        return (int) $this->batches()->expired()->sum('quantity_on_hand');
    }
}
