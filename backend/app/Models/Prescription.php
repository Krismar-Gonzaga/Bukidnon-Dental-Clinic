<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/** A medical document once issued: never edited or deleted, like a clinical record. */
class Prescription extends Model
{
    protected $fillable = ['medication', 'dosage', 'frequency', 'duration', 'instructions'];

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Prescriptions cannot be edited once issued.'));
        static::deleting(fn () => throw new LogicException('Prescriptions cannot be deleted.'));
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function dentist(): BelongsTo
    {
        return $this->belongsTo(Dentist::class);
    }

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }
}
