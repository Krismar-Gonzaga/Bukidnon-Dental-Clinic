<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ClinicApplicationResource;
use App\Models\ClinicApplication;
use App\Services\AuditLogger;
use App\Services\ClinicApplicationService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/** A clinic owner's own registration applications. */
class ClinicApplicationController extends Controller
{
    public function __construct(
        private readonly ClinicApplicationService $applications,
        private readonly AuditLogger $audit,
    ) {
    }

    public function index(Request $request)
    {
        return $this->ok(
            ClinicApplication::where('applicant_id', $request->user()->id)
                ->with('documents')->latest()->get()
                ->map(fn ($a) => (new ClinicApplicationResource($a))->resolve())
        );
    }

    public function store(Request $request)
    {
        $this->assertApplicant($request);
        $data = $request->validate($this->rules(required: true));

        $application = new ClinicApplication($data);
        $application->applicant_id = $request->user()->id;
        $application->status = ClinicApplication::DRAFT;
        $application->save();

        $this->audit->record('clinic_application.created', $application);
        $this->applications->announceNewRegistration($application);

        return $this->ok((new ClinicApplicationResource($application->load('documents')))->resolve(), 'Application saved as draft', 201);
    }

    public function show(Request $request, int $id)
    {
        return $this->ok((new ClinicApplicationResource($this->own($request, $id)->load('documents')))->resolve());
    }

    public function update(Request $request, int $id)
    {
        $application = $this->own($request, $id);

        if (! $application->isEditableByApplicant()) {
            return $this->fail('This application can no longer be changed.', 409);
        }

        $application->update($request->validate($this->rules(required: false)));

        return $this->ok((new ClinicApplicationResource($application->load('documents')))->resolve(), 'Application updated');
    }

    /** Upload one document (PDF or image, max 5 MB). */
    public function uploadDocument(Request $request, int $id)
    {
        $application = $this->own($request, $id);

        $data = $request->validate([
            'document_type' => ['required', Rule::in(ClinicApplication::DOCUMENT_TYPES)],
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png', 'mimetypes:application/pdf,image/jpeg,image/png', 'max:5120'],
        ]);

        $this->applications->storeDocument($application, $data['document_type'], $data['file'], $request->user());

        return $this->ok((new ClinicApplicationResource($application->load('documents')))->resolve(), 'Document uploaded', 201);
    }

    public function deleteDocument(Request $request, int $id, int $documentId)
    {
        $application = $this->own($request, $id);
        $document = $application->documents()->findOrFail($documentId);

        $this->applications->deleteDocument($application, $document);

        return $this->ok(message: 'Document removed');
    }

    public function documentLink(Request $request, int $id, int $documentId)
    {
        $document = $this->own($request, $id)->documents()->findOrFail($documentId);

        return $this->ok(['url' => $this->applications->temporaryDownloadUrl($document, $request->user()), 'expires_in' => 300]);
    }

    public function submit(Request $request, int $id)
    {
        $application = $this->applications->submit($this->own($request, $id));

        return $this->ok((new ClinicApplicationResource($application->load('documents')))->resolve(), 'Application submitted for verification');
    }

    private function own(Request $request, int $id): ClinicApplication
    {
        return ClinicApplication::where('applicant_id', $request->user()->id)->findOrFail($id);
    }

    private function assertApplicant(Request $request): void
    {
        if ($request->user()->role !== 'clinic_admin') {
            throw new AccessDeniedHttpException('Register a Clinic Admin account to apply for a clinic listing.');
        }
    }

    private function rules(bool $required): array
    {
        $need = $required ? 'required' : 'sometimes';

        return [
            'clinic_name' => [$need, 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'city' => ['sometimes', 'nullable', 'string', 'max:100'],
            'province' => ['sometimes', 'string', 'max:100'],
            'contact_number' => ['sometimes', 'nullable', 'string', 'max:30'],
            'email' => ['sometimes', 'nullable', 'email', 'max:255'],
            'latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'representative_name' => ['sometimes', 'nullable', 'string', 'max:255'],
            'representative_position' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
