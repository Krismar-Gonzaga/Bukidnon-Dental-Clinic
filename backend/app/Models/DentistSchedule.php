<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DentistSchedule extends Model
{
    protected $fillable = ['branch_id', 'day_of_week', 'starts_at', 'ends_at'];

    protected $casts = ['day_of_week' => 'integer'];

    public function dentist(): BelongsTo
    {
        return $this->belongsTo(Dentist::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(ClinicBranch::class, 'branch_id');
    }
}
