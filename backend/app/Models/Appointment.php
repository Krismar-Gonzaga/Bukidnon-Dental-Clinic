<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * Appointment lifecycle (enforced by App\Services\AppointmentService):
 *
 *   pending ──► confirmed ──► checked_in ──► in_progress ──► completed
 *     │            │  ▲            │
 *     │            │  └── reschedule_requested ──► cancelled
 *     ├─► rejected ├─► cancelled   └─► no_show
 *     └─► cancelled└─► no_show
 *
 * Only "active" statuses hold the dentist's time slot.
 */
class Appointment extends Model
{
    use HasFactory;

    public const PENDING = 'pending';
    public const CONFIRMED = 'confirmed';
    public const RESCHEDULE_REQUESTED = 'reschedule_requested';
    public const CHECKED_IN = 'checked_in';
    public const IN_PROGRESS = 'in_progress';
    public const COMPLETED = 'completed';
    public const REJECTED = 'rejected';
    public const CANCELLED = 'cancelled';
    public const NO_SHOW = 'no_show';

    public const ACTIVE_STATUSES = [
        self::PENDING,
        self::CONFIRMED,
        self::RESCHEDULE_REQUESTED,
        self::CHECKED_IN,
        self::IN_PROGRESS,
    ];

    public const TRANSITIONS = [
        self::PENDING => [self::CONFIRMED, self::REJECTED, self::CANCELLED],
        self::CONFIRMED => [self::CHECKED_IN, self::CANCELLED, self::NO_SHOW, self::RESCHEDULE_REQUESTED],
        self::RESCHEDULE_REQUESTED => [self::CONFIRMED, self::CANCELLED],
        self::CHECKED_IN => [self::IN_PROGRESS, self::NO_SHOW],
        self::IN_PROGRESS => [self::COMPLETED],
        self::COMPLETED => [],
        self::REJECTED => [],
        self::CANCELLED => [],
        self::NO_SHOW => [],
    ];

    // Scheduling, status and ownership fields are set by AppointmentService.
    protected $fillable = ['reason', 'notes'];

    protected $casts = [
        'appointment_date' => 'date:Y-m-d',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'requested_starts_at' => 'datetime',
        'requested_ends_at' => 'datetime',
        'status_changed_at' => 'datetime',
        'reminder_sent_at' => 'datetime',
    ];

    public function canTransitionTo(string $status): bool
    {
        return in_array($status, self::TRANSITIONS[$this->status] ?? [], true);
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::ACTIVE_STATUSES, true);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->whereIn('status', self::ACTIVE_STATUSES);
    }

    /** Appointments overlapping [start, end). */
    public function scopeOverlapping(Builder $query, $start, $end): Builder
    {
        return $query->where('starts_at', '<', $end)->where('ends_at', '>', $start);
    }

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(ClinicBranch::class, 'branch_id');
    }

    public function dentist(): BelongsTo
    {
        return $this->belongsTo(Dentist::class);
    }

    public function patient(): BelongsTo
    {
        return $this->belongsTo(Patient::class);
    }

    public function serviceRate(): BelongsTo
    {
        return $this->belongsTo(ServiceRate::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(Service::class);
    }

    public function statusHistory(): HasMany
    {
        return $this->hasMany(AppointmentStatusHistory::class)->orderBy('created_at')->orderBy('id');
    }

    public function review(): HasOne
    {
        return $this->hasOne(Review::class);
    }
}
