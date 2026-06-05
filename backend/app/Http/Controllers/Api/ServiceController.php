<?php

namespace App\Http\Controllers\Api;

use App\Models\Service;
use App\Models\ServiceRate;
use App\Http\Controllers\Controller;

class ServiceController extends Controller
{
    /**
     * Get popular services
     */
    public function popular()
    {
        $services = Service::popular()->get();
        
        // Transform to match mobile app expected format
        $transformed = $services->map(function($service) {
            return [
                'id' => $service->id,
                'title' => $service->name,
                'icon' => $service->icon_name,
                'color' => $service->color,
                'description' => $service->description
            ];
        });
        
        return response()->json([
            'success' => true,
            'data' => $transformed
        ]);
    }
    
    /**
     * Get all services
     */
    public function index()
    {
        $services = Service::orderBy('sort_order')->get();
        
        return response()->json([
            'success' => true,
            'data' => $services
        ]);
    }
    
    /**
     * Get service rates
     */
    public function rates()
    {
        $rates = ServiceRate::with(['clinic', 'service'])
            ->where('is_available', true)
            ->take(10)
            ->get();
        
        // Transform to match mobile app expected format
        $transformed = $rates->map(function($rate) {
            return [
                'id' => $rate->id,
                'title' => $rate->service_name,
                'desc' => $rate->description,
                'price' => '₱' . number_format($rate->price, 2),
                'color' => $rate->service->color ?? '#003f87',
                'clinic' => $rate->clinic->name ?? null
            ];
        });
        
        return response()->json([
            'success' => true,
            'data' => $transformed
        ]);
    }
    
    /**
     * Get rates by clinic
     */
    public function clinicRates($clinicId)
    {
        $rates = ServiceRate::with('service')
            ->where('clinic_id', $clinicId)
            ->where('is_available', true)
            ->get();
        
        return response()->json([
            'success' => true,
            'data' => $rates
        ]);
    }
}