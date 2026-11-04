<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Concerns\FindsClinicPatients;
use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\DentalCertificate;
use App\Models\Dentist;
use App\Models\Patient;
use App\Models\Prescription;
use App\Services\AuditLogger;
use App\Support\BusinessTime;
use App\Support\ClinicalDocument;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rule;

/**
 * Prescriptions and dental certificates. Only a dentist with a licence on file issues them
 * (documents.issue); an issued document is never changed. Printing goes through a 5-minute
 * signed link from this logged request, so the phone's browser can open it without the token.
 */
class ClinicalDocumentController extends Controller
{
    use FindsClinicPatients;

    private const LINK_MINUTES = 5;

    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function prescriptions(Request $request, Clinic $clinic)
    {
        $data = $request->validate(['patient_id' => ['nullable', 'integer']]);
        $dentist = $this->actingDentist($request);

        $page = Prescription::where('clinic_id', $clinic->id)
            ->when($dentist, fn ($q) => $q->where('dentist_id', $dentist->id))
            ->when($data['patient_id'] ?? null, fn ($q, $id) => $q->where('patient_id', $id))
            ->with(['patient.user', 'dentist.user'])
            ->latest()->latest('id')
            ->paginate($this->perPage($request, 30));

        $this->audit->record('records.prescriptions_listed', null, ['count' => count($page->items())], $clinic->id);

        return $this->paginated($page, fn (Prescription $p) => $this->presentPrescription($p));
    }

    public function storePrescription(Request $request, Clinic $clinic)
    {
        $data = $request->validate([
            'patient_id' => ['required', 'integer'],
            'medication' => ['required', 'string', 'max:255'],
            'dosage' => ['required', 'string', 'max:100'],
            'frequency' => ['required', 'string', 'max:100'],
            'duration' => ['required', 'string', 'max:100'],
            'instructions' => ['nullable', 'string', 'max:2000'],
        ]);
        $patient = $this->clinicPatient($request, $clinic, $data['patient_id']);
        $dentist = $this->licensedDentist($request);

        $prescription = new Prescription($data);
        $prescription->clinic_id = $clinic->id;
        $prescription->patient_id = $patient->id;
        $prescription->dentist_id = $dentist->id;
        $prescription->created_by = $request->user()->id;
        $prescription->save();

        // Which patient, not which medicine: the audit log stays free of clinical detail.
        $this->audit->record('records.prescription_issued', $prescription, ['patient_id' => $patient->id], $clinic->id);

        return $this->ok($this->presentPrescription($prescription->load(['patient.user', 'dentist.user'])), 'Prescription saved', 201);
    }

    public function prescriptionPrintLink(Request $request, Clinic $clinic, int $prescriptionId)
    {
        $dentist = $this->actingDentist($request);
        $prescription = Prescription::where('clinic_id', $clinic->id)
            ->when($dentist, fn ($q) => $q->where('dentist_id', $dentist->id))
            ->findOrFail($prescriptionId);

        $this->audit->record('records.prescription_printed', $prescription, ['patient_id' => $prescription->patient_id], $clinic->id);

        return $this->ok(['url' => URL::temporarySignedRoute('prescriptions.print', now()->addMinutes(self::LINK_MINUTES), ['prescription' => $prescription->id], absolute: false)]);
    }

    /** What the certificate will say. Nothing is issued until it is printed. */
    public function previewCertificate(Request $request, Clinic $clinic)
    {
        $data = $this->validateCertificate($request);
        $patient = $this->clinicPatient($request, $clinic, $data['patient_id']);

        return $this->ok(ClinicalDocument::certificate($clinic, $patient, $this->actingDentist($request), $data['type'], $data['purpose'], now()));
    }

    public function issueCertificate(Request $request, Clinic $clinic)
    {
        $data = $this->validateCertificate($request);
        $patient = $this->clinicPatient($request, $clinic, $data['patient_id']);
        $dentist = $this->licensedDentist($request);

        $certificate = new DentalCertificate($data);
        $certificate->clinic_id = $clinic->id;
        $certificate->patient_id = $patient->id;
        $certificate->dentist_id = $dentist->id;
        $certificate->created_by = $request->user()->id;
        $certificate->save();

        $this->audit->record('records.certificate_issued', $certificate, ['patient_id' => $patient->id, 'type' => $certificate->type], $clinic->id);

        return $this->ok([
            'id' => $certificate->id,
            'url' => URL::temporarySignedRoute('certificates.print', now()->addMinutes(self::LINK_MINUTES), ['certificate' => $certificate->id], absolute: false),
        ], 'Certificate issued', 201);
    }

    private function validateCertificate(Request $request): array
    {
        return $request->validate([
            'patient_id' => ['required', 'integer'],
            'type' => ['required', Rule::in(DentalCertificate::TYPES)],
            'purpose' => ['required', 'string', 'max:2000'],
        ]);
    }

    /** A document without a licence number is worthless, so it is refused up front. */
    private function licensedDentist(Request $request): Dentist
    {
        $dentist = $this->actingDentist($request);
        if (! $dentist?->license_number) {
            abort(response()->json([
                'success' => false,
                'message' => 'Your PRC licence number is not on file. Ask your clinic administrator to add it first.',
            ], 422));
        }

        return $dentist;
    }

    private function presentPrescription(Prescription $p): array
    {
        return [
            'id' => $p->id,
            'patient' => ['id' => $p->patient_id, 'name' => $p->patient?->display_name],
            'dentist' => $p->dentist?->user?->name,
            'medication' => $p->medication,
            'dosage' => $p->dosage,
            'frequency' => $p->frequency,
            'duration' => $p->duration,
            'instructions' => $p->instructions,
            'status' => 'issued',
            'issued_at' => BusinessTime::iso($p->created_at),
        ];
    }
}
