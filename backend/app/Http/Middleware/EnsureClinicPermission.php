<?php

namespace App\Http\Middleware;

use App\Models\Clinic;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Guards clinic-scoped routes that carry a {clinic} parameter.
 *
 * Usage: ->middleware('clinic.permission:appointments.manage')
 *
 * - Not an active member of the clinic → 404, so outsiders cannot even
 *   confirm which clinic ids exist.
 * - Member without the permission → 403.
 *
 * The verified membership is shared as the `clinicMembership` request
 * attribute; controllers must still scope every query to this clinic.
 */
class EnsureClinicPermission
{
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $clinic = $request->route('clinic');
        $clinicId = $clinic instanceof Clinic ? $clinic->getKey() : $clinic;

        $user = $request->user();
        $membership = $user && ctype_digit((string) $clinicId)
            ? $user->activeMembershipFor((int) $clinicId)
            : null;

        if (! $membership) {
            throw new NotFoundHttpException();
        }

        if (! $membership->grants($permission)) {
            throw new AccessDeniedHttpException('You do not have permission to perform this action.');
        }

        $request->attributes->set('clinicMembership', $membership);

        return $next($request);
    }
}
