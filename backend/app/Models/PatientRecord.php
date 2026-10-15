<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use LogicException;

/**
 * A clinical entry. Content is never edited in place: corrections are new
 * records with amends_record_id set, and the corrected record only gains
 * superseded_at. Deletion is blocked to preserve clinical history.
 */
class PatientRecord extends Model
{
    public const TYPES = ['examination', 'treatment', 'consultation'];

    private const CLINICAL_FIELDS = [
        'record_type', 'chief_complaint', 'findings', 'procedures', 'tooth_numbers',
        'notes', 'care_instructions', 'patient_id', 'clinic_id', 'dentist_id', 'appointment_id',
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
    ];

    protected $casts = [
        'is_patient_visible' => 'boolean',
        'superseded_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::updating(function (PatientRecord $record) {
            if ($record->isDirty(self::CLINICAL_FIELDS)) {
                throw new LogicException('Clinical records cannot be edited; create an amendment instead.');
            }
        });
        static::deleting(fn () => throw new LogicException('Clinical records cannot be deleted.'));
    }

    public function scopeCurrent(Builder $query): Builder
    {
        return $query->whereNull('superseded_at');
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
