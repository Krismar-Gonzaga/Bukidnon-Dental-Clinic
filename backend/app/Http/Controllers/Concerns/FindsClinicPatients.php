<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Clinic;
use App\Models\Patient;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/** Dentists only reach patients who have an appointment with them; anyone else is "not found". */
trait FindsClinicPatients
{
    private function clinicPatient(Request $request, Clinic $clinic, int $patientId): Patient
    {
        $query = $clinic->patients();

        if ($dentist = $this->actingDentist($request)) {
            $query->whereHas('appointments', fn ($q) => $q->where('clinic_id', $clinic->id)->where('dentist_id', $dentist->id));
        }

        return $query->findOrFail($patientId);
    }

    /** Rows tied to a patient, limited to the patients this member may see. */
    private function limitToOwnPatients(Builder $query, Request $request, Clinic $clinic): Builder
    {
        $dentist = $this->actingDentist($request);

        return $query->when($dentist, fn ($q) => $q->whereHas('patient.appointments', fn ($a) => $a
            ->where('clinic_id', $clinic->id)->where('dentist_id', $dentist->id)));
    }
}
