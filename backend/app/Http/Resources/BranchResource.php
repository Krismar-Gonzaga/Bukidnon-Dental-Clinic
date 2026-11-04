<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\ClinicBranch */
class BranchResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'address' => $this->address,
            'city' => $this->city,
            'province' => $this->province,
            'contact_number' => $this->contact_number,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'is_main' => $this->is_main,
            'is_active' => $this->is_active,
            'operating_hours' => $this->whenLoaded('operatingHours', fn () => $this->operatingHours->map(fn ($h) => [
                'day_of_week' => $h->day_of_week,
                'opens_at' => substr($h->opens_at, 0, 5),
                'closes_at' => substr($h->closes_at, 0, 5),
            ])),
        ];
    }
}
