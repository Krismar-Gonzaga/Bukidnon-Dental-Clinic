<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

// Records security and administrative events. Never put passwords, tokens,
// or clinical note content in $metadata.
class AuditLogger
{
    public function __construct(private readonly Request $request)
    {
    }

    public function record(
        string $action,
        ?Model $subject = null,
        array $metadata = [],
        ?int $clinicId = null,
        ?User $actor = null,
    ): AuditLog {
        $actor ??= $this->request->user();

        return AuditLog::create([
            'user_id' => $actor?->getKey(),
            'clinic_id' => $clinicId,
            'action' => $action,
            'subject_type' => $subject ? class_basename($subject) : null,
            'subject_id' => $subject?->getKey(),
            'metadata' => $metadata ?: null,
            'ip_address' => $this->request->ip(),
            'user_agent' => Str::limit((string) $this->request->userAgent(), 250, ''),
        ]);
    }
}
