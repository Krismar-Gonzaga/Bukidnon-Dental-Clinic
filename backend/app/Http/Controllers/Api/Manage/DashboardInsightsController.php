<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\AuditLog;
use App\Models\Clinic;
use App\Models\ClinicBranch;
use App\Models\ClinicMembership;
use App\Models\InventoryItem;
use App\Models\Patient;
use App\Models\ServiceRate;
use App\Models\User;
use App\Support\AuditPresenter;
use App\Support\BusinessTime;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Figures of the clinic admin dashboard: today's work, patients and team,
 * appointments over the last 7 days, estimated revenue this year and recent
 * activity. Grouped into few queries: a remote database makes each one slow.
 * Revenue is an ESTIMATE (the listed price of completed visits; no billing).
 */
class DashboardInsightsController extends Controller
{
    private const CHART_DAYS = 7;

    private const ACTIVITY_LIMIT = 8;

    /** Which chart series each appointment status counts toward; the rest are not charted. */
    private const SERIES = [
        Appointment::CONFIRMED => 'confirmed',
        Appointment::CHECKED_IN => 'confirmed',
        Appointment::IN_PROGRESS => 'confirmed',
        Appointment::COMPLETED => 'confirmed',
        Appointment::PENDING => 'pending',
        Appointment::RESCHEDULE_REQUESTED => 'pending',
        Appointment::CANCELLED => 'cancelled',
        Appointment::REJECTED => 'cancelled',
        Appointment::NO_SHOW => 'cancelled',
    ];

    /** Clinic actions never shown in the feed: reads, and anything about clinical records. */
    private const ACTIVITY_HIDDEN = ['patient.viewed', 'records.%', 'clinic_application.%'];

    private const STATUS_TITLES = [
        Appointment::CONFIRMED => 'Appointment confirmed',
        Appointment::REJECTED => 'Appointment request declined',
        Appointment::CANCELLED => 'Appointment cancelled',
        Appointment::CHECKED_IN => 'Patient checked in',
        Appointment::IN_PROGRESS => 'Appointment started',
        Appointment::COMPLETED => 'Appointment completed',
        Appointment::NO_SHOW => 'Marked as no-show',
        Appointment::RESCHEDULE_REQUESTED => 'Reschedule requested',
    ];

    public function __invoke(Clinic $clinic)
    {
        $today = BusinessTime::today();
        $days = $this->appointmentsByDay($clinic, $today);
        $booked = fn (array $day) => $day['confirmed'] + $day['pending'];
        $todayRow = $days[self::CHART_DAYS - 1];
        $yesterday = $days[self::CHART_DAYS - 2];

        $patients = DB::table('clinic_patients')->where('clinic_id', $clinic->id)
            ->selectRaw('COUNT(*) AS total, SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS new_this_month', [BusinessTime::utc($today->startOfMonth())])
            ->first();
        $team = $clinic->memberships()->toBase()->selectRaw('role, status, COUNT(*) AS total')->groupBy('role', 'status')->get();

        return $this->ok([
            'today' => [
                'date' => $today->toDateString(),
                'appointments' => $booked($todayRow),
                'yesterday' => $booked($yesterday),
                // Requests still to decide; older ones have already passed.
                'pending_requests' => $clinic->appointments()->where('status', Appointment::PENDING)->where('starts_at', '>=', BusinessTime::utc($today))->count(),
            ],
            'patients' => ['total' => (int) ($patients->total ?? 0), 'new_this_month' => (int) ($patients->new_this_month ?? 0)],
            'dentists' => $this->teamCounts($team, [ClinicMembership::ROLE_DENTIST]),
            'staff' => $this->teamCounts($team, [ClinicMembership::ROLE_STAFF, ClinicMembership::ROLE_INVENTORY_STAFF]),
            'appointments_by_day' => $days,
            'revenue' => $this->revenue($clinic, $today),
            'activity' => $this->activity($clinic),
        ]);
    }

    /** Oldest first, today last. Counts every status, so cancelled visits are visible too. */
    private function appointmentsByDay(Clinic $clinic, CarbonImmutable $today): array
    {
        $first = $today->subDays(self::CHART_DAYS - 1);
        $day = BusinessTime::daySql('starts_at');
        $rows = $clinic->appointments()->toBase()
            ->whereBetween('starts_at', [BusinessTime::utc($first), BusinessTime::utc($today->endOfDay())])
            ->selectRaw("{$day} AS day, status, COUNT(*) AS total")
            ->groupByRaw("{$day}, status")
            ->get();

        return collect(range(0, self::CHART_DAYS - 1))->map(function (int $offset) use ($first, $rows) {
            $date = $first->addDays($offset)->toDateString();
            $counts = ['date' => $date, 'confirmed' => 0, 'pending' => 0, 'cancelled' => 0];
            foreach ($rows->where('day', $date) as $row) {
                if (isset(self::SERIES[$row->status])) {
                    $counts[self::SERIES[$row->status]] += (int) $row->total;
                }
            }

            return $counts;
        })->all();
    }

    /** Year to date by month, plus this and last month (December counts for January's comparison). */
    private function revenue(Clinic $clinic, CarbonImmutable $today): array
    {
        $thisMonth = $today->startOfMonth();
        $lastMonth = $thisMonth->subMonth();
        $yearStart = $today->startOfYear();
        $month = BusinessTime::monthSql('appointments.starts_at');

        $totals = $clinic->appointments()->toBase()
            ->join('service_rates', 'service_rates.id', '=', 'appointments.service_rate_id')
            ->where('appointments.status', Appointment::COMPLETED)
            ->whereBetween('appointments.starts_at', [BusinessTime::utc($lastMonth->min($yearStart)), BusinessTime::utc($today->endOfMonth())])
            ->selectRaw("{$month} AS month, SUM(service_rates.price) AS total")
            ->groupByRaw($month)
            ->pluck('total', 'month');
        $amount = fn (CarbonImmutable $m) => round((float) ($totals[$m->format('Y-m')] ?? 0), 2);

        return [
            'year' => $today->year,
            'currency' => 'PHP',
            'this_month' => $amount($thisMonth),
            'last_month' => $amount($lastMonth),
            'by_month' => collect(range(1, $today->month))->map(function (int $number) use ($yearStart, $amount) {
                $m = $yearStart->month($number);

                return ['month' => $m->format('Y-m'), 'total' => $amount($m)];
            })->all(),
        ];
    }

    private function teamCounts(Collection $team, array $roles): array
    {
        $rows = $team->whereIn('role', $roles);
        $active = (int) $rows->where('status', ClinicMembership::STATUS_ACTIVE)->sum('total');
        $total = (int) $rows->sum('total');

        return ['total' => $total, 'active' => $active, 'inactive' => $total - $active];
    }

    /** Latest clinic events as readable lines. Reads and clinical record events stay out. */
    private function activity(Clinic $clinic): array
    {
        $logs = AuditLog::where('clinic_id', $clinic->id)
            ->where(function ($q) {
                foreach (self::ACTIVITY_HIDDEN as $pattern) {
                    $q->where('action', 'not like', $pattern);
                }
            })
            ->orderByDesc('id')
            ->limit(self::ACTIVITY_LIMIT)
            ->get(['id', 'user_id', 'action', 'subject_type', 'subject_id', 'metadata', 'created_at']);

        $ids = fn (string $type) => $logs->where('subject_type', $type)->pluck('subject_id')->unique()->values();
        $actorIds = $logs->pluck('user_id')->filter()->unique()->values();
        $actors = $actorIds->isEmpty() ? collect() : User::whereIn('id', $actorIds)->pluck('name', 'id');
        $subjects = [
            'Appointment' => $this->appointmentLabels($clinic, $ids('Appointment')),
            'Patient' => $ids('Patient')->isEmpty() ? collect() : Patient::with('user:id,name')->whereIn('id', $ids('Patient'))->get()->mapWithKeys(fn ($p) => [$p->id => $p->display_name]),
            'InventoryItem' => $ids('InventoryItem')->isEmpty() ? collect() : InventoryItem::whereIn('id', $ids('InventoryItem'))->pluck('name', 'id'),
            'ServiceRate' => $ids('ServiceRate')->isEmpty() ? collect() : ServiceRate::whereIn('id', $ids('ServiceRate'))->pluck('service_name', 'id'),
            'ClinicBranch' => $ids('ClinicBranch')->isEmpty() ? collect() : ClinicBranch::whereIn('id', $ids('ClinicBranch'))->pluck('name', 'id'),
            'ClinicMembership' => $ids('ClinicMembership')->isEmpty() ? collect() : ClinicMembership::with('user:id,name')->whereIn('id', $ids('ClinicMembership'))->get()->mapWithKeys(fn ($m) => [$m->id => $m->user?->name]),
        ];

        return $logs->map(fn (AuditLog $log) => [
            'id' => $log->id,
            'action' => $log->action,
            'kind' => strtok($log->action, '.'),
            'title' => $this->title($log),
            'subject' => $subjects[$log->subject_type][$log->subject_id] ?? null,
            'actor' => $actors->get($log->user_id),
            'created_at' => BusinessTime::iso($log->created_at),
        ])->all();
    }

    private function title(AuditLog $log): string
    {
        if ($log->action === 'appointment.status_changed') {
            return self::STATUS_TITLES[$log->metadata['to'] ?? ''] ?? AuditPresenter::label($log->action);
        }

        return AuditPresenter::label($log->action);
    }

    /** "Jose Reyes – Tooth Extraction" */
    private function appointmentLabels(Clinic $clinic, Collection $ids): Collection
    {
        if ($ids->isEmpty()) {
            return collect();
        }

        return $clinic->appointments()->toBase()
            ->leftJoin('service_rates', 'service_rates.id', '=', 'appointments.service_rate_id')
            ->whereIn('appointments.id', $ids)
            ->get(['appointments.id', 'appointments.patient_name', 'service_rates.service_name'])
            ->mapWithKeys(fn ($a) => [$a->id => trim($a->patient_name.($a->service_name ? " – {$a->service_name}" : ''))]);
    }
}
