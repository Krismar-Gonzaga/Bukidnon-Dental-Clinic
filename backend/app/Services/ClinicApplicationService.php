<?php

namespace App\Services;

use App\Models\Clinic;
use App\Models\ClinicApplication;
use App\Models\ClinicBranch;
use App\Models\ClinicMembership;
use App\Models\User;
use App\Models\VerificationDocument;
use App\Notifications\ClinicApplicationDecided;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class ClinicApplicationService
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function storeDocument(ClinicApplication $application, string $type, UploadedFile $file, User $uploader): VerificationDocument
    {
        $this->assertEditable($application);

        // One current file per required type: replace any earlier upload.
        if ($type !== 'other') {
            $application->documents()->where('document_type', $type)->get()
                ->each(fn (VerificationDocument $old) => $this->deleteDocument($application, $old));
        }

        $path = $file->storeAs(
            "clinic-applications/{$application->id}",
            Str::uuid().'.'.$file->extension(),
            VerificationDocument::DISK
        );

        $document = new VerificationDocument;
        $document->clinic_application_id = $application->id;
        $document->document_type = $type;
        $document->path = $path;
        $document->original_name = Str::limit($file->getClientOriginalName(), 250, '');
        $document->mime_type = $file->getMimeType();
        $document->size = $file->getSize();
        $document->uploaded_by = $uploader->id;
        $document->save();

        $this->audit->record('clinic_application.document_uploaded', $application, ['type' => $type]);

        return $document;
    }

    public function deleteDocument(ClinicApplication $application, VerificationDocument $document): void
    {
        $this->assertEditable($application);
        Storage::disk(VerificationDocument::DISK)->delete($document->path);
        $document->delete();
    }

    public function submit(ClinicApplication $application): ClinicApplication
    {
        $this->assertEditable($application);

        foreach (['address', 'city', 'contact_number', 'representative_name'] as $field) {
            if (blank($application->{$field})) {
                throw new UnprocessableEntityHttpException("Please complete the {$this->label($field)} before submitting.");
            }
        }

        if ($missing = $application->missingDocuments()) {
            throw new UnprocessableEntityHttpException('Missing documents: '.implode(', ', array_map([$this, 'label'], $missing)).'.');
        }

        $application->status = ClinicApplication::PENDING;
        $application->submitted_at = now();
        $application->save();

        $this->audit->record('clinic_application.submitted', $application);

        return $application;
    }

    public function startReview(ClinicApplication $application, User $admin): ClinicApplication
    {
        if ($application->status !== ClinicApplication::PENDING) {
            throw new ConflictHttpException('Only pending applications can be taken for review.');
        }

        $application->status = ClinicApplication::UNDER_REVIEW;
        $application->reviewed_by = $admin->id;
        $application->save();

        $this->audit->record('clinic_application.review_started', $application, actor: $admin);

        return $application;
    }

    /** Creates the clinic, its main branch and the owner's admin membership. */
    public function approve(ClinicApplication $application, User $admin, ?string $notes): ClinicApplication
    {
        if (! in_array($application->status, [ClinicApplication::PENDING, ClinicApplication::UNDER_REVIEW], true)) {
            throw new ConflictHttpException('Only submitted applications can be approved.');
        }

        DB::transaction(function () use ($application, $admin, $notes) {
            $clinic = new Clinic([
                'name' => $application->clinic_name,
                'slug' => Str::slug($application->clinic_name).'-'.Str::lower(Str::random(6)),
                'description' => $application->description,
                'address' => $application->address,
                'city' => $application->city,
                'province' => $application->province,
                'contact_number' => $application->contact_number,
                'email' => $application->email,
                'latitude' => $application->latitude,
                'longitude' => $application->longitude,
            ]);
            $clinic->status = Clinic::STATUS_APPROVED;
            $clinic->is_verified = true;
            // Listed once the owner adds services and publishes the profile.
            $clinic->is_published = false;
            $clinic->owner_id = $application->applicant_id;
            $clinic->save();

            $branch = new ClinicBranch([
                'name' => 'Main Branch',
                'address' => $application->address,
                'city' => $application->city,
                'province' => $application->province,
                'contact_number' => $application->contact_number,
                'latitude' => $application->latitude,
                'longitude' => $application->longitude,
            ]);
            $branch->clinic_id = $clinic->id;
            $branch->is_main = true;
            $branch->save();

            $membership = ClinicMembership::firstOrNew(['clinic_id' => $clinic->id, 'user_id' => $application->applicant_id]);
            $membership->clinic_id = $clinic->id;
            $membership->user_id = $application->applicant_id;
            $membership->role = ClinicMembership::ROLE_CLINIC_ADMIN;
            $membership->status = ClinicMembership::STATUS_ACTIVE;
            $membership->save();

            $application->status = ClinicApplication::APPROVED;
            $application->clinic_id = $clinic->id;
            $application->review_notes = $notes;
            $application->reviewed_by = $admin->id;
            $application->reviewed_at = now();
            $application->save();
        });

        $this->audit->record('clinic_application.approved', $application, ['clinic_id' => $application->clinic_id], $application->clinic_id, $admin);
        $application->applicant->notify(new ClinicApplicationDecided($application));

        return $application;
    }

    public function reject(ClinicApplication $application, User $admin, string $notes): ClinicApplication
    {
        if (! in_array($application->status, [ClinicApplication::PENDING, ClinicApplication::UNDER_REVIEW], true)) {
            throw new ConflictHttpException('Only submitted applications can be rejected.');
        }

        $application->status = ClinicApplication::REJECTED;
        $application->review_notes = $notes;
        $application->reviewed_by = $admin->id;
        $application->reviewed_at = now();
        $application->save();

        $this->audit->record('clinic_application.rejected', $application, actor: $admin);
        $application->applicant->notify(new ClinicApplicationDecided($application));

        return $application;
    }

    /**
     * Relative signed URL valid for 5 minutes; prefix with the API origin.
     * `download` (part of the signature) saves the file instead of opening it.
     */
    public function temporaryDownloadUrl(VerificationDocument $document, User $viewer, bool $download = false): string
    {
        $this->audit->record('clinic_application.document_accessed', $document->application, array_filter([
            'document_id' => $document->id,
            'download' => $download ?: null,
        ]), actor: $viewer);

        $parameters = ['document' => $document->id] + ($download ? ['download' => 1] : []);

        return URL::temporarySignedRoute('documents.download', now()->addMinutes(5), $parameters, absolute: false);
    }

    private function assertEditable(ClinicApplication $application): void
    {
        if (! $application->isEditableByApplicant()) {
            throw new ConflictHttpException('This application can no longer be changed.');
        }
    }

    private function label(string $field): string
    {
        return str_replace('_', ' ', $field);
    }
}
