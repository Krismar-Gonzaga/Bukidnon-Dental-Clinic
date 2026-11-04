<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A document a clinic keeps for a patient (X-ray, treatment plan). Stored privately. */
class PatientFile extends Model
{
    public const DISK = 'local';

    public const CATEGORIES = ['panoramic_xray', 'periapical_xray', 'intraoral_photo', 'lab_result', 'other'];

    protected $fillable = ['name', 'path', 'mime_type', 'size', 'category', 'notes'];

    protected $casts = ['size' => 'integer'];

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
