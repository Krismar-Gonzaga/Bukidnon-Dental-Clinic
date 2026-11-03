<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Clinic;
use App\Models\ClinicApplication;
use App\Models\ReviewReport;
use App\Models\User;
use App\Support\AuditPresenter;
use App\Support\BusinessTime;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/** Platform summary. Aggregates only — no patient-level data. */
class DashboardController extends Controller
{
    private const ACTIVITY_DAYS = 14;

    /** Platform events shown in the activity feed (no sign-ins or clinic-internal actions). */
    private const FEED_ACTIONS = [
        'clinic_application.submitted',
        'clinic_application.document_uploaded',
        'clinic_application.review_started',
        'clinic_application.approved',
        'clinic_application.rejected',
        'clinic.suspended',
        'clinic.reactivated',
        'admin.user_updated',
        'review.moderated',
    ];

    /**
     * Counts are grouped into few queries on purpose: against a remote
     * database each round trip costs up to a few seconds.
     */
    public function __invoke()
    {
        $today = BusinessTime::today();
        $clinics = Clinic::query()->selectRaw(
            'COUNT(*) as total,
             SUM(CASE WHEN status = ? AND is_published = ? AND is_verified = ? THEN 1 ELSE 0 END) as listed,
             SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as suspended,
             SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as new_this_month',
            [Clinic::STATUS_APPROVED, true, true, Clinic::STATUS_SUSPENDED, BusinessTime::utc($today->startOfMonth())],
        )->first();
        $applications = ClinicApplication::selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status');

        return $this->ok([
            'clinics' => [
                'total' => (int) $clinics->total,
                'listed' => (int) $clinics->listed,
                'suspended' => (int) $clinics->suspended,
                'new_this_month' => (int) $clinics->new_this_month,
            ],
            'applications' => collect([ClinicApplication::PENDING, ClinicApplication::UNDER_REVIEW, ClinicApplication::APPROVED, ClinicApplication::REJECTED])
                ->mapWithKeys(fn (string $status) => [$status => (int) ($applications[$status] ?? 0)]),
            'queue' => ClinicApplication::whereIn('status', [ClinicApplication::PENDING, ClinicApplication::UNDER_REVIEW])
                ->orderByRaw("CASE status WHEN 'pending' THEN 0 ELSE 1 END")
                ->orderBy('submitted_at')
                ->limit(5)
                ->get()
                ->map(fn (ClinicApplication $a) => [
                    'id' => $a->id,
                    'clinic_name' => $a->clinic_name,
                    'city' => $a->city,
                    'province' => $a->province,
                    'status' => $a->status,
                    'submitted_at' => BusinessTime::iso($a->submitted_at),
                ]),
            'users' => User::selectRaw('role, COUNT(*) as total')->groupBy('role')->pluck('total', 'role'),
            'open_review_reports' => ReviewReport::where('status', ReviewReport::STATUS_OPEN)->count(),
            'security' => $this->security(),
            'activity_by_day' => $this->activityByDay($today),
            'recent_activity' => $this->recentActivity(),
        ]);
    }

    private function security(): array
    {
        $since = now()->subDay();
        $counts = AuditLog::where('created_at', '>=', $since)
            ->whereIn('action', ['auth.login_failed', 'auth.login_blocked', 'admin.password_confirm_failed'])
            ->selectRaw('action, COUNT(*) as total')
            ->groupBy('action')
            ->pluck('total', 'action');

        return [
            'failed_logins_24h' => (int) ($counts['auth.login_failed'] ?? 0),
            'blocked_logins_24h' => (int) ($counts['auth.login_blocked'] ?? 0),
            'failed_password_confirmations_24h' => (int) ($counts['admin.password_confirm_failed'] ?? 0),
            'suspended_users' => User::where('status', User::STATUS_SUSPENDED)->count(),
        ];
    }

    /** Audited events per Philippine calendar day, oldest first (one grouped query). */
    private function activityByDay(CarbonImmutable $today): array
    {
        $first = $today->subDays(self::ACTIVITY_DAYS - 1);
        $day = BusinessTime::daySql('created_at');
        $totals = AuditLog::where('created_at', '>=', BusinessTime::utc($first))
            ->selectRaw("{$day} as day, COUNT(*) as total")
            ->groupByRaw($day)
            ->pluck('total', 'day');

        return collect(range(0, self::ACTIVITY_DAYS - 1))->map(function (int $offset) use ($first, $totals) {
            $date = $first->addDays($offset)->toDateString();

            return ['date' => $date, 'total' => (int) ($totals[$date] ?? 0)];
        })->all();
    }

    private function recentActivity(): Collection
    {
        $logs = AuditLog::whereIn('action', self::FEED_ACTIONS)->orderByDesc('id')->limit(10)->get();
        if ($logs->isEmpty()) {
            return collect();
        }

        ['users' => $users, 'labels' => $labels] = AuditPresenter::lookups($logs);

        return $logs->map(fn (AuditLog $log) => [
            'id' => $log->id,
            'action' => $log->action,
            'actor' => $users->get($log->user_id)?->name,
            'subject_type' => $log->subject_type,
            'subject_id' => $log->subject_id,
            'subject_label' => $labels[$log->subject_type][$log->subject_id] ?? null,
            'created_at' => BusinessTime::iso($log->created_at),
        ]);
    }
}
