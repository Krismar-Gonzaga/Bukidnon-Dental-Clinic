<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * A clinical entry. Once final, content is never edited in place: corrections are new
 * records with amends_record_id set, and the corrected record only gains superseded_at.
 * A draft is still its author's working copy: nobody else sees it, it can be changed until
 * it is finalized, and it never reaches the patient. Deletion is blocked either way.
 */
class PatientRecord extends Model
{
    public const TYPES = ['examination', 'treatment', 'consultation'];

    public const DRAFT = 'draft';

    public const FINAL = 'final';

    // The two pages of the dentist portal: procedures done, and everything else that was written.
    public const NOTE_TYPES = ['examination', 'consultation'];

    private const CLINICAL_FIELDS = [
        'record_type', 'chief_complaint', 'findings', 'procedures', 'tooth_numbers',
        'notes', 'care_instructions', 'patient_id', 'clinic_id', 'dentist_id', 'appointment_id',
        'diagnosis', 'treatment_plan', 'follow_up_recommendations', 'materials_used', 'performed_on', 'status',
    ];

    protected $fillable = [
        'record_type',
        'chief_complaint',
        'findings',
        'procedures',
        'tooth_numbers',
        'notes',
        'care_instructions',
        'is_patient_visible',
        'amendment_reason',
        'diagnosis',
        'treatment_plan',
        'follow_up_recommendations',
        'materials_used',
        'performed_on',
    ];

    protected $casts = [
        'is_patient_visible' => 'boolean',
        'superseded_at' => 'datetime',
        'performed_on' => 'date:Y-m-d',
    ];

    protected static function booted(): void
    {
        static::updating(function (PatientRecord $record) {
            if ($record->getOriginal('status') !== self::DRAFT && $record->isDirty(self::CLINICAL_FIELDS)) {
                throw new LogicException('Clinical records cannot be edited; create an amendment instead.');
            }
        });
        static::deleting(fn () => throw new LogicException('Clinical records cannot be deleted.'));
    }

    public function scopeCurrent(Builder $query): Builder
    {
        return $query->whereNull('superseded_at');
    }

    public function scopeFinal(Builder $query): Builder
    {
        return $query->where('status', self::FINAL);
    }

    /** Final records, plus this author's own drafts. */
    public function scopeReadableBy(Builder $query, int $userId): Builder
    {
        return $query->where(fn ($q) => $q->where('status', self::FINAL)->orWhere('created_by', $userId));
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }

    public function dentist(): BelongsTo
    {
        return $this->belongsTo(Dentist::class);
    }

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    public function amends(): BelongsTo
    {
        return $this->belongsTo(PatientRecord::class, 'amends_record_id');
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
