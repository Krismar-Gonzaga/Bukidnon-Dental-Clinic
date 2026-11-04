<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A service a clinic offers, with its published price and duration. */
class ServiceRate extends Model
{
    use HasFactory;

    protected $fillable = [
        'service_id',
        'service_name',
        'description',
        'price',
        'currency',
        'duration_minutes',
        'is_available',
        'price_max',
        'duration_max',
    ];

    protected $casts = [
        'is_available' => 'boolean',
        'price' => 'decimal:2',
        'price_max' => 'decimal:2',
        'duration_max' => 'integer',
        'archived_at' => 'datetime',
        'duration_minutes' => 'integer',
    ];

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function scopeAvailable(Builder $query): Builder
    {
        return $query->where('is_available', true);
    }
}
