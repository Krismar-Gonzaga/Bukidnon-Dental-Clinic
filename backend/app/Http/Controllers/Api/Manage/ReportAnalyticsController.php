<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Clinic;
use App\Support\BusinessTime;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Reports & Analytics for one calendar year, up to today in the current year.
 * Aggregates only: no patient-level data. Revenue is an ESTIMATE (the listed
 * price of completed visits; there is no billing).
 */
class ReportAnalyticsController extends Controller
{
    private const CANCELLED = [Appointment::CANCELLED, Appointment::REJECTED, Appointment::NO_SHOW];

    public function __invoke(Request $request, Clinic $clinic)
    {
        $data = $request->validate(['year' => ['nullable', 'integer', 'min:2020', 'max:2100']]);
        $today = BusinessTime::today();
        $year = (int) ($data['year'] ?? $today->year);
        $start = $today->setDate($year, 1, 1);
        $end = $year === $today->year ? $today->endOfMonth() : $start->endOfYear();
        $range = [BusinessTime::utc($start), BusinessTime::utc($end)];

        // One row per day and status: months and active days both come from it.
        $day = BusinessTime::daySql('starts_at');
        $rows = $clinic->appointments()->toBase()
            ->whereBetween('starts_at', $range)
            ->selectRaw("{$day} AS day, status, COUNT(*) AS total")
            ->groupByRaw("{$day}, status")
            ->get();

        $monthKey = BusinessTime::monthSql('appointments.starts_at');
        $revenue = $clinic->appointments()->toBase()
            ->join('service_rates', 'service_rates.id', '=', 'appointments.service_rate_id')
            ->where('appointments.status', Appointment::COMPLETED)
            ->whereBetween('appointments.starts_at', $range)
            ->selectRaw("{$monthKey} AS month, SUM(service_rates.price) AS revenue, COUNT(*) AS visits")
            ->groupByRaw($monthKey)
            ->get()->keyBy('month');

        $patientMonth = BusinessTime::monthSql('created_at');
        $newPatients = DB::table('clinic_patients')->where('clinic_id', $clinic->id)
            ->whereBetween('created_at', $range)
            ->selectRaw("{$patientMonth} AS month, COUNT(*) AS total")
            ->groupByRaw($patientMonth)
            ->pluck('total', 'month');

        $months = collect(range(1, $end->month))->map(function (int $number) use ($start, $rows, $revenue, $newPatients) {
            $key = $start->month($number)->format('Y-m');
            $inMonth = $rows->filter(fn ($row) => str_starts_with($row->day, $key));
            $cancelled = (int) $inMonth->whereIn('status', self::CANCELLED)->sum('total');
            $total = (int) $inMonth->sum('total');

            return [
                'month' => $key,
                'total' => $total,
                'confirmed' => $total - $cancelled,
                'cancelled' => $cancelled,
                'revenue' => round((float) ($revenue[$key]->revenue ?? 0), 2),
                'completed_visits' => (int) ($revenue[$key]->visits ?? 0),
                'new_patients' => (int) ($newPatients[$key] ?? 0),
            ];
        })->values();

        return $this->ok([
            'year' => $year,
            'currency' => 'PHP',
            'months' => $months,
            'totals' => [
                'appointments' => $months->sum('total'),
                'confirmed' => $months->sum('confirmed'),
                'cancelled' => $months->sum('cancelled'),
                'active_days' => $rows->pluck('day')->unique()->count(),
                'revenue' => round($months->sum('revenue'), 2),
                'completed_visits' => $months->sum('completed_visits'),
                'new_patients' => $months->sum('new_patients'),
                'patients' => DB::table('clinic_patients')->where('clinic_id', $clinic->id)->count(),
            ],
            'treatments' => $clinic->appointments()->toBase()
                ->join('service_rates', 'service_rates.id', '=', 'appointments.service_rate_id')
                ->whereBetween('appointments.starts_at', $range)
                ->whereNotIn('appointments.status', self::CANCELLED)
                ->selectRaw('service_rates.service_name AS service, COUNT(*) AS total')
                ->selectRaw('SUM(CASE WHEN appointments.status = ? THEN service_rates.price ELSE 0 END) AS revenue', [Appointment::COMPLETED])
                ->groupBy('service_rates.service_name')
                ->orderByDesc('total')
                ->get()
                ->map(fn ($row) => ['service' => $row->service, 'total' => (int) $row->total, 'revenue' => round((float) $row->revenue, 2)]),
        ]);
    }
}
