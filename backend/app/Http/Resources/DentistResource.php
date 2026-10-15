<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Public dentist profile. Contact details of the dentist's account are not
 * included; clinic staff views add `email` and `schedules`.
 *
 * @mixin \App\Models\Dentist
 */
class DentistResource extends JsonResource
{
    public bool $forStaff = false;

    public function staffView(): static
    {
        $this->forStaff = true;

        return $this;
    }

    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->when($this->forStaff, $this->user_id),
            'name' => $this->user?->name,
            'email' => $this->when($this->forStaff, $this->user?->email),
            'specialization' => $this->specialization?->name,
            'specialization_id' => $this->specialization_id,
            'license_number' => $this->license_number,
            'years_experience' => $this->years_experience,
            'qualifications' => $this->qualifications,
            'bio' => $this->bio,
            'photo' => $this->photo,
            'is_active' => $this->is_active,
            'schedules' => $this->whenLoaded('schedules', fn () => $this->schedules->map(fn ($s) => [
                'branch_id' => $s->branch_id,
                'day_of_week' => $s->day_of_week,
                'starts_at' => substr($s->starts_at, 0, 5),
                'ends_at' => substr($s->ends_at, 0, 5),
            ])),
        ];
    }
}
