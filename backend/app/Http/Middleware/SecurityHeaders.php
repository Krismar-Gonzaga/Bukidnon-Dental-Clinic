<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Baseline headers for API responses. Responses can carry patient and
 * clinic data, so they are never cached by browsers or shared proxies,
 * and they are not meant to be framed or content-sniffed.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $headers = $response->headers;
        $headers->set('X-Content-Type-Options', 'nosniff');
        $headers->set('X-Frame-Options', 'DENY');
        $headers->set('Referrer-Policy', 'no-referrer');

        if (! $headers->has('Cache-Control') || ! str_contains((string) $headers->get('Cache-Control'), 'no-store')) {
            $headers->set('Cache-Control', 'no-store, private');
        }

        // Only meaningful over HTTPS; browsers ignore it on plain HTTP.
        if ($request->isSecure()) {
            $headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }
}
