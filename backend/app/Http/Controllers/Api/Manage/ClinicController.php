<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Http\Resources\AppointmentResource;
use App\Http\Resources\ClinicSummaryResource;
use App\Http\Resources\ReviewResource;
use App\Models\Appointment;
use App\Models\Clinic;
use App\Models\ClinicMembership;
use App\Models\InventoryBatch;
use App\Models\InventoryItem;
use App\Models\Review;
use App\Services\AuditLogger;
use App\Services\InventoryService;
use App\Support\BusinessTime;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

class ClinicController extends Controller
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function show(Request $request, Clinic $clinic)
    {
        $membership = $this->membership($request);

        return $this->ok([
            ...(new ClinicSummaryResource($clinic->load('specializations')))->resolve(),
            'status' => $clinic->status,
            'is_published' => $clinic->is_published,
            'my_role' => $membership->role,
            'my_permissions' => $membership->permissions(),
        ]);
    }

    public function update(Request $request, Clinic $clinic)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'address' => ['sometimes', 'string', 'max:255'],
            'city' => ['sometimes', 'string', 'max:100'],
            'province' => ['sometimes', 'string', 'max:100'],
            'contact_number' => ['sometimes', 'string', 'max:30'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'specialization_ids' => ['sometimes', 'array'],
            'specialization_ids.*' => ['integer', 'exists:specializations,id'],
        ]);

        $clinic->update($data);
        if (array_key_exists('specialization_ids', $data)) {
            $clinic->specializations()->sync($data['specialization_ids']);
        }

        $this->audit->record('clinic.profile_updated', $clinic, ['fields' => array_keys($data)], $clinic->id);

        return $this->ok((new ClinicSummaryResource($clinic->fresh('specializations')))->resolve(), 'Clinic profile updated');
    }

    /** Show or hide the clinic in the public directory (approved clinics only). */
    public function publish(Request $request, Clinic $clinic)
    {
        $data = $request->validate(['is_published' => ['required', 'boolean']]);

        if ($data['is_published'] && $clinic->status !== Clinic::STATUS_APPROVED) {
            return $this->fail('Only approved clinics can be published.', 409);
        }

        if ($data['is_published'] && ! $clinic->serviceRates()->available()->exists()) {
            return $this->fail('Add at least one available service before publishing.', 422);
        }

        $clinic->forceFill(['is_published' => $data['is_published']])->save();
        $this->audit->record($data['is_published'] ? 'clinic.published' : 'clinic.unpublished', $clinic, clinicId: $clinic->id);

        return $this->ok(['is_published' => $clinic->is_published], $clinic->is_published ? 'Clinic is now listed' : 'Clinic is hidden from the directory');
    }

    /** Sections are included only when the member's permissions allow them. */
    public function dashboard(Request $request, Clinic $clinic, InventoryService $inventory)
    {
        $membership = $this->membership($request);
        $dentist = $this->actingDentist($request);
        $today = BusinessTime::today();
        $data = [];

        if ($membership->grants('appointments.view_all') || $membership->grants('appointments.view_assigned')) {
            $scoped = fn () => $clinic->appointments()
                ->when(! $membership->grants('appointments.view_all'), fn ($q) => $q->where('dentist_id', $dentist?->id ?? 0));

            $todays = $scoped()
                ->whereBetween('starts_at', [BusinessTime::utc($today), BusinessTime::utc($today->endOfDay())])
                ->with(['dentist.user', 'serviceRate'])
                ->orderBy('starts_at')
                ->get();

            // All counts in one query: each round trip to a remote database is slow.
            $monthStart = BusinessTime::utc($today->startOfMonth());
            $in = fn (array $statuses) => 'status IN ('.implode(', ', array_fill(0, count($statuses), '?')).')';
            $counts = $scoped()->toBase()->selectRaw(
                'SUM(CASE WHEN '.$in([Appointment::PENDING, Appointment::RESCHEDULE_REQUESTED]).' THEN 1 ELSE 0 END) AS pending_requests,
                 SUM(CASE WHEN '.$in(Appointment::ACTIVE_STATUSES).' AND starts_at > ? THEN 1 ELSE 0 END) AS upcoming,
                 SUM(CASE WHEN status = ? AND starts_at >= ? THEN 1 ELSE 0 END) AS completed_this_month,
                 SUM(CASE WHEN status = ? AND starts_at >= ? THEN 1 ELSE 0 END) AS cancelled_this_month,
                 SUM(CASE WHEN starts_at BETWEEN ? AND ? THEN 1 ELSE 0 END) AS same_day_last_week',
                [
                    Appointment::PENDING, Appointment::RESCHEDULE_REQUESTED,
                    ...Appointment::ACTIVE_STATUSES, now(),
                    Appointment::COMPLETED, $monthStart,
                    Appointment::CANCELLED, $monthStart,
                    BusinessTime::utc($today->subWeek()), BusinessTime::utc($today->subWeek()->endOfDay()),
                ],
            )->first();

            $data['appointments'] = [
                'today' => $todays->map(fn ($a) => (new AppointmentResource($a))->clinicView()->resolve()),
                'pending_requests' => (int) ($counts->pending_requests ?? 0),
                'upcoming' => (int) ($counts->upcoming ?? 0),
                'completed_this_month' => (int) ($counts->completed_this_month ?? 0),
                'cancelled_this_month' => (int) ($counts->cancelled_this_month ?? 0),
                'same_day_last_week' => (int) ($counts->same_day_last_week ?? 0),
            ];
        }

        if ($membership->role === ClinicMembership::ROLE_DENTIST) {
            $data['my_patients'] = $this->dentistPatients($clinic, $dentist?->id ?? 0, $today);
        }

        if ($membership->grants('patients.view')) {
            $data['active_patients'] = $clinic->patients()->count();
        }

        $inventoryAlerts = null;
        if ($membership->grants('inventory.view')) {
            $inventoryAlerts = $inventory->alerts($clinic);
            $data['inventory'] = [
                'low_stock' => count($inventoryAlerts['low_stock']),
                'near_expiry' => count($inventoryAlerts['near_expiry']),
                'expired' => count($inventoryAlerts['expired']),
            ];
        }

        if ($membership->grants('reports.view')) {
            $data['overview'] = $this->overview($clinic, $today);
        }

        $data['alerts'] = $this->alerts($clinic, $membership, $inventoryAlerts);

        if ($membership->grants('feedback.view')) {
            $data['feedback'] = [
                'rating' => $clinic->rating_stars,
                'recent' => ReviewResource::collection(
                    $clinic->reviews()->with('patient.user')->latest()->limit(5)->get()
                )->resolve(),
            ];
        }

        return $this->ok($data);
    }

    /**
     * A dentist's patients at this clinic. A patient is "new" in the period
     * that holds their first booked (not cancelled or declined) visit with
     * this dentist.
     */
    private function dentistPatients(Clinic $clinic, int $dentistId, CarbonImmutable $today): array
    {
        $firstVisits = $clinic->appointments()
            ->where('dentist_id', $dentistId)
            ->whereNotIn('status', [Appointment::CANCELLED, Appointment::REJECTED])
            ->selectRaw('patient_id, MIN(starts_at) as first_at')
            ->groupBy('patient_id')
            ->pluck('first_at')
            ->map(fn ($at) => CarbonImmutable::parse($at, 'UTC'));

        $between = fn (CarbonImmutable $from, CarbonImmutable $to) => $firstVisits
            ->filter(fn ($at) => $at->between(BusinessTime::utc($from), BusinessTime::utc($to)))
            ->count();

        return [
            'total' => $firstVisits->count(),
            'new_this_month' => $between($today->startOfMonth(), $today->endOfMonth()),
            'new_today' => $between($today, $today->endOfDay()),
        ];
    }

    /**
     * Owner's operations overview: this month against last month, per-branch
     * activity and the services booked. Revenue is an ESTIMATE: the listed
     * price of each completed appointment's service (there is no billing).
     */
    private function overview(Clinic $clinic, CarbonImmutable $today): array
    {
        $monthStart = $today->startOfMonth();
        $lastMonthStart = $monthStart->subMonth();
        $monthEnd = $today->endOfMonth();
        $dayStart = BusinessTime::utc($today);
        $dayEnd = BusinessTime::utc($today->endOfDay());
        $booked = [Appointment::CANCELLED, Appointment::REJECTED];

        $twoMonths = [BusinessTime::utc($lastMonthStart), BusinessTime::utc($monthEnd)];
        $thisMonthFrom = BusinessTime::utc($monthStart);

        // Per branch, over last month and this month, in one query each for
        // visits and revenue; the clinic totals are the sums of the branches.
        $perBranch = $clinic->appointments()->toBase()
            ->whereNotIn('appointments.status', $booked)
            ->whereBetween('appointments.starts_at', $twoMonths)
            ->selectRaw('appointments.branch_id')
            ->selectRaw('SUM(CASE WHEN appointments.starts_at >= ? THEN 1 ELSE 0 END) AS appointments', [$thisMonthFrom])
            ->selectRaw('SUM(CASE WHEN appointments.starts_at < ? THEN 1 ELSE 0 END) AS last_month', [$thisMonthFrom])
            ->selectRaw('COUNT(DISTINCT CASE WHEN appointments.starts_at >= ? THEN appointments.patient_id END) AS patients', [$thisMonthFrom])
            ->selectRaw('SUM(CASE WHEN appointments.starts_at BETWEEN ? AND ? THEN 1 ELSE 0 END) AS today', [$dayStart, $dayEnd])
            ->groupBy('appointments.branch_id')->get()->keyBy('branch_id');
        $revenuePerBranch = $clinic->appointments()->toBase()
            ->join('service_rates', 'service_rates.id', '=', 'appointments.service_rate_id')
            ->where('appointments.status', Appointment::COMPLETED)
            ->whereBetween('appointments.starts_at', $twoMonths)
            ->selectRaw('appointments.branch_id')
            ->selectRaw('SUM(CASE WHEN appointments.starts_at >= ? THEN service_rates.price ELSE 0 END) AS total', [$thisMonthFrom])
            ->selectRaw('SUM(CASE WHEN appointments.starts_at < ? THEN service_rates.price ELSE 0 END) AS last_month', [$thisMonthFrom])
            ->selectRaw('SUM(CASE WHEN appointments.starts_at BETWEEN ? AND ? THEN service_rates.price ELSE 0 END) AS today', [$dayStart, $dayEnd])
            ->groupBy('appointments.branch_id')->get()->keyBy('branch_id');
        $staff = $clinic->memberships()->toBase()
            ->where('status', ClinicMembership::STATUS_ACTIVE)
            ->selectRaw('COUNT(*) AS active, SUM(CASE WHEN role = ? THEN 1 ELSE 0 END) AS dentists', [ClinicMembership::ROLE_DENTIST])
            ->first();

        $holidays = $clinic->holidays()->whereDate('date', $today->toDateString())->get();
        $now = BusinessTime::now()->format('H:i');

        $branches = $clinic->branches()->where('is_active', true)->with('operatingHours')
            ->orderByDesc('is_main')->orderBy('name')->get()
            ->map(function ($branch) use ($perBranch, $revenuePerBranch, $holidays, $today, $now) {
                $hours = $branch->operatingHours->firstWhere('day_of_week', $today->dayOfWeek);
                $closedToday = $holidays->contains(fn ($h) => $h->branch_id === null || $h->branch_id === $branch->id);
                $opensAt = $hours ? substr((string) $hours->opens_at, 0, 5) : null;
                $closesAt = $hours ? substr((string) $hours->closes_at, 0, 5) : null;

                return [
                    'id' => $branch->id,
                    'name' => $branch->name,
                    'address' => $branch->address,
                    'city' => $branch->city,
                    'is_main' => (bool) $branch->is_main,
                    'latitude' => $branch->latitude !== null ? (float) $branch->latitude : null,
                    'longitude' => $branch->longitude !== null ? (float) $branch->longitude : null,
                    'appointments_today' => (int) ($perBranch[$branch->id]->today ?? 0),
                    'appointments_this_month' => (int) ($perBranch[$branch->id]->appointments ?? 0),
                    'patients_this_month' => (int) ($perBranch[$branch->id]->patients ?? 0),
                    'revenue_this_month' => round((float) ($revenuePerBranch[$branch->id]->total ?? 0), 2),
                    'revenue_today' => round((float) ($revenuePerBranch[$branch->id]->today ?? 0), 2),
                    'hours_today' => ! $closedToday && $hours ? ['opens_at' => $opensAt, 'closes_at' => $closesAt] : null,
                    'open_now' => ! $closedToday && $hours && $now >= $opensAt && $now < $closesAt,
                ];
            });

        $treatments = $clinic->appointments()
            ->whereNotIn('appointments.status', $booked)
            ->whereBetween('appointments.starts_at', [$thisMonthFrom, BusinessTime::utc($monthEnd)])
            ->join('service_rates', 'service_rates.id', '=', 'appointments.service_rate_id')
            ->selectRaw('service_rates.service_name AS service, COUNT(*) AS total')
            ->groupBy('service_rates.service_name')->orderByDesc('total')->limit(6)->get()
            ->map(fn ($row) => ['service' => $row->service, 'total' => (int) $row->total]);

        return [
            'month' => $monthStart->format('Y-m'),
            'appointments' => ['this_month' => (int) $perBranch->sum('appointments'), 'last_month' => (int) $perBranch->sum('last_month')],
            'revenue_estimate' => [
                'this_month' => round((float) $revenuePerBranch->sum('total'), 2),
                'last_month' => round((float) $revenuePerBranch->sum('last_month'), 2),
                'currency' => 'PHP',
            ],
            'staff' => [
                'active' => (int) ($staff->active ?? 0),
                'dentists' => (int) ($staff->dentists ?? 0),
            ],
            'branches' => $branches,
            'treatments' => $treatments,
        ];
    }

    /**
     * Things that need someone's attention now, limited to what the member
     * may see: stock problems, appointment requests, reported reviews.
     */
    private function alerts(Clinic $clinic, ClinicMembership $membership, ?array $inventory): array
    {
        $alerts = [];

        if ($inventory) {
            foreach ($inventory['expired'] as $batch) {
                $alerts[] = ['type' => 'inventory', 'severity' => 'danger', 'title' => "Expired: {$batch['name']}",
                    'message' => "Batch {$batch['batch_number']} expired on {$batch['expires_on']} ({$batch['quantity']} {$batch['unit']} on hand).", 'item_id' => $batch['item_id']];
            }
            foreach ($inventory['low_stock'] as $item) {
                $alerts[] = ['type' => 'inventory', 'severity' => 'danger', 'title' => "Low stock: {$item['name']}",
                    'message' => "{$item['quantity']} {$item['unit']} left (minimum {$item['minimum_stock']}).", 'item_id' => $item['item_id']];
            }
            foreach ($inventory['near_expiry'] as $batch) {
                $alerts[] = ['type' => 'inventory', 'severity' => 'warning', 'title' => "Expiring soon: {$batch['name']}",
                    'message' => "Batch {$batch['batch_number']} expires on {$batch['expires_on']}.", 'item_id' => $batch['item_id']];
            }
        }

        if ($membership->grants('appointments.manage')) {
            $waiting = $clinic->appointments()->toBase()
                ->whereIn('status', [Appointment::PENDING, Appointment::RESCHEDULE_REQUESTED])
                ->selectRaw('status, COUNT(*) AS total')->groupBy('status')->pluck('total', 'status');
            $pending = (int) ($waiting[Appointment::PENDING] ?? 0);
            $reschedules = (int) ($waiting[Appointment::RESCHEDULE_REQUESTED] ?? 0);
            if ($pending > 0) {
                $alerts[] = ['type' => 'appointments', 'severity' => 'info', 'title' => 'Appointment requests waiting',
                    'message' => "{$pending} ".($pending === 1 ? 'request needs' : 'requests need').' confirming or declining.', 'status' => Appointment::PENDING];
            }
            if ($reschedules > 0) {
                $alerts[] = ['type' => 'appointments', 'severity' => 'info', 'title' => 'Reschedule requests',
                    'message' => "{$reschedules} ".($reschedules === 1 ? 'patient asked' : 'patients asked').' for a new time.', 'status' => Appointment::RESCHEDULE_REQUESTED];
            }
        }

        if ($membership->grants('feedback.view')) {
            $pendingReviews = $clinic->reviews()->where('status', Review::STATUS_PENDING)->count();
            if ($pendingReviews > 0) {
                $alerts[] = ['type' => 'reviews', 'severity' => 'info', 'title' => 'Reviews awaiting moderation',
                    'message' => "{$pendingReviews} new ".($pendingReviews === 1 ? 'review is' : 'reviews are').' waiting for approval before they are published.'];
            }
        }

        return array_slice($alerts, 0, 12);
    }

    /** Appointment summary for a date range (defaults to this month). */
    public function report(Request $request, Clinic $clinic)
    {
        $data = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        $from = isset($data['from']) ? BusinessTime::parse($data['from']) : BusinessTime::today()->startOfMonth();
        $to = isset($data['to']) ? BusinessTime::parse($data['to'])->endOfDay() : BusinessTime::today()->endOfMonth();

        $base = fn () => $clinic->appointments()->whereBetween('starts_at', [BusinessTime::utc($from), BusinessTime::utc($to)]);

        return $this->ok([
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'by_status' => $base()->selectRaw('status, COUNT(*) as total')->groupBy('status')->pluck('total', 'status'),
            'by_service' => $base()->join('service_rates', 'service_rates.id', '=', 'appointments.service_rate_id')
                ->selectRaw('service_rates.service_name as service, COUNT(*) as total')
                ->groupBy('service_rates.service_name')->orderByDesc('total')->get(),
            'by_dentist' => $base()->join('dentists', 'dentists.id', '=', 'appointments.dentist_id')
                ->join('users', 'users.id', '=', 'dentists.user_id')
                ->selectRaw('users.name as dentist, COUNT(*) as total')
                ->groupBy('users.name')->orderByDesc('total')->get(),
            'new_patients' => $clinic->patients()->wherePivotBetween('created_at', [BusinessTime::utc($from), BusinessTime::utc($to)])->count(),
            'reviews' => [
                'count' => $clinic->reviews()->where('status', Review::STATUS_APPROVED)->whereBetween('created_at', [BusinessTime::utc($from), BusinessTime::utc($to)])->count(),
                'average' => round((float) $clinic->reviews()->where('status', Review::STATUS_APPROVED)->whereBetween('created_at', [BusinessTime::utc($from), BusinessTime::utc($to)])->avg('rating'), 1),
            ],
        ]);
    }
}
