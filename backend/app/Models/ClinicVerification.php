<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ClinicVerification extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'clinic_name',
        'business_permit',
        'doh_license',
        'prc_id',
        'bir_registration',
        'status',
        'submitted_at',
        'verified_at',
        'rejection_reason',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'verified_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function clinic()
    {
        return $this->hasOne(Clinic::class);
    }

    public function isPending()
    {
        return $this->status === 'pending';
    }

    public function isVerified()
    {
        return $this->status === 'verified';
    }

    public function isRejected()
    {
        return $this->status === 'rejected';
    }
}