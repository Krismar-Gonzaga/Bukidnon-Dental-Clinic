<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A clinic's plan. Renewed when a system administrator verifies a payment. */
class Subscription extends Model
{
    public const STATUS_ACTIVE = 'active';

    protected $fillable = ['plan', 'status', 'renews_at'];

    protected $casts = ['renews_at' => 'datetime'];

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }
}
