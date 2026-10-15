<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Http\Resources\AppointmentResource;
use App\Http\Resources\ClinicSummaryResource;
use App\Http\Resources\ReviewResource;
use App\Models\Appointment;
use App\Models\Clinic;
use App\Models\InventoryBatch;
use App\Models\InventoryItem;
use App\Models\Review;
use App\Services\AuditLogger;
use App\Services\InventoryService;
use App\Support\BusinessTime;
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

            $data['appointments'] = [
                'today' => $todays->map(fn ($a) => (new AppointmentResource($a))->clinicView()->resolve()),
                'pending_requests' => $scoped()->whereIn('status', [Appointment::PENDING, Appointment::RESCHEDULE_REQUESTED])->count(),
                'upcoming' => $scoped()->active()->where('starts_at', '>', now())->count(),
                'completed_this_month' => $scoped()->where('status', Appointment::COMPLETED)->where('starts_at', '>=', BusinessTime::utc($today->startOfMonth()))->count(),
                'cancelled_this_month' => $scoped()->where('status', Appointment::CANCELLED)->where('starts_at', '>=', BusinessTime::utc($today->startOfMonth()))->count(),
            ];
        }

        if ($membership->grants('patients.view')) {
            $data['active_patients'] = $clinic->patients()->count();
        }

        if ($membership->grants('inventory.view')) {
            $alerts = $inventory->alerts($clinic);
            $data['inventory'] = [
                'low_stock' => count($alerts['low_stock']),
                'near_expiry' => count($alerts['near_expiry']),
                'expired' => count($alerts['expired']),
            ];
        }

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
