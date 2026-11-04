<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A file on the private disk. Never expose `path`; serve via signed links. */
class VerificationDocument extends Model
{
    public const DISK = 'local';

    protected $fillable = [];

    protected $hidden = ['path'];

    protected $casts = ['size' => 'integer'];

    public function application(): BelongsTo
    {
        return $this->belongsTo(ClinicApplication::class, 'clinic_application_id');
    }
}
