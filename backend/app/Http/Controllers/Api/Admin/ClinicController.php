<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ClinicSummaryResource;
use App\Models\AuditLog;
use App\Models\Clinic;
use App\Models\ClinicApplication;
use App\Models\ClinicMembership;
use App\Services\AuditLogger;
use App\Support\AuditPresenter;
use App\Support\BusinessTime;
use App\Support\SubscriptionStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Platform oversight of clinics. Deliberately no access to a clinic's
 * patients, appointments or records from here.
 */
class ClinicController extends Controller
{
    private const ACTIVITY_LIMIT = 6;

    private const ACTIVITY_CATEGORIES = ['verification', 'clinics', 'subscription', 'appointments', 'reviews'];

    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function index(Request $request)
    {
        $request->validate(['status' => ['nullable', 'in:pending,approved,suspended'], 'search' => ['nullable', 'string', 'max:100']]);

        $page = Clinic::query()
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->when($request->filled('search'), fn ($q) => $q->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($request->search).'%']))
            ->withCount(['memberships', 'branches'])
            ->orderBy('name')
            ->paginate($this->perPage($request, 20));

        return $this->paginated($page, fn (Clinic $c) => [
            ...(new ClinicSummaryResource($c))->resolve(),
            'status' => $c->status,
            'is_published' => $c->is_published,
            'members_count' => $c->memberships_count,
            'branches_count' => $c->branches_count,
            'suspension_reason' => $c->suspension_reason,
        ]);
    }

    /**
     * Clinic Management: every clinic, and the registrations still on their way to becoming
     * one (they only get a clinic record when approved).
     */
    public function directory(Request $request)
    {
        $request->validate([
            'status' => ['nullable', 'in:approved,suspended,pending,under_review,rejected'],
            'search' => ['nullable', 'string', 'max:100'],
        ]);

        $clinics = DB::table('clinics')->selectRaw("'clinic' as kind, id, name, city, status");
        $registrations = DB::table('clinic_applications')
            ->whereIn('status', [ClinicApplication::PENDING, ClinicApplication::UNDER_REVIEW, ClinicApplication::REJECTED])
            ->selectRaw("'application' as kind, id, clinic_name as name, city, status");

        $page = DB::query()->fromSub($clinics->unionAll($registrations), 'directory')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->when($request->filled('search'), fn ($q) => $q->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($request->search).'%']))
            ->orderBy('name')
            ->orderBy('kind')
            ->paginate($this->perPage($request, 25));

        $rows = collect($page->items());
        $clinicModels = $this->withAdministrator(Clinic::query())
            ->with(['subscription', 'application'])
            ->whereIn('id', $rows->where('kind', 'clinic')->pluck('id'))
            ->get()->keyBy('id');
        $applications = ClinicApplication::with('applicant:id,name')
            ->whereIn('id', $rows->where('kind', 'application')->pluck('id'))
            ->get()->keyBy('id');

        return $this->paginated($page, function ($row) use ($clinicModels, $applications) {
            if ($row->kind === 'clinic') {
                $clinic = $clinicModels[$row->id];

                return [
                    'kind' => 'clinic',
                    'id' => $clinic->id,
                    'name' => $clinic->name,
                    'city' => $clinic->city,
                    'status' => $clinic->status,
                    'admin' => $this->administrator($clinic),
                    'plan' => SubscriptionStatus::plan($clinic->subscription)['name'],
                    'application_id' => $clinic->application?->id,
                ];
            }

            $application = $applications[$row->id];

            return [
                'kind' => 'application',
                'id' => $application->id,
                'name' => $application->clinic_name,
                'city' => $application->city,
                'status' => $application->status,
                'admin' => $application->representative_name ?: $application->applicant?->name,
                'plan' => config('subscriptions.plans.'.config('subscriptions.default_plan').'.name'),
                'application_id' => $application->id,
                'missing_documents' => count($application->missingDocuments()),
            ];
        });
    }

    public function show(Clinic $clinic)
    {
        $clinic = $this->withAdministrator(Clinic::query())->with(['subscription', 'latestPayment', 'application'])->findOrFail($clinic->id);

        return $this->ok([
            'id' => $clinic->id,
            'name' => $clinic->name,
            'city' => $clinic->city,
            'status' => $clinic->status,
            'is_verified' => $clinic->is_verified,
            'is_published' => $clinic->is_published,
            'admin' => $this->administrator($clinic),
            'plan' => SubscriptionStatus::plan($clinic->subscription)['name'],
            'since' => BusinessTime::iso($clinic->created_at),
            'renews_at' => BusinessTime::iso($clinic->subscription?->renews_at),
            'subscription_status' => SubscriptionStatus::of($clinic->subscription, $clinic->latestPayment),
            'application_id' => $clinic->application?->id,
            'suspension_reason' => $clinic->suspension_reason,
            'activity' => $this->activity($clinic),
        ]);
    }

    /** What happened at the clinic, as labels and dates only: no names and nothing clinical. */
    private function activity(Clinic $clinic): array
    {
        return AuditLog::where('clinic_id', $clinic->id)
            ->where(fn ($q) => collect(self::ACTIVITY_CATEGORIES)->each(fn (string $category) => $q->orWhere(fn ($w) => AuditPresenter::whereCategory($w, $category))))
            ->orderByDesc('id')
            ->limit(self::ACTIVITY_LIMIT)
            ->get(['id', 'action', 'created_at'])
            ->map(fn (AuditLog $log) => ['id' => $log->id, 'label' => AuditPresenter::label($log->action), 'at' => BusinessTime::iso($log->created_at)])
            ->all();
    }

    private function withAdministrator(Builder $query): Builder
    {
        return $query->with([
            'owner:id,name',
            'memberships' => fn ($q) => $q->active()->where('role', ClinicMembership::ROLE_CLINIC_ADMIN)->with('user:id,name'),
        ]);
    }

    private function administrator(Clinic $clinic): ?string
    {
        return $clinic->owner?->name ?? $clinic->memberships->first()?->user?->name;
    }

    /** Hides the clinic from the directory and blocks new bookings. */
    public function suspend(Request $request, Clinic $clinic)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);

        $clinic->forceFill([
            'status' => Clinic::STATUS_SUSPENDED,
            'suspension_reason' => $data['reason'],
            'suspended_at' => now(),
        ])->save();

        $this->audit->record('clinic.suspended', $clinic, ['reason' => $data['reason']], $clinic->id);

        return $this->ok(['status' => $clinic->status], 'Clinic suspended');
    }

    public function reactivate(Clinic $clinic)
    {
        if ($clinic->status !== Clinic::STATUS_SUSPENDED) {
            return $this->fail('Only suspended clinics can be reactivated.', 409);
        }

        $clinic->forceFill(['status' => Clinic::STATUS_APPROVED, 'suspension_reason' => null, 'suspended_at' => null])->save();
        $this->audit->record('clinic.reactivated', $clinic, clinicId: $clinic->id);

        return $this->ok(['status' => $clinic->status], 'Clinic reactivated');
    }
}
