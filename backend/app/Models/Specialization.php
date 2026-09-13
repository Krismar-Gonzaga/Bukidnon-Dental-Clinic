<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Specialization extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'icon',
        'is_active'
    ];

    public function clinics()
    {
        return $this->belongsToMany(Clinic::class, 'clinic_specializations');
    }

    public function dentists()
    {
        return $this->hasMany(Dentist::class);
    }
}