<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\ServiceRate */
class ServiceRateResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'service_id' => $this->service_id,
            'category' => $this->whenLoaded('service', fn () => $this->service?->name),
            'name' => $this->service_name,
            'description' => $this->description,
            'price' => $this->price,
            'currency' => $this->currency,
            'duration_minutes' => $this->duration_minutes,
            'is_available' => $this->is_available,
        ];
    }
}
