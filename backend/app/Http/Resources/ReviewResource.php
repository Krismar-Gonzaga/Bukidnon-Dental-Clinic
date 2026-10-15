<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Reviews show the reviewer as "First L." publicly. Moderation fields are
 * only included for moderators.
 *
 * @mixin \App\Models\Review
 */
class ReviewResource extends JsonResource
{
    public bool $withModeration = false;

    public function moderatorView(): static
    {
        $this->withModeration = true;

        return $this;
    }

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'clinic_id' => $this->clinic_id,
            'clinic_name' => $this->whenLoaded('clinic', fn () => $this->clinic?->name),
            'appointment_id' => $this->appointment_id,
            'rating' => $this->rating,
            'comment' => $this->comment,
            'patient_name' => $this->shortName($this->patient?->display_name),
            'is_verified_visit' => (bool) ($this->is_verified_purchase || $this->appointment_id),
            'status' => $this->status,
            'date' => $this->created_at?->toDateString(),
            'moderation_note' => $this->when($this->withModeration, $this->moderation_note),
            'open_reports' => $this->when($this->withModeration, fn () => $this->reports()->where('status', 'open')->count()),
        ];
    }

    private function shortName(?string $name): string
    {
        if (! $name) {
            return 'Anonymous';
        }

        $parts = preg_split('/\s+/', trim($name));
        $first = array_shift($parts);
        $last = array_pop($parts);

        return $last ? $first.' '.mb_substr($last, 0, 1).'.' : $first;
    }
}
