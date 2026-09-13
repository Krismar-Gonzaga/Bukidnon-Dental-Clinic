<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Service extends Model
{
    use HasFactory;

    protected $fillable = [
        'clinic_id',
        'name',
        'description',
        'price_min',
        'price_max',
        'duration_minutes',
        'is_active'
    ];

    protected $casts = [
        'price_min' => 'decimal:2',
        'price_max' => 'decimal:2',
        'duration_minutes' => 'integer',
        'is_active' => 'boolean'
    ];

    public function clinic()
    {
        return $this->belongsTo(Clinic::class);
    }

    public function getPriceRangeAttribute()
    {
        if ($this->price_min === $this->price_max) {
            return "₱" . number_format($this->price_min, 2);
        }
        return "₱" . number_format($this->price_min, 2) . " - ₱" . number_format($this->price_max, 2);
    }
}