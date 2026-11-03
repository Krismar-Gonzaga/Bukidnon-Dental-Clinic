<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * draft → pending → under_review → approved | rejected
 * A rejected application may be edited and resubmitted (→ pending).
 */
class ClinicApplication extends Model
{
    use HasFactory;

    public const DRAFT = 'draft';
    public const PENDING = 'pending';
    public const UNDER_REVIEW = 'under_review';
    public const APPROVED = 'approved';
    public const REJECTED = 'rejected';

    /** Documents an application must include before it can be submitted. */
    public const REQUIRED_DOCUMENTS = ['business_permit', 'doh_license', 'prc_id', 'bir_registration'];

    public const DOCUMENT_TYPES = [...self::REQUIRED_DOCUMENTS, 'other'];

    protected $fillable = [
        'clinic_name',
        'description',
        'address',
        'city',
        'province',
        'contact_number',
        'email',
        'latitude',
        'longitude',
        'representative_name',
        'representative_position',
    ];

    protected $casts = [
        'latitude' => 'float',
        'longitude' => 'float',
        'submitted_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    public function isEditableByApplicant(): bool
    {
        return in_array($this->status, [self::DRAFT, self::REJECTED], true);
    }

    public function missingDocuments(): array
    {
        // Lists load documents up front: reuse them instead of a query per row.
        $present = $this->relationLoaded('documents')
            ? $this->documents->pluck('document_type')->all()
            : $this->documents()->pluck('document_type')->all();

        return array_values(array_diff(self::REQUIRED_DOCUMENTS, $present));
    }

    public function applicant(): BelongsTo
    {
        return $this->belongsTo(User::class, 'applicant_id');
    }

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(VerificationDocument::class);
    }
}
