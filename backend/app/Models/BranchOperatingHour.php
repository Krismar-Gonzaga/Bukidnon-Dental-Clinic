<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BranchOperatingHour extends Model
{
    protected $fillable = ['day_of_week', 'opens_at', 'closes_at'];

    protected $casts = ['day_of_week' => 'integer'];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(ClinicBranch::class, 'branch_id');
    }
}
