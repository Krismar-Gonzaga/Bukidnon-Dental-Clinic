<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\BranchResource;
use App\Http\Resources\ClinicSummaryResource;
use App\Http\Resources\DentistResource;
use App\Http\Resources\ReviewResource;
use App\Http\Resources\ServiceRateResource;
use App\Models\Clinic;
use App\Models\Review;
use App\Models\Service;
use App\Models\ServiceRate;
use App\Models\Specialization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/** Public directory: only approved, published clinics are ever returned. */
class HomeController extends Controller
{
    public function index(Request $request)
    {
        $featuredClinics = Clinic::publiclyListed()
            ->with(['specializations'])
            ->orderBy('rating', 'desc')
            ->limit(4)
            ->get()
            ->map(function ($clinic) {
                return [
                    'id' => $clinic->id,
                    'name' => $clinic->name,
                    'address' => $clinic->full_address,
                    'city' => $clinic->city,
                    'rating' => $clinic->rating_stars,
                    'logo' => $clinic->image,
                    'latitude' => $clinic->latitude,
                    'longitude' => $clinic->longitude,
                    'specializations' => $clinic->specializations->pluck('name')->take(2),
                    'is_verified' => $clinic->is_verified,
                ];
            });

        $specializations = Specialization::where('is_active', true)
            ->get()
            ->map(fn ($spec) => [
                'id' => $spec->id,
                'name' => $spec->name,
                'description' => $spec->description,
                'icon' => $spec->icon,
            ]);

        $popularServices = Service::orderBy('sort_order')
            ->limit(6)
            ->get()
            ->map(fn ($service) => [
                'id' => $service->id,
                'name' => $service->name,
                'description' => $service->description,
                'icon' => $service->icon_name,
                'color' => $service->color,
            ]);

        // Lowest available price per service across listed clinics
        $serviceRates = ServiceRate::available()
            ->whereHas('clinic', fn ($q) => $q->publiclyListed())
            ->selectRaw('service_name, MIN(price) as starting_price, COUNT(DISTINCT clinic_id) as clinic_count, MAX(currency) as currency')
            ->groupBy('service_name')
            ->orderBy('starting_price')
            ->limit(6)
            ->get()
            ->map(fn ($rate) => [
                'service_name' => $rate->service_name,
                'starting_price' => (float) $rate->starting_price,
                'currency' => $rate->currency ?? 'PHP',
                'clinic_count' => (int) $rate->clinic_count,
            ]);

        $recentReviews = Review::with(['clinic', 'patient.user'])
            ->where('status', Review::STATUS_APPROVED)
            ->whereHas('clinic', fn ($q) => $q->publiclyListed())
            ->orderBy('created_at', 'desc')
            ->limit(6)
            ->get()
            ->map(fn ($review) => [
                'id' => $review->id,
                'patient_name' => (new ReviewResource($review))->resolve()['patient_name'],
                'clinic_name' => $review->clinic->name ?? null,
                'rating' => $review->rating,
                'comment' => $review->comment,
                'date' => $review->created_at->diffForHumans(),
            ]);

        $stats = [
            'verified_clinics' => Clinic::publiclyListed()->count(),
            'total_reviews' => Review::where('status', Review::STATUS_APPROVED)->count(),
            'total_specializations' => Specialization::where('is_active', true)->count(),
        ];

        return $this->ok([
            'featured_clinics' => $featuredClinics,
            'specializations' => $specializations,
            'popular_services' => $popularServices,
            'service_rates' => $serviceRates,
            'recent_reviews' => $recentReviews,
            'stats' => $stats,
            'meta' => [
                'page_title' => 'Find Trusted Dental Clinics Across Bukidnon',
                'page_description' => 'Search clinics, compare services, view dentists by specialization, and book appointments online with the most reliable dental network in the province.',
            ],
        ]);
    }

    /**
     * Search the directory. Filters: search, city, specialization_id,
     * service_id (catalog service) or service (name contains), sort
     * (rating|newest|name|price). Paginated (per_page up to 100).
     *
     * Response keeps Laravel's paginator shape under `data` for older clients.
     */
    public function searchClinics(Request $request)
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'city' => ['nullable', 'string', 'max:100'],
            'specialization_id' => ['nullable', 'integer'],
            'specialization' => ['nullable', 'string', 'max:100'],
            'service_id' => ['nullable', 'integer'],
            'service' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', 'in:rating,reviews,newest,name,price'],
        ]);

        $query = Clinic::publiclyListed()
            ->with(['specializations'])
            ->withCount(['reviews' => fn ($q) => $q->where('status', Review::STATUS_APPROVED)])
            ->addSelect(['starting_price' => ServiceRate::selectRaw('MIN(price)')
                ->whereColumn('service_rates.clinic_id', 'clinics.id')
                ->where('is_available', true)]);

        if ($request->filled('search')) {
            $term = '%'.mb_strtolower($request->search).'%';
            $query->where(fn (Builder $q) => $q
                ->whereRaw('LOWER(name) LIKE ?', [$term])
                ->orWhereRaw('LOWER(city) LIKE ?', [$term])
                ->orWhereRaw('LOWER(address) LIKE ?', [$term]));
        }

        if ($request->filled('city')) {
            $query->where('city', $request->city);
        }

        if ($request->filled('specialization_id')) {
            $query->whereHas('specializations', fn ($q) => $q->where('specializations.id', $request->specialization_id));
        }

        if ($request->filled('specialization')) {
            $query->whereHas('specializations', fn ($q) => $q->where('specializations.name', $request->specialization));
        }

        if ($request->filled('service_id')) {
            $query->whereHas('serviceRates', fn ($q) => $q->available()->where('service_id', $request->service_id));
        }

        if ($request->filled('service')) {
            $term = '%'.mb_strtolower($request->service).'%';
            $query->whereHas('serviceRates', fn ($q) => $q->available()->whereRaw('LOWER(service_name) LIKE ?', [$term]));
        }

        match ($request->get('sort', 'rating')) {
            'newest' => $query->orderBy('created_at', 'desc'),
            'reviews' => $query->orderBy('reviews_count', 'desc')->orderBy('rating', 'desc'),
            'name' => $query->orderBy('name'),
            'price' => $query->orderByRaw('starting_price IS NULL')->orderBy('starting_price'),
            default => $query->orderBy('rating', 'desc')->orderBy('name'),
        };

        $page = $query->paginate($this->perPage($request, 10))->withQueryString();
        $page->setCollection($page->getCollection()->map(fn ($clinic) => (new ClinicSummaryResource($clinic))->resolve()));

        return $this->ok($page);
    }

    /** Full public profile of a listed clinic. */
    public function clinicDetails($id)
    {
        $clinic = Clinic::publiclyListed()
            ->with(['specializations', 'branches' => fn ($q) => $q->where('is_active', true)->with('operatingHours')])
            ->withCount(['reviews' => fn ($q) => $q->where('status', Review::STATUS_APPROVED)])
            ->findOrFail($id);

        $reviews = $clinic->reviews()
            ->where('status', Review::STATUS_APPROVED)
            ->with('patient.user')
            ->latest()
            ->limit(5)
            ->get();

        $ratingBreakdown = $clinic->reviews()
            ->where('status', Review::STATUS_APPROVED)
            ->selectRaw('rating, COUNT(*) as total')
            ->groupBy('rating')
            ->pluck('total', 'rating');

        return $this->ok([
            ...(new ClinicSummaryResource($clinic))->resolve(),
            'branches' => BranchResource::collection($clinic->branches)->resolve(),
            'services' => ServiceRateResource::collection(
                $clinic->serviceRates()->available()->with('service')->orderBy('service_name')->get()
            )->resolve(),
            'dentists' => DentistResource::collection(
                $clinic->dentistProfiles()->with(['user', 'specialization'])->get()
            )->resolve(),
            'reviews' => ReviewResource::collection($reviews)->resolve(),
            'rating_breakdown' => collect(range(5, 1))->mapWithKeys(fn ($r) => [$r => (int) ($ratingBreakdown[$r] ?? 0)]),
        ]);
    }

    public function getSpecializations()
    {
        return $this->ok(
            Specialization::where('is_active', true)->select('id', 'name', 'description', 'icon')->get()
        );
    }

    public function getCities()
    {
        return $this->ok(
            Clinic::publiclyListed()->distinct()->orderBy('city')->pluck('city')->filter()->values()
        );
    }

    /**
     * Catalog services with the published price and duration range across
     * listed clinics that offer them (null when no clinic offers it yet).
     */
    public function getServices()
    {
        $ranges = ServiceRate::available()
            ->whereHas('clinic', fn ($q) => $q->publiclyListed())
            ->selectRaw('service_id, MIN(price) as price_min, MAX(price) as price_max, MIN(duration_minutes) as duration_min, MAX(duration_minutes) as duration_max, COUNT(DISTINCT clinic_id) as clinic_count')
            ->groupBy('service_id')
            ->get()
            ->keyBy('service_id');

        return $this->ok(Service::orderBy('sort_order')->get()->map(function (Service $service) use ($ranges) {
            $range = $ranges->get($service->id);

            return [
                'id' => $service->id,
                'name' => $service->name,
                'slug' => $service->slug,
                'description' => $service->description,
                'category' => $service->category,
                'icon' => $service->icon_name,
                'price_min' => $range ? (float) $range->price_min : null,
                'price_max' => $range ? (float) $range->price_max : null,
                'duration_min' => $range ? (int) $range->duration_min : null,
                'duration_max' => $range ? (int) $range->duration_max : null,
                'clinic_count' => $range ? (int) $range->clinic_count : 0,
            ];
        }));
    }
}
