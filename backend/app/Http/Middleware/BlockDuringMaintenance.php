<?php

namespace App\Http\Middleware;

use App\Support\PlatformSettings;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Maintenance Mode: everyone gets a 503 except system administrators, who need the portal to
 * turn it off again. Signing in and out stays open, or nobody could get back in.
 */
class BlockDuringMaintenance
{
    private const ALWAYS_OPEN = ['api/login', 'api/logout', 'api/session', 'api/platform'];

    public function handle(Request $request, Closure $next): Response
    {
        if (! PlatformSettings::get('maintenance_mode') || $request->is(self::ALWAYS_OPEN)) {
            return $next($request);
        }

        if (Auth::guard('sanctum')->user()?->role === 'system_admin') {
            return $next($request);
        }

        return response()->json([
            'success' => false,
            'code' => 'maintenance',
            'message' => PlatformSettings::get('platform_name').' is down for maintenance. Please try again soon.',
        ], 503);
    }
}
