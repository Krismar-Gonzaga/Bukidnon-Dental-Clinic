<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Directory listing entry. Keeps the field names older clients use
 * (address, city, rating, image, is_verified, specializations) and adds
 * map coordinates and a starting price.
 *
 * @mixin \App\Models\Clinic
 */
class ClinicSummaryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'description' => $this->description,
            'address' => $this->address,
            'full_address' => $this->full_address,
            'city' => $this->city,
            'province' => $this->province,
            'contact_number' => $this->contact_number,
            'email' => $this->email,
            'image' => $this->image,
            'rating' => $this->rating_stars,
            'review_count' => $this->whenCounted('reviews'),
            'is_verified' => $this->is_verified,
            'is_featured' => $this->is_featured,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'opening_time' => $this->opening_time ? substr($this->opening_time, 0, 5) : null,
            'closing_time' => $this->closing_time ? substr($this->closing_time, 0, 5) : null,
            'starting_price' => $this->when(isset($this->starting_price), fn () => $this->starting_price !== null ? (float) $this->starting_price : null),
            'specializations' => $this->whenLoaded('specializations', fn () => $this->specializations->map(fn ($s) => [
                'id' => $s->id,
                'name' => $s->name,
            ])),
        ];
    }
}
