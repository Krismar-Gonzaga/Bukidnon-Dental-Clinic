<?php

namespace App\Http\Controllers;

use App\Models\ClinicMembership;
use App\Models\Dentist;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

abstract class Controller
{
    /**
     * Standard success envelope used by the web and mobile clients:
     * { success: true, message?, data, meta? }
     */
    protected function ok(mixed $data = null, ?string $message = null, int $status = 200, array $meta = []): JsonResponse
    {
        return response()->json(array_filter([
            'success' => true,
            'message' => $message,
            'data' => $data,
            'meta' => $meta ?: null,
        ], fn ($value) => $value !== null), $status);
    }

    /** Standard error envelope: { success: false, message, errors? } */
    protected function fail(string $message, int $status, ?array $errors = null): JsonResponse
    {
        return response()->json(array_filter([
            'success' => false,
            'message' => $message,
            'errors' => $errors,
        ], fn ($value) => $value !== null), $status);
    }

    /** A page of results: data is the mapped items, meta has pagination. */
    protected function paginated(LengthAwarePaginator $page, callable $map, ?string $message = null): JsonResponse
    {
        return $this->ok(
            collect($page->items())->map($map)->values(),
            $message,
            meta: [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
            ]
        );
    }

    protected function perPage(Request $request, int $default = 15): int
    {
        return min(max((int) $request->query('per_page', $default), 1), 100);
    }

    /** Membership verified by the clinic.permission middleware. */
    protected function membership(Request $request): ClinicMembership
    {
        return $request->attributes->get('clinicMembership');
    }

    /**
     * When the member is a dentist, their dentist profile: dentist-scoped
     * views (assigned appointments, their patients) filter by it.
     */
    protected function actingDentist(Request $request): ?Dentist
    {
        $membership = $this->membership($request);

        return $membership->role === ClinicMembership::ROLE_DENTIST
            ? Dentist::firstWhere('user_id', $membership->user_id)
            : null;
    }
}
