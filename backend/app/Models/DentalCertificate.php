<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/** A certificate that was issued. Kept as issued, so there is a record of what was signed. */
class DentalCertificate extends Model
{
    public const TYPES = ['medical', 'clearance', 'treatment'];

    protected $fillable = ['type', 'purpose'];

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Certificates cannot be edited once issued.'));
        static::deleting(fn () => throw new LogicException('Certificates cannot be deleted.'));
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
