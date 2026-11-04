<?php

namespace App\Support;

use App\Models\Review;
use Illuminate\Support\Collection;

/**
 * Published ratings per dentist, from reviews of their completed visits.
 * Reviews belong to an appointment, and so to the dentist who treated the
 * patient. One query for any number of dentists.
 */
final class DentistRatings
{
    /** @return Collection<int, object{rating: float, review_count: int}> keyed by dentist id */
    public static function for(Collection $dentistIds): Collection
    {
        if ($dentistIds->isEmpty()) {
            return collect();
        }

        return Review::query()->toBase()
            ->join('appointments', 'appointments.id', '=', 'reviews.appointment_id')
            ->where('reviews.status', Review::STATUS_APPROVED)
            ->whereIn('appointments.dentist_id', $dentistIds)
            ->selectRaw('appointments.dentist_id, AVG(reviews.rating) AS rating, COUNT(*) AS review_count')
            ->groupBy('appointments.dentist_id')
            ->get()
            ->mapWithKeys(fn ($row) => [(int) $row->dentist_id => (object) [
                'rating' => round((float) $row->rating, 1),
                'review_count' => (int) $row->review_count,
            ]]);
    }

    /** The rating fields for one dentist's API response. */
    public static function fields(Collection $ratings, int $dentistId): array
    {
        $rating = $ratings->get($dentistId);

        return ['rating' => $rating?->rating, 'review_count' => $rating?->review_count ?? 0];
    }
}
