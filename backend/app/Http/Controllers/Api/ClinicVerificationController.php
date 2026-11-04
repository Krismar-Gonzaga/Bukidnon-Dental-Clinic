<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClinicApplication;
use App\Services\AuditLogger;
use App\Services\ClinicApplicationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/**
 * Older one-step endpoints used by the mobile app. They now run the
 * clinic application workflow: files go to private storage and the
 * application is submitted for review.
 */
class ClinicVerificationController extends Controller
{
    public function __construct(
        private readonly ClinicApplicationService $applications,
        private readonly AuditLogger $audit,
    ) {
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if ($user->role !== 'clinic_admin') {
            throw new AccessDeniedHttpException('Only clinic administrators can submit verification');
        }

        $file = ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'mimetypes:application/pdf,image/jpeg,image/png', 'max:5120'];
        $data = $request->validate([
            'clinic_name' => ['required', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:100'],
            'contact_number' => ['nullable', 'string', 'max:30'],
            'representative_name' => ['nullable', 'string', 'max:255'],
            'business_permit' => $file,
            'doh_license' => $file,
            'prc_id' => $file,
            'bir_registration' => $file,
        ]);

        $hasOpen = ClinicApplication::where('applicant_id', $user->id)
            ->whereIn('status', [ClinicApplication::PENDING, ClinicApplication::UNDER_REVIEW, ClinicApplication::APPROVED])
            ->exists();
        if ($hasOpen) {
            return $this->fail('You already have a pending or verified application', 409);
        }

        $application = DB::transaction(function () use ($data, $user, $request) {
            $application = new ClinicApplication([
                'clinic_name' => $data['clinic_name'],
                'address' => $data['address'] ?? $user->patient?->address,
                'city' => $data['city'] ?? null,
                'contact_number' => $data['contact_number'] ?? null,
                'representative_name' => $data['representative_name'] ?? $user->name,
            ]);
            $application->applicant_id = $user->id;
            $application->status = ClinicApplication::DRAFT;
            $application->save();

            foreach (ClinicApplication::REQUIRED_DOCUMENTS as $type) {
                $this->applications->storeDocument($application, $type, $request->file($type), $user);
            }

            return $application;
        });

        // Address/city may still be missing from this short form; the
        // application then stays a draft for the owner to complete.
        try {
            $this->applications->submit($application);
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException) {
        }

        return $this->ok($this->legacyShape($application->fresh()), 'Verification documents submitted successfully', 201);
    }

    public function status(Request $request)
    {
        $application = ClinicApplication::where('applicant_id', $request->user()->id)->latest()->first();

        if (! $application) {
            return $this->ok(null, 'No verification found');
        }

        return $this->ok($this->legacyShape($application));
    }

    /** Field names the mobile app reads; "verified" maps to approved. */
    private function legacyShape(ClinicApplication $application): array
    {
        return [
            'id' => $application->id,
            'clinic_name' => $application->clinic_name,
            'status' => match ($application->status) {
                ClinicApplication::APPROVED => 'verified',
                ClinicApplication::REJECTED => 'rejected',
                default => 'pending',
            },
            'application_status' => $application->status,
            'rejection_reason' => $application->status === ClinicApplication::REJECTED ? $application->review_notes : null,
            'submitted_at' => $application->submitted_at,
            'verified_at' => $application->status === ClinicApplication::APPROVED ? $application->reviewed_at : null,
        ];
    }
}
