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

    /** Private: photos are only served to their owner, never from a public URL. */
    public const PHOTO_DISK = 'local';

    public const CONSENTS = ['email_follow_up', 'share_medical_history', 'emergency_contact_consent', 'promotions'];

    protected $fillable = [
        'phone',
        'address',
        'birth_date',
        'gender',
        'full_name',
        'email',
        'emergency_contact_name',
        'emergency_contact_phone',
        'civil_status',
        'blood_type',
        'city',
        'province',
        'zip_code',
        'emergency_contact_relationship',
        'emergency_contact_address',
        'health_profile',
        'consents',
    ];

    protected $casts = [
        'birth_date' => 'date:Y-m-d',
        'health_profile' => 'encrypted:array',
        'consents' => 'array',
    ];

    // Patients are serialized in some responses (e.g. the signed-in user), so these
    // must be asked for explicitly, by someone allowed to see them.
    protected $hidden = ['health_profile', 'consents', 'photo_path'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function clinics(): BelongsToMany
    {
        return $this->belongsToMany(Clinic::class, 'clinic_patients')->withTimestamps();
    }

    public function savedClinics(): BelongsToMany
    {
        return $this->belongsToMany(Clinic::class, 'patient_saved_clinics')->withTimestamps();
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

    /** Every consent, off until the patient turns it on. */
    public function consentValues(): array
    {
        return collect(self::CONSENTS)
            ->mapWithKeys(fn (string $key) => [$key => (bool) ($this->consents[$key] ?? false)])
            ->all();
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
