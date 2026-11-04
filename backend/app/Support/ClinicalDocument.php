<?php

namespace App\Support;

use App\Models\Clinic;
use App\Models\Dentist;
use App\Models\Patient;
use Carbon\CarbonInterface;

/** The wording of a certificate, in one place: the preview and the printed page must agree. */
class ClinicalDocument
{
    private const TITLES = [
        'medical' => 'Medical Certificate',
        'clearance' => 'Dental Clearance',
        'treatment' => 'Treatment Certificate',
    ];

    private const STATEMENTS = [
        'medical' => 'was examined at this clinic for the following:',
        'clearance' => 'is cleared for the following activity or procedure:',
        'treatment' => 'has undergone the following dental treatment:',
    ];

    public static function certificate(Clinic $clinic, Patient $patient, ?Dentist $dentist, string $type, string $purpose, CarbonInterface $issuedAt): array
    {
        $dentist?->loadMissing(['user', 'specialization']);

        return [
            'type' => $type,
            'title' => self::TITLES[$type],
            'clinic' => ['name' => $clinic->name, 'address' => $clinic->full_address],
            'patient' => ['name' => $patient->display_name, 'description' => self::describe($patient)],
            'statement' => self::STATEMENTS[$type],
            'purpose' => $purpose,
            'dentist' => [
                'name' => $dentist?->user?->name,
                'specialization' => $dentist?->specialization?->name,
                'license_number' => $dentist?->license_number,
            ],
            'issued_at' => BusinessTime::iso($issuedAt),
        ];
    }

    /** "24 years of age, female", leaving out what is not on file. */
    public static function describe(Patient $patient): ?string
    {
        $parts = array_filter([
            $patient->birth_date ? "{$patient->birth_date->age} years of age" : null,
            $patient->gender,
        ]);

        return $parts ? implode(', ', $parts) : null;
    }
}
