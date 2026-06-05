<?php
namespace App\Http\Controllers\Api;

use App\Models\Clinic;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class ClinicController extends Controller
{
    /**
     * Get all clinics
     */
    public function index(Request $request)
    {
        $query = Clinic::query()->verified();
        
        // Filter by city/location
        if ($request->has('city')) {
            $query->where('city', 'like', '%' . $request->city . '%');
        }
        
        // Filter by province
        if ($request->has('province')) {
            $query->where('province', $request->province);
        }
        
        $clinics = $query->paginate(20);
        
        return response()->json([
            'success' => true,
            'data' => $clinics->items(),
            'meta' => [
                'current_page' => $clinics->currentPage(),
                'total' => $clinics->total(),
                'per_page' => $clinics->perPage()
            ]
        ]);
    }
    
    /**
     * Get featured clinics
     */
    public function featured()
    {
        $clinics = Clinic::featured()->verified()->take(10)->get();
        
        return response()->json([
            'success' => true,
            'data' => $clinics
        ]);
    }
    
    /**
     * Search clinics
     */
    public function search(Request $request)
    {
        $request->validate([
            'q' => 'nullable|string|min:2',
            'location' => 'nullable|string'
        ]);
        
        $query = Clinic::query()->verified();
        
        if ($request->has('q') && !empty($request->q)) {
            $searchTerm = $request->q;
            $query->where(function($q) use ($searchTerm) {
                $q->where('name', 'like', "%{$searchTerm}%")
                  ->orWhere('description', 'like', "%{$searchTerm}%");
            });
        }
        
        if ($request->has('location') && !empty($request->location)) {
            $query->where(function($q) use ($request) {
                $q->where('city', 'like', "%{$request->location}%")
                  ->orWhere('address', 'like', "%{$request->location}%");
            });
        }
        
        $clinics = $query->take(20)->get();
        
        return response()->json([
            'success' => true,
            'data' => $clinics,
            'search_params' => $request->only(['q', 'location'])
        ]);
    }
    
    /**
     * Get single clinic details
     */
    public function show($id)
    {
        $clinic = Clinic::with(['serviceRates', 'serviceRates.service'])->findOrFail($id);
        
        return response()->json([
            'success' => true,
            'data' => $clinic
        ]);
    }
}