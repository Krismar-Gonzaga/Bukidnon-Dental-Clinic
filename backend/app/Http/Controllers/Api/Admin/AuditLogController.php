<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\User;
use App\Support\BusinessTime;
use Illuminate\Http\Request;

/** Read-only audit trail viewer. */
class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate([
            'action' => ['nullable', 'string', 'max:100'],
            'user_id' => ['nullable', 'integer'],
            'clinic_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $page = AuditLog::query()
            ->when($data['action'] ?? null, fn ($q, $action) => $q->where('action', 'like', $action.'%'))
            ->when($data['user_id'] ?? null, fn ($q, $id) => $q->where('user_id', $id))
            ->when($data['clinic_id'] ?? null, fn ($q, $id) => $q->where('clinic_id', $id))
            ->when($data['from'] ?? null, fn ($q, $from) => $q->where('created_at', '>=', BusinessTime::utc(BusinessTime::parse($from))))
            ->when($data['to'] ?? null, fn ($q, $to) => $q->where('created_at', '<=', BusinessTime::utc(BusinessTime::parse($to)->endOfDay())))
            ->orderByDesc('id')
            ->paginate($this->perPage($request, 50));

        $names = User::whereIn('id', collect($page->items())->pluck('user_id')->filter()->unique())->pluck('name', 'id');

        return $this->paginated($page, fn (AuditLog $log) => [
            'id' => $log->id,
            'action' => $log->action,
            'user_id' => $log->user_id,
            'user_name' => $names[$log->user_id] ?? null,
            'clinic_id' => $log->clinic_id,
            'subject_type' => $log->subject_type,
            'subject_id' => $log->subject_id,
            'metadata' => $log->metadata,
            'ip_address' => $log->ip_address,
            'created_at' => BusinessTime::iso($log->created_at),
        ]);
    }
}
