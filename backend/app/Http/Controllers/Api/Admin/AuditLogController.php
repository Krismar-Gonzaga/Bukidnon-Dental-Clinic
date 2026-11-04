<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Clinic;
use App\Models\User;
use App\Services\AuditChain;
use App\Services\AuditLogger;
use App\Support\AuditPresenter;
use App\Support\BusinessTime;
use App\Support\CsvExport;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Read-only audit trail viewer, summary, CSV export and integrity check. */
class AuditLogController extends Controller
{
    /** Preset windows, in hours, ending now. */
    private const RANGES = ['24h' => 24, '7d' => 168, '30d' => 720];

    /** Account types in the role filter; "none" = not signed in. */
    private const ROLES = ['patient', 'clinic_admin', 'dentist', 'staff', 'system_admin', 'none'];

    public function __construct(
        private readonly AuditLogger $audit,
        private readonly AuditChain $chain,
    ) {
    }

    public function index(Request $request)
    {
        $filters = $this->filters($request);
        [$start, $end] = $this->window($filters);

        $page = $this->query($filters)
            ->when($start, fn ($q) => $q->whereBetween('created_at', [$start, $end]))
            ->orderByDesc('id')
            ->paginate($this->perPage($request, 25));
        $lookups = AuditPresenter::lookups(collect($page->items()));

        return $this->paginated($page, fn (AuditLog $log) => AuditPresenter::present($log, $lookups));
    }

    /**
     * The four cards above the log, for the same filters. One query for the
     * counts (this window and the one before it, for the trend) and one for
     * the entries still waiting to be sealed.
     */
    public function summary(Request $request)
    {
        $filters = $this->filters($request);
        [$start, $end] = $this->window($filters);
        $previousStart = $start?->sub($start->diff($end));
        $critical = AuditPresenter::CRITICAL_ACTIONS;
        $inWindow = $start ? 'created_at >= ?' : '1 = 1';
        $windowBinding = $start ? [$start] : [];

        $counts = $this->query($filters)->toBase()
            ->when($start, fn ($q) => $q->whereBetween('created_at', [$previousStart, $end]))
            ->selectRaw("SUM(CASE WHEN {$inWindow} THEN 1 ELSE 0 END) AS total", $windowBinding)
            ->selectRaw($start ? 'SUM(CASE WHEN created_at < ? THEN 1 ELSE 0 END) AS previous' : 'NULL AS previous', $windowBinding)
            ->selectRaw("SUM(CASE WHEN {$inWindow} AND action = ? THEN 1 ELSE 0 END) AS failed_logins", [...$windowBinding, 'auth.login_failed'])
            ->selectRaw("SUM(CASE WHEN {$inWindow} AND action = ? THEN 1 ELSE 0 END) AS blocked_logins", [...$windowBinding, 'auth.login_blocked'])
            ->selectRaw("COUNT(DISTINCT CASE WHEN {$inWindow} AND action IN (?, ?) THEN ip_address END) AS failed_ips", [...$windowBinding, 'auth.login_failed', 'auth.login_blocked'])
            ->selectRaw("SUM(CASE WHEN {$inWindow} AND action IN (".implode(', ', array_fill(0, count($critical), '?')).') THEN 1 ELSE 0 END) AS critical', [...$windowBinding, ...$critical])
            ->first();

        return $this->ok([
            'window' => ['from' => BusinessTime::iso($start), 'to' => BusinessTime::iso($end)],
            'total_events' => (int) ($counts->total ?? 0),
            'previous_total' => $counts->previous === null ? null : (int) $counts->previous,
            'failed_logins' => (int) ($counts->failed_logins ?? 0),
            'blocked_logins' => (int) ($counts->blocked_logins ?? 0),
            'failed_login_ips' => (int) ($counts->failed_ips ?? 0),
            'critical_actions' => (int) ($counts->critical ?? 0),
            'integrity' => [
                'last_report' => $this->chain->lastReport(),
                'unsealed' => AuditLog::whereNull('hash')->count(),
            ],
        ]);
    }

    /** CSV of the filtered entries (newest first, up to CsvExport::MAX_ROWS). Password re-confirmed; recorded. */
    public function export(Request $request)
    {
        $filters = $this->filters($request);
        $limit = CsvExport::limit($request);
        [$start, $end] = $this->window($filters);
        $query = $this->query($filters)
            ->when($start, fn ($q) => $q->whereBetween('created_at', [$start, $end]))
            ->orderByDesc('id')
            ->limit($limit);

        $this->audit->record('audit.exported', metadata: array_filter([...$filters, 'rows' => min($query->count(), $limit)]));

        $rows = function () use ($query) {
            foreach ($query->get()->chunk(500) as $chunk) {
                $lookups = AuditPresenter::lookups($chunk);
                foreach ($chunk as $log) {
                    $row = AuditPresenter::present($log, $lookups);
                    yield [
                        $row['id'], $row['created_at'], $row['user_name'] ?? ($row['user_id'] ? "User #{$row['user_id']}" : 'Not signed in'),
                        $row['user_role'], $row['label'], $row['action'], $row['category'], $row['outcome'], $row['subject_label'],
                        $row['detail'], $row['clinic_id'], $row['ip_address'], $row['user_agent'], $row['sealed'],
                    ];
                }
            }
        };

        return CsvExport::download(
            'audit-log-'.BusinessTime::now()->format('Y-m-d-His').'.csv',
            ['ID', 'Time (Philippines)', 'User', 'Role', 'Action', 'Action code', 'Category', 'Outcome', 'Subject', 'Details', 'Clinic ID', 'IP address', 'User agent', 'Sealed'],
            $rows(),
        );
    }

    /** Seals pending entries and re-checks the whole chain. */
    public function integrity()
    {
        $report = $this->chain->verify();
        $this->audit->record('audit.integrity_checked', metadata: ['status' => $report['status'], 'rows' => $report['checked']]);

        return $this->ok($report, $report['status'] === 'verified' ? 'Audit log verified' : 'Integrity problems found');
    }

    private function filters(Request $request): array
    {
        return $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'action' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', Rule::in(array_keys(AuditPresenter::CATEGORIES))],
            'role' => ['nullable', Rule::in(self::ROLES)],
            'user_id' => ['nullable', 'integer'],
            'clinic_id' => ['nullable', 'integer'],
            'range' => ['nullable', Rule::in(array_keys(self::RANGES))],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
    }

    /** Everything except the date window. */
    private function query(array $filters): Builder
    {
        return AuditLog::query()
            ->when($filters['search'] ?? null, function ($q, $search) {
                $term = '%'.mb_strtolower($search).'%';
                $q->where(fn ($w) => $w
                    ->whereRaw('LOWER(action) LIKE ?', [$term])
                    ->orWhereIn('action', AuditPresenter::actionsMatching($search))
                    ->orWhereIn('user_id', User::whereRaw('LOWER(name) LIKE ?', [$term])->select('id'))
                    ->orWhereIn('clinic_id', Clinic::whereRaw('LOWER(name) LIKE ?', [$term])->select('id')));
            })
            ->when($filters['action'] ?? null, fn ($q, $action) => $q->where('action', 'like', $action.'%'))
            ->when($filters['category'] ?? null, fn ($q, $category) => AuditPresenter::whereCategory($q, $category))
            ->when($filters['role'] ?? null, fn ($q, $role) => $role === 'none'
                ? $q->whereNull('user_id')
                : $q->whereIn('user_id', User::where('role', $role)->select('id')))
            ->when($filters['user_id'] ?? null, fn ($q, $id) => $q->where('user_id', $id))
            ->when($filters['clinic_id'] ?? null, fn ($q, $id) => $q->where('clinic_id', $id));
    }

    /** [start, end] in UTC, or [null, null] for all time. A preset range wins over dates. */
    private function window(array $filters): array
    {
        if ($range = $filters['range'] ?? null) {
            $end = CarbonImmutable::now('UTC');

            return [$end->subHours(self::RANGES[$range]), $end];
        }
        $from = $filters['from'] ?? null;
        $to = $filters['to'] ?? null;
        if (! $from && ! $to) {
            return [null, null];
        }
        // An open start counts from the first entry's day; an open end is now.
        $start = $from ? BusinessTime::utc(BusinessTime::parse($from)) : CarbonImmutable::parse(AuditLog::min('created_at') ?? 'now', 'UTC');
        $end = $to ? BusinessTime::utc(BusinessTime::parse($to)->endOfDay()) : CarbonImmutable::now('UTC');

        return [$start, $end];
    }
}
