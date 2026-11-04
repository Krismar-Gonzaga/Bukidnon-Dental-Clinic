<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClinicMembership extends Model
{
    use HasFactory;

    public const ROLE_CLINIC_ADMIN = 'clinic_admin';
    public const ROLE_DENTIST = 'dentist';
    public const ROLE_STAFF = 'staff';
    public const ROLE_INVENTORY_STAFF = 'inventory_staff';

    public const STATUS_INVITED = 'invited';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_SUSPENDED = 'suspended';

    // clinic_id, user_id and role are set explicitly by authorized code,
    // never mass-assigned from request input.
    protected $fillable = ['status'];

    protected $casts = ['custom_permissions' => 'array', 'work_schedule' => 'array'];

    // A member's details never include their permission overrides by accident.
    protected $hidden = ['custom_permissions'];

    public static function roles(): array
    {
        return array_keys(config('permissions.clinic_roles'));
    }

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }

    /** @return list<string> */
    public function permissions(): array
    {
        if ($this->role === self::ROLE_STAFF) {
            if (is_array($this->custom_permissions)) {
                // Re-checked against the allowed list, so a stored value can never widen access.
                return ['clinic.view', ...array_values(array_intersect($this->custom_permissions, config('permissions.staff_assignable')))];
            }
            if ($this->position && $this->clinic) {
                $modules = $this->clinic->positionModules($this->position);

                return ['clinic.view', ...collect($modules)->flatMap(fn (string $module) => config("permissions.staff_modules.{$module}", []))->unique()->values()->all()];
            }
        }

        return config("permissions.clinic_roles.{$this->role}", []);
    }

    /** What the member is called at the clinic: their position, or their role. */
    public function positionLabel(): string
    {
        if ($this->role !== self::ROLE_STAFF) {
            return str_replace('_', ' ', ucwords($this->role, '_'));
        }
        if (! $this->position || $this->position === 'receptionist') {
            return 'Front Desk Staff';
        }

        return config("permissions.staff_positions.{$this->position}.label", 'Front Desk Staff');
    }

    public function grants(string $permission): bool
    {
        return in_array($permission, $this->permissions(), true);
    }
}
