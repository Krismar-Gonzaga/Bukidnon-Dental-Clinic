<?php

namespace App\Http\Controllers\API;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\Specialization;
use App\Models\Service;
use App\Models\Review;
use Illuminate\Http\Request;

class HomeController extends Controller
{
    /**
     * Get home page data
     */
    public function index(Request $request)
    {
        $featuredClinics = Clinic::with(['specializations', 'branches'])
            ->where('is_active', true)
            ->whereNotNull('verified_at')
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
                    'review_count' => $clinic->review_count ?? 0,
                    'logo' => $clinic->logo,
                    'specializations' => $clinic->specializations->pluck('name')->take(2),
                    'is_verified' => $clinic->is_verified
                ];
            });

        $specializations = Specialization::where('is_active', true)
            ->get()
            ->map(function ($spec) {
                return [
                    'id' => $spec->id,
                    'name' => $spec->name,
                    'description' => $spec->description,
                    'icon' => $spec->icon
                ];
            });

        $popularServices = Service::with('clinic')
            ->where('is_active', true)
            ->orderBy('id', 'desc')
            ->limit(6)
            ->get()
            ->map(function ($service) {
                return [
                    'id' => $service->id,
                    'name' => $service->name,
                    'description' => $service->description,
                    'price_range' => $service->price_range,
                    'clinic_name' => $service->clinic->name ?? null
                ];
            });

        $recentReviews = Review::with(['clinic', 'patient'])
            ->where('status', 'approved')
            ->orderBy('created_at', 'desc')
            ->limit(6)
            ->get()
            ->map(function ($review) {
                return [
                    'id' => $review->id,
                    'patient_name' => $review->patient->name ?? 'Anonymous',
                    'clinic_name' => $review->clinic->name ?? null,
                    'rating' => $review->rating,
                    'comment' => $review->comment,
                    'date' => $review->created_at->diffForHumans()
                ];
            });

        $stats = [
            'verified_clinics' => Clinic::whereNotNull('verified_at')->count(),
            'total_reviews' => Review::where('status', 'approved')->count(),
            'total_specializations' => Specialization::where('is_active', true)->count()
        ];

        return response()->json([
            'success' => true,
            'data' => [
                'featured_clinics' => $featuredClinics,
                'specializations' => $specializations,
                'popular_services' => $popularServices,
                'recent_reviews' => $recentReviews,
                'stats' => $stats,
                'meta' => [
                    'page_title' => 'Find Trusted Dental Clinics Across Bukidnon',
                    'page_description' => 'Search clinics, compare services, view dentists by specialization, and book appointments online with the most reliable dental network in the province.'
                ]
            ]
        ]);
    }

    /**
     * Search clinics
     */
    public function searchClinics(Request $request)
    {
        $query = Clinic::with(['specializations', 'branches'])
            ->where('is_active', true)
            ->whereNotNull('verified_at');

        // Search by name
        if ($request->has('search')) {
            $query->where('name', 'LIKE', '%' . $request->search . '%')
                ->orWhere('city', 'LIKE', '%' . $request->search . '%');
        }

        // Filter by city
        if ($request->has('city')) {
            $query->where('city', $request->city);
        }

        // Filter by specialization
        if ($request->has('specialization_id')) {
            $query->whereHas('specializations', function ($q) use ($request) {
                $q->where('specialization_id', $request->specialization_id);
            });
        }

        // Sort by rating or distance
        $sort = $request->get('sort', 'rating');
        if ($sort === 'rating') {
            $query->orderBy('rating', 'desc');
        } else if ($sort === 'newest') {
            $query->orderBy('created_at', 'desc');
        }

        $clinics = $query->paginate(10);

        return response()->json([
            'success' => true,
            'data' => $clinics
        ]);
    }

    /**
     * Get clinic details
     */
    public function clinicDetails($id)
    {
        $clinic = Clinic::with([
            'branches',
            'dentists',
            'services',
            'specializations',
            'reviews' => function ($q) {
                $q->where('status', 'approved')->limit(5);
            }
        ])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $clinic
        ]);
    }

    /**
     * Get all specializations
     */
    public function getSpecializations()
    {
        $specializations = Specialization::where('is_active', true)
            ->select('id', 'name', 'description', 'icon')
            ->get();
        
        return response()->json([
            'success' => true,
            'data' => $specializations
        ]);
    }

    /**
     * Get all cities with clinics
     */
    public function getCities()
    {
        $cities = Clinic::where('is_active', true)
            ->whereNotNull('verified_at')
            ->distinct()
            ->pluck('city')
            ->filter()
            ->values();
        
        return response()->json([
            'success' => true,
            'data' => $cities
        ]);
    }
}