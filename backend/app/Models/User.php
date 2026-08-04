<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
        'role',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
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