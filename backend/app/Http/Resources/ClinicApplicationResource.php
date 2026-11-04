<?php

namespace App\Http\Resources;

use App\Support\BusinessTime;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** File paths are never included; documents are fetched via signed links. @mixin \App\Models\ClinicApplication */
class ClinicApplicationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'clinic_name' => $this->clinic_name,
            'description' => $this->description,
            'address' => $this->address,
            'city' => $this->city,
            'province' => $this->province,
            'contact_number' => $this->contact_number,
            'email' => $this->email,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'representative_name' => $this->representative_name,
            'representative_position' => $this->representative_position,
            'review_notes' => $this->review_notes,
            'clinic_id' => $this->clinic_id,
            'applicant' => $this->whenLoaded('applicant', fn () => [
                'id' => $this->applicant->id,
                'name' => $this->applicant->name,
                'email' => $this->applicant->email,
            ]),
            'documents' => $this->whenLoaded('documents', fn () => $this->documents->map(fn ($d) => [
                'id' => $d->id,
                'document_type' => $d->document_type,
                'original_name' => $d->original_name,
                'mime_type' => $d->mime_type,
                'size' => $d->size,
                'uploaded_at' => BusinessTime::iso($d->created_at),
            ])),
            'missing_documents' => $this->missingDocuments(),
            'documents_requested' => $this->documents_requested_at !== null,
            'submitted_at' => BusinessTime::iso($this->submitted_at),
            'reviewed_at' => BusinessTime::iso($this->reviewed_at),
            'created_at' => BusinessTime::iso($this->created_at),
        ];
    }
}
