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
        return config("permissions.clinic_roles.{$this->role}", []);
    }

    public function grants(string $permission): bool
    {
        return in_array($permission, $this->permissions(), true);
    }
}
