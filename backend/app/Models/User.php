<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_SUSPENDED = 'suspended';

    // `role` and `status` are deliberately not fillable: they are set only by
    // explicit, authorized code paths, never from request input.
    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'suspended_at' => 'datetime',
        'password' => 'hashed',
        'notification_preferences' => 'array',
    ];

    // Relationships
    public function patient()
    {
        return $this->hasOne(Patient::class);
    }

    public function dentist()
    {
        return $this->hasOne(Dentist::class);
    }

    public function clinicStaff()
    {
        return $this->hasOne(ClinicStaff::class);
    }

    public function clinicMemberships(): HasMany
    {
        return $this->hasMany(ClinicMembership::class);
    }

    // Account state
    public function isActive(): bool
    {
        return $this->status !== self::STATUS_SUSPENDED;
    }

    // Clinic-scoped authorization
    public function activeMembershipFor(Clinic|int $clinic): ?ClinicMembership
    {
        $clinicId = $clinic instanceof Clinic ? $clinic->getKey() : $clinic;

        return $this->clinicMemberships()
            ->active()
            ->where('clinic_id', $clinicId)
            ->first();
    }

    public function hasClinicPermission(Clinic|int $clinic, string $permission): bool
    {
        return $this->isActive()
            && (bool) $this->activeMembershipFor($clinic)?->grants($permission);
    }

    // Check role methods
    public function isPatient()
    {
        return $this->role === 'patient';
    }

    public function isDentist()
    {
        return $this->role === 'dentist';
    }

    public function isStaff()
    {
        return $this->role === 'staff';
    }

    public function isClinicAdmin()
    {
        return $this->role === 'clinic_admin';
    }

    public function isSystemAdmin()
    {
        return $this->role === 'system_admin';
    }
}
