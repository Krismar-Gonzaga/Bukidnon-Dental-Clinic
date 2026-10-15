<?php

namespace App\Http\Resources;

use App\Models\Appointment;
use App\Support\BusinessTime;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Times are ISO 8601 in the business timezone. appointment_date and
 * appointment_time (HH:MM, local) are kept for older clients.
 * Patient contact details are only included in the clinic staff view.
 *
 * @mixin Appointment
 */
class AppointmentResource extends JsonResource
{
    public bool $forClinic = false;

    public function clinicView(): static
    {
        $this->forClinic = true;

        return $this;
    }

    public function toArray(Request $request): array
    {
        $start = $this->starts_at ? BusinessTime::local($this->starts_at) : null;

        return [
            'id' => $this->id,
            'status' => $this->status,
            'starts_at' => BusinessTime::iso($this->starts_at),
            'ends_at' => BusinessTime::iso($this->ends_at),
            'appointment_date' => $start?->toDateString() ?? $this->appointment_date?->toDateString(),
            'appointment_time' => $start?->format('H:i') ?? ($this->appointment_time ? substr($this->appointment_time, 0, 5) : null),
            'reason' => $this->reason,
            'notes' => $this->notes,
            'cancellation_reason' => $this->cancellation_reason,
            'requested_starts_at' => BusinessTime::iso($this->requested_starts_at),
            'clinic' => $this->whenLoaded('clinic', fn () => [
                'id' => $this->clinic->id,
                'name' => $this->clinic->name,
                'address' => $this->clinic->full_address,
                'contact_number' => $this->clinic->contact_number,
            ]),
            'branch' => $this->whenLoaded('branch', fn () => $this->branch ? [
                'id' => $this->branch->id,
                'name' => $this->branch->name,
                'address' => $this->branch->address.', '.$this->branch->city,
                'latitude' => $this->branch->latitude,
                'longitude' => $this->branch->longitude,
            ] : null),
            'dentist' => $this->whenLoaded('dentist', fn () => $this->dentist ? [
                'id' => $this->dentist->id,
                'name' => $this->dentist->user?->name,
            ] : null),
            'service' => $this->whenLoaded('serviceRate', fn () => $this->serviceRate ? [
                'id' => $this->serviceRate->id,
                'name' => $this->serviceRate->service_name,
                'price' => $this->serviceRate->price,
                'currency' => $this->serviceRate->currency,
                'duration_minutes' => $this->serviceRate->duration_minutes,
            ] : null),
            'patient' => $this->when($this->forClinic, fn () => [
                'id' => $this->patient_id,
                'name' => $this->patient_name,
                'email' => $this->patient_email,
                'phone' => $this->patient_phone,
            ]),
            'has_review' => $this->whenLoaded('review', fn () => $this->review !== null),
            'status_history' => $this->whenLoaded('statusHistory', fn () => $this->statusHistory->map(fn ($h) => [
                'from' => $h->from_status,
                'to' => $h->to_status,
                'reason' => $h->reason,
                'at' => BusinessTime::iso($h->created_at),
            ])),
            'created_at' => BusinessTime::iso($this->created_at),
        ];
    }
}
