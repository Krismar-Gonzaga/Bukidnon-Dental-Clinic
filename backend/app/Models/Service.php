<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Service extends Model
{
    protected $fillable = [
        'name', 'slug', 'description', 'icon_name', 'color', 'is_popular', 'sort_order'
    ];

    protected $casts = [
        'is_popular' => 'boolean'
    ];

    public function serviceRates(): HasMany
    {
        return $this->hasMany(ServiceRate::class);
    }

    // Scope for popular services
    public function scopePopular($query)
    {
        return $query->where('is_popular', true)->orderBy('sort_order');
    }
}