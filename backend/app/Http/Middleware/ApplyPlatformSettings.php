<?php

namespace App\Http\Middleware;

use App\Support\PlatformSettings;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Runs before the session starts, so the administrator's Session Timeout decides how long an
 * idle web session lasts, and the Platform Name appears in the emails sent.
 */
class ApplyPlatformSettings
{
    public function handle(Request $request, Closure $next): Response
    {
        $settings = PlatformSettings::all();

        config([
            'session.lifetime' => (int) $settings['session_timeout_minutes'],
            'app.name' => $settings['platform_name'],
        ]);

        return $next($request);
    }
}
