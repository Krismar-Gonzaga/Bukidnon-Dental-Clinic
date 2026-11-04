<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A planned return visit: a reminder for the dentist, not a booked appointment. */
class FollowUp extends Model
{
    public const PRIORITIES = ['routine', 'high'];

    public const STATUSES = ['scheduled', 'confirmed', 'completed', 'cancelled'];

    /** Still expected to happen. */
    public const OPEN = ['scheduled', 'confirmed'];

    protected $fillable = ['purpose', 'due_on', 'priority', 'status', 'notes'];

    protected $casts = [
        'due_on' => 'date:Y-m-d',
        'reminder_sent_at' => 'datetime',
    ];

    public function scopeOpen(Builder $query): Builder
    {
        return $query->whereIn('status', self::OPEN);
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function dentist(): BelongsTo
    {
        return $this->belongsTo(Dentist::class);
    }
}
