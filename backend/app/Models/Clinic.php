<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Clinic extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'address',
        'city',
        'province',
        'contact_number',
        'email',
        'description',
        'logo',
        'rating',
        'review_count',
        'verified_at',
        'latitude',
        'longitude',
        'is_active'
    ];

    protected $casts = [
        'rating' => 'decimal:2',
        'verified_at' => 'datetime',
        'is_active' => 'boolean'
    ];

    // Relationships
    public function branches()
    {
        return $this->hasMany(ClinicBranch::class);
    }

    public function dentists()
    {
        return $this->hasMany(Dentist::class);
    }

    public function services()
    {
        return $this->hasMany(Service::class);
    }

    public function specializations()
    {
        return $this->belongsToMany(Specialization::class, 'clinic_specializations');
    }

    public function reviews()
    {
        return $this->hasMany(Review::class);
    }

    public function appointments()
    {
        return $this->hasMany(Appointment::class);
    }

    // Accessors
    public function getFullAddressAttribute()
    {
        return "{$this->address}, {$this->city}, {$this->province}";
    }

    public function getRatingStarsAttribute()
    {
        return number_format($this->rating ?? 0, 1);
    }

    public function getIsVerifiedAttribute()
    {
        return !is_null($this->verified_at);
    }
}