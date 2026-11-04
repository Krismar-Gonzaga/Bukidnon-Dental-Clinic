<?php

namespace App\Services;

use App\Models\Clinic;
use App\Models\ClinicApplication;
use App\Models\Subscription;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Support\BusinessTime;
use App\Support\SubscriptionStatus;
use Carbon\CarbonImmutable;

/**
 * Reports & Analytics: platform aggregates only, no personal data. Each metric compares the
 * chosen Philippine calendar month with the one before it. "New" figures count the month's
 * events; Verified, Pending and Active count what stood at the end of the month.
 */
class PlatformReports
{
    public const SECTIONS = ['clinics', 'users', 'subscriptions'];

    private const GROWTH_MONTHS = 4;

    private const ROLE_METRICS = [
        'New Patients' => 'patient',
        'New Dentists' => 'dentist',
        'New Clinic Admins' => 'clinic_admin',
        'New Clinic Staff' => 'staff',
    ];

    /** The first day of a "YYYY-MM" month, or of the current month. */
    public function month(?string $month): CarbonImmutable
    {
        return $month
            ? BusinessTime::parse($month.'-01')->startOfMonth()
            : BusinessTime::today()->startOfMonth();
    }

    public function build(CarbonImmutable $month): array
    {
        return [
            'month' => $month->format('Y-m'),
            'month_label' => $month->format('F Y'),
            'previous_label' => $month->subMonthNoOverflow()->format('F Y'),
            'overview' => [
                'clinic_growth' => $this->clinicGrowth($month),
                'plans' => $this->planBreakdown(),
            ],
            ...collect(self::SECTIONS)->mapWithKeys(fn (string $section) => [$section => $this->section($section, $month)])->all(),
        ];
    }

    public function section(string $section, CarbonImmutable $month): array
    {
        $previous = $month->subMonthNoOverflow();
        $current = $this->metrics($section, $month);
        $before = $this->metrics($section, $previous);

        return collect($current)->map(fn (int $value, string $label) => [
            'metric' => $label,
            'current' => $value,
            'previous' => $before[$label],
            'change' => $value - $before[$label],
        ])->values()->all();
    }

    private function metrics(string $section, CarbonImmutable $month): array
    {
        $start = BusinessTime::utc($month->startOfMonth());
        $end = BusinessTime::utc($month->endOfMonth());

        return match ($section) {
            'clinics' => $this->clinicMetrics($start, $end),
            'users' => $this->userMetrics($start, $end),
            'subscriptions' => $this->subscriptionMetrics($start, $end),
        };
    }

    private function clinicMetrics(CarbonImmutable $start, CarbonImmutable $end): array
    {
        return [
            'New Registrations' => ClinicApplication::whereBetween('submitted_at', [$start, $end])->count(),
            'Verified' => Clinic::where('is_verified', true)->where('created_at', '<=', $end)->count(),
            'Pending' => ClinicApplication::where('submitted_at', '<=', $end)
                ->where(fn ($q) => $q
                    ->whereIn('status', [ClinicApplication::PENDING, ClinicApplication::UNDER_REVIEW])
                    ->orWhere('reviewed_at', '>', $end))
                ->count(),
            'Rejected' => ClinicApplication::where('status', ClinicApplication::REJECTED)->whereBetween('reviewed_at', [$start, $end])->count(),
        ];
    }

    private function userMetrics(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $totals = User::whereBetween('created_at', [$start, $end])
            ->selectRaw('role, COUNT(*) as total')
            ->groupBy('role')
            ->pluck('total', 'role');

        return collect(self::ROLE_METRICS)->map(fn (string $role) => (int) ($totals[$role] ?? 0))->all();
    }

    private function subscriptionMetrics(CarbonImmutable $start, CarbonImmutable $end): array
    {
        $now = CarbonImmutable::now('UTC');

        return [
            'Active Subscriptions' => Subscription::whereNotNull('clinic_id')->where('renews_at', '>', $end)->count(),
            'Payments Verified' => SubscriptionPayment::where('status', SubscriptionPayment::VERIFIED)->whereBetween('reviewed_at', [$start, $end])->count(),
            'Pending Payments' => SubscriptionPayment::where('created_at', '<=', $end)
                ->where(fn ($q) => $q->where('status', SubscriptionPayment::PENDING)->orWhere('reviewed_at', '>', $end))
                ->count(),
            'Expired Subscriptions' => Subscription::whereNotNull('clinic_id')
                ->whereBetween('renews_at', [$start, $end->lessThan($now) ? $end : $now])
                ->count(),
        ];
    }

    /** Verified clinics standing at the end of each of the last few months. */
    private function clinicGrowth(CarbonImmutable $month): array
    {
        return collect(range(self::GROWTH_MONTHS - 1, 0))->map(function (int $back) use ($month) {
            $point = $month->subMonthsNoOverflow($back);

            return [
                'month' => $point->format('Y-m'),
                'label' => $point->format('M'),
                'total' => Clinic::where('is_verified', true)->where('created_at', '<=', BusinessTime::utc($point->endOfMonth()))->count(),
            ];
        })->all();
    }

    /** Clinics per plan. A clinic with no subscription row yet is on the default plan. */
    private function planBreakdown(): array
    {
        $counts = Clinic::where('status', '!=', Clinic::STATUS_PENDING)->with('subscription')->get()
            ->groupBy(fn (Clinic $clinic) => SubscriptionStatus::planKey($clinic->subscription))
            ->map->count();

        return collect(config('subscriptions.plans'))
            ->filter(fn (array $plan, string $key) => ($counts[$key] ?? 0) > 0 || ! ($plan['retired'] ?? false))
            ->map(fn (array $plan, string $key) => ['key' => $key, 'name' => $plan['name'], 'total' => (int) ($counts[$key] ?? 0)])
            ->values()
            ->all();
    }
}
