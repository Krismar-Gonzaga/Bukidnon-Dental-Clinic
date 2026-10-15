<?php

namespace App\Http\Resources;

use App\Support\BusinessTime;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\PatientRecord */
class PatientRecordResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'patient_id' => $this->patient_id,
            'appointment_id' => $this->appointment_id,
            'record_type' => $this->record_type,
            'chief_complaint' => $this->chief_complaint,
            'findings' => $this->findings,
            'procedures' => $this->procedures,
            'tooth_numbers' => $this->tooth_numbers,
            'notes' => $this->notes,
            'care_instructions' => $this->care_instructions,
            'is_patient_visible' => $this->is_patient_visible,
            'dentist' => $this->dentist?->user?->name,
            'author' => $this->author?->name,
            'amends_record_id' => $this->amends_record_id,
            'amendment_reason' => $this->amendment_reason,
            'superseded_at' => BusinessTime::iso($this->superseded_at),
            'created_at' => BusinessTime::iso($this->created_at),
        ];
    }
}
