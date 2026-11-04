<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A dentist's professional profile (one per user account). Which clinics
 * they work at comes from active `dentist` clinic memberships; `clinic_id`
 * is their primary clinic, kept for older clients.
 */
class Dentist extends Model
{
    use HasFactory;

    protected $fillable = [
        'specialization_id',
        'license_number',
        'years_experience',
        'qualifications',
        'secondary_specialization',
        'education',
        'website',
        'ptr_number',
        's2_number',
        'bio',
        'photo',
        'is_active',
    ];

    protected $casts = [
        'years_experience' => 'integer',
        'is_active' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }

    public function specialization(): BelongsTo
    {
        return $this->belongsTo(Specialization::class);
    }

    public function schedules(): HasMany
    {
        return $this->hasMany(DentistSchedule::class);
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class);
    }

    /** Active dentists with an active dentist membership in the clinic. */
    public function scopeWorkingAt(Builder $query, int $clinicId): Builder
    {
        return $query->where('is_active', true)
            ->whereHas('user', fn (Builder $user) => $user
                ->where('status', User::STATUS_ACTIVE)
                ->whereHas('clinicMemberships', fn (Builder $membership) => $membership
                    ->where('clinic_id', $clinicId)
                    ->where('role', ClinicMembership::ROLE_DENTIST)
                    ->where('status', ClinicMembership::STATUS_ACTIVE)));
    }

    public function getNameAttribute(): ?string
    {
        return $this->user?->name;
    }
}
