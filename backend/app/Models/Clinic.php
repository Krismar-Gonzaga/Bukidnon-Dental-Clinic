<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Clinic extends Model
{
    use HasFactory;

    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_SUSPENDED = 'suspended';

    // status, is_verified, is_published, owner_id and suspension fields are
    // changed only by the verification and administration workflows.
    protected $fillable = [
        'name',
        'slug',
        'description',
        'address',
        'city',
        'province',
        'contact_number',
        'email',
        'image',
        'opening_time',
        'closing_time',
        'latitude',
        'longitude',
    ];

    protected $casts = [
        'rating' => 'decimal:1',
        'is_featured' => 'boolean',
        'is_verified' => 'boolean',
        'is_published' => 'boolean',
        'services_offered' => 'array',
        'latitude' => 'float',
        'longitude' => 'float',
        'suspended_at' => 'datetime',
        'settings' => 'array',
    ];

    public const SLOT_OPTIONS = [15, 20, 30, 45, 60];

    /** Behaviour until the clinic changes it: the same as before settings existed. */
    private const SETTINGS_DEFAULTS = [
        'allow_online_booking' => true,
        'require_approval' => true,
        'send_reminders' => true,
        'allow_patient_cancel' => true,
    ];

    public function settingsValues(): array
    {
        return [
            'slot_minutes' => (int) config('booking.slot_minutes'),
            ...self::SETTINGS_DEFAULTS,
            ...array_diff_key($this->settings ?? [], ['position_modules' => true]),
        ];
    }

    /** Modules a staff position may open at this clinic. */
    public function positionModules(string $position): array
    {
        return $this->settings['position_modules'][$position]
            ?? config("permissions.staff_positions.{$position}.modules", []);
    }

    /** Clinics shown in the public directory. */
    public function scopePubliclyListed(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_APPROVED)
            ->where('is_published', true)
            ->where('is_verified', true);
    }

    public function isPubliclyListed(): bool
    {
        return $this->status === self::STATUS_APPROVED && $this->is_published && $this->is_verified;
    }

    // Relationships
    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function subscription(): HasOne
    {
        return $this->hasOne(Subscription::class);
    }

    public function latestPayment(): HasOne
    {
        return $this->hasOne(SubscriptionPayment::class)->latestOfMany();
    }

    public function application(): HasOne
    {
        return $this->hasOne(ClinicApplication::class)->latestOfMany();
    }

    public function branches(): HasMany
    {
        return $this->hasMany(ClinicBranch::class);
    }

    public function holidays(): HasMany
    {
        return $this->hasMany(ClinicHoliday::class);
    }

    public function scheduleBlocks(): HasMany
    {
        return $this->hasMany(ScheduleBlock::class);
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(ClinicMembership::class);
    }

    /** Dentist profiles with an active dentist membership in this clinic. */
    public function dentistProfiles(): Builder
    {
        return Dentist::query()->workingAt($this->id);
    }

    public function serviceRates(): HasMany
    {
        return $this->hasMany(ServiceRate::class);
    }

    public function specializations(): BelongsToMany
    {
        return $this->belongsToMany(Specialization::class, 'clinic_specializations');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }

    public function appointments(): HasMany
    {
        return $this->hasMany(Appointment::class);
    }

    public function patients(): BelongsToMany
    {
        return $this->belongsToMany(Patient::class, 'clinic_patients')->withTimestamps();
    }

    public function patientRecords(): HasMany
    {
        return $this->hasMany(PatientRecord::class);
    }

    public function inventoryItems(): HasMany
    {
        return $this->hasMany(InventoryItem::class);
    }

    public function inventoryCategories(): HasMany
    {
        return $this->hasMany(InventoryCategory::class);
    }

    public function suppliers(): HasMany
    {
        return $this->hasMany(Supplier::class);
    }

    // Accessors
    public function getFullAddressAttribute()
    {
        return "{$this->address}, {$this->city}, {$this->province}";
    }

    public function getRatingStarsAttribute()
    {
        return number_format((float) ($this->rating ?? 0), 1);
    }

    /** Recalculate the public rating from published reviews. */
    public function refreshRating(): void
    {
        $average = $this->reviews()->where('status', Review::STATUS_APPROVED)->avg('rating');
        $this->forceFill(['rating' => round((float) ($average ?? 0), 1)])->save();
    }
}
