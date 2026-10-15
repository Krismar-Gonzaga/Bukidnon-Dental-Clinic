<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ClinicSummaryResource;
use App\Http\Resources\ReviewResource;
use App\Models\Clinic;
use App\Models\Review;
use App\Services\AvailabilityService;
use App\Support\BusinessTime;
use Illuminate\Http\Request;

class PublicClinicController extends Controller
{
    /** All listed clinics with coordinates, for the map. */
    public function map()
    {
        return $this->ok(
            Clinic::publiclyListed()
                ->orderBy('name')
                ->get()
                ->map(fn ($clinic) => (new ClinicSummaryResource($clinic))->resolve())
        );
    }

    /**
     * Open slots for a service on a date. Optional dentist_id / branch_id.
     * GET /clinics/{id}/availability?date=2026-10-20&service_rate_id=3
     */
    public function availability(Request $request, int $id, AvailabilityService $availability)
    {
        $clinic = Clinic::publiclyListed()->findOrFail($id);

        $data = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'service_rate_id' => ['required', 'integer'],
            'dentist_id' => ['nullable', 'integer'],
            'branch_id' => ['nullable', 'integer'],
        ]);

        $service = $clinic->serviceRates()->available()->findOrFail($data['service_rate_id']);
        $dentist = isset($data['dentist_id'])
            ? $clinic->dentistProfiles()->findOrFail($data['dentist_id'])
            : null;
        $branch = isset($data['branch_id'])
            ? $clinic->branches()->where('is_active', true)->findOrFail($data['branch_id'])
            : null;

        $slots = $availability->slots($clinic, BusinessTime::parse($data['date']), $service, $dentist, $branch);

        return $this->ok($slots->map(fn ($slot) => [
            'starts_at' => BusinessTime::iso($slot['starts_at']),
            'ends_at' => BusinessTime::iso($slot['ends_at']),
            'time' => $slot['starts_at']->format('H:i'),
            'dentist_id' => $slot['dentist_id'],
            'branch_id' => $slot['branch_id'],
        ]), meta: ['timezone' => BusinessTime::zone()]);
    }

    /** Published reviews, newest first. */
    public function reviews(Request $request, int $id)
    {
        $clinic = Clinic::publiclyListed()->findOrFail($id);

        $page = $clinic->reviews()
            ->where('status', Review::STATUS_APPROVED)
            ->with('patient.user')
            ->latest()
            ->paginate($this->perPage($request, 10));

        return $this->paginated($page, fn ($review) => (new ReviewResource($review))->resolve());
    }
}
