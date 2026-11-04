<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A platform-wide message: draft → published → archived. Publishing notifies the audience. */
class SystemAnnouncement extends Model
{
    public const DRAFT = 'draft';
    public const PUBLISHED = 'published';
    public const ARCHIVED = 'archived';

    /** Audience => the account types it reaches (none = everyone). */
    public const AUDIENCES = [
        'all' => [],
        'patients' => ['patient'],
        'dentists' => ['dentist'],
        'staff' => ['staff'],
        'clinic_admins' => ['clinic_admin'],
    ];

    protected $fillable = ['title', 'content', 'audience'];

    protected $casts = ['published_at' => 'datetime', 'archived_at' => 'datetime'];

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /** Active accounts this announcement goes to. */
    public function recipients(): Builder
    {
        $roles = self::AUDIENCES[$this->audience] ?? [];

        return User::query()
            ->where('status', User::STATUS_ACTIVE)
            ->when($roles !== [], fn ($q) => $q->whereIn('role', $roles));
    }
}
