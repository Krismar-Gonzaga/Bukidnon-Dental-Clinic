<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Patient identity and contact details. A patient either has a portal
 * account (user_id) or was registered by clinic staff as a walk-in, in which
 * case full_name/email hold their details.
 */
class Patient extends Model
{
    use HasFactory;

    protected $fillable = [
        'phone',
        'address',
        'birth_date',
        'gender',
        'full_name',
        'email',
        'emergency_contact_name',
        'emergency_contact_phone',
    ];

    protected $casts = [
        'birth_date' => 'date:Y-m-d',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function clinics(): BelongsToMany
    {
        return $this->belongsToMany(Clinic::class, 'clinic_patients')->withTimestamps();
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class);
    }

    public function medicalHistories(): HasMany
    {
        return $this->hasMany(PatientMedicalHistory::class);
    }

    public function records(): HasMany
    {
        return $this->hasMany(PatientRecord::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }

    public function getDisplayNameAttribute(): ?string
    {
        return $this->user?->name ?? $this->full_name;
    }

    public function getContactEmailAttribute(): ?string
    {
        return $this->user?->email ?? $this->email;
    }

    /** Make the patient known to a clinic (idempotent). */
    public function registerWith(Clinic|int $clinic, ?User $registeredBy = null): void
    {
        $clinicId = $clinic instanceof Clinic ? $clinic->id : $clinic;

        $this->clinics()->syncWithoutDetaching([
            $clinicId => ['registered_by' => $registeredBy?->id],
        ]);
    }
}
