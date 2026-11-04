<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Proof of a manual transfer, waiting for a system administrator to verify it. */
class SubscriptionPayment extends Model
{
    public const DISK = 'local';

    public const PENDING = 'pending';
    public const VERIFIED = 'verified';
    public const REJECTED = 'rejected';

    protected $fillable = ['plan', 'amount', 'method', 'reference', 'proof_path', 'proof_mime_type'];

    protected $casts = ['amount' => 'float', 'reviewed_at' => 'datetime'];

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }
}
