<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DentalCertificate;
use App\Models\PatientFile;
use App\Models\Prescription;
use App\Models\SubscriptionPayment;
use App\Support\BusinessTime;
use App\Support\ClinicalDocument;
use App\Support\SubscriptionInvoice;
use Illuminate\Support\Facades\Storage;

/**
 * Files the mobile app opens in the phone's browser, which cannot send the app's token.
 * Reachable only through a 5-minute signed link from an authorized, logged request
 * (route middleware: signed:relative).
 */
class SignedFileController extends Controller
{
    public function patientFile(PatientFile $file)
    {
        abort_unless(Storage::disk(PatientFile::DISK)->exists($file->path), 404);

        return Storage::disk(PatientFile::DISK)->download($file->path, $file->name, [
            'Content-Type' => $file->mime_type,
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function paymentProof(SubscriptionPayment $payment)
    {
        abort_unless(Storage::disk(SubscriptionPayment::DISK)->exists($payment->proof_path), 404);

        return Storage::disk(SubscriptionPayment::DISK)->response($payment->proof_path, headers: [
            'Content-Type' => $payment->proof_mime_type,
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function prescription(Prescription $prescription)
    {
        $prescription->load(['clinic', 'patient.user', 'dentist.user', 'dentist.specialization']);

        return response()->view('print.prescription', [
            'prescription' => $prescription,
            'description' => $prescription->patient ? ClinicalDocument::describe($prescription->patient) : null,
            'issuedOn' => BusinessTime::local($prescription->created_at)->format('F j, Y'),
        ]);
    }

    public function certificate(DentalCertificate $certificate)
    {
        $certificate->load(['clinic', 'patient.user', 'dentist.user', 'dentist.specialization']);

        return response()->view('print.certificate', [
            'document' => ClinicalDocument::certificate($certificate->clinic, $certificate->patient, $certificate->dentist, $certificate->type, (string) $certificate->purpose, $certificate->created_at),
        ]);
    }

    public function invoice(SubscriptionPayment $payment)
    {
        abort_unless($payment->status === SubscriptionPayment::VERIFIED, 404);

        return SubscriptionInvoice::response($payment);
    }
}
