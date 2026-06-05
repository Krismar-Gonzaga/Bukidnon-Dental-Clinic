<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Clinic extends Model
{
    protected $fillable = [
        'name', 'slug', 'description', 'address', 'city', 'province',
        'contact_number', 'email', 'image', 'rating', 'is_featured',
        'is_verified', 'opening_time', 'closing_time', 'services_offered', 'dentists'
    ];

    protected $casts = [
        'services_offered' => 'array',
        'dentists' => 'array',
        'is_featured' => 'boolean',
        'is_verified' => 'boolean',
        'rating' => 'decimal:1'
    ];

    public function serviceRates(): HasMany
    {
        return $this->hasMany(ServiceRate::class);
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class);
    }

    // Scope for featured clinics
    public function scopeFeatured($query)
    {
        return $query->where('is_featured', true);
    }

    // Scope for verified clinics
    public function scopeVerified($query)
    {
        return $query->where('is_verified', true);
    }
}