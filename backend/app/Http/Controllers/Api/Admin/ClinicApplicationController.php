<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ClinicApplicationResource;
use App\Models\ClinicApplication;
use App\Services\ClinicApplicationService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Clinic verification queue (system administrators). */
class ClinicApplicationController extends Controller
{
    public function __construct(private readonly ClinicApplicationService $applications)
    {
    }

    public function index(Request $request)
    {
        $request->validate(['status' => ['nullable', Rule::in([
            ClinicApplication::PENDING, ClinicApplication::UNDER_REVIEW, ClinicApplication::APPROVED, ClinicApplication::REJECTED,
        ])]]);

        // Drafts are private to the applicant until submitted.
        $page = ClinicApplication::where('status', '!=', ClinicApplication::DRAFT)
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->with(['applicant', 'documents'])
            ->orderByRaw("CASE status WHEN 'pending' THEN 0 WHEN 'under_review' THEN 1 ELSE 2 END")
            ->orderBy('submitted_at')
            ->paginate($this->perPage($request, 20));

        return $this->paginated($page, fn ($a) => (new ClinicApplicationResource($a))->resolve());
    }

    public function show(int $id)
    {
        return $this->ok((new ClinicApplicationResource($this->find($id)->load(['applicant', 'documents'])))->resolve());
    }

    public function startReview(Request $request, int $id)
    {
        $application = $this->applications->startReview($this->find($id), $request->user());

        return $this->ok((new ClinicApplicationResource($application->load(['applicant', 'documents'])))->resolve(), 'Review started');
    }

    public function approve(Request $request, int $id)
    {
        $data = $request->validate(['notes' => ['nullable', 'string', 'max:2000']]);
        $application = $this->applications->approve($this->find($id), $request->user(), $data['notes'] ?? null);

        return $this->ok((new ClinicApplicationResource($application->load(['applicant', 'documents'])))->resolve(), 'Clinic approved');
    }

    /** Reject or request corrections; the applicant can fix and resubmit. */
    public function reject(Request $request, int $id)
    {
        $data = $request->validate(['notes' => ['required', 'string', 'max:2000']]);
        $application = $this->applications->reject($this->find($id), $request->user(), $data['notes']);

        return $this->ok((new ClinicApplicationResource($application->load(['applicant', 'documents'])))->resolve(), 'Application returned to the applicant');
    }

    public function documentLink(Request $request, int $id, int $documentId)
    {
        $document = $this->find($id)->documents()->findOrFail($documentId);

        return $this->ok(['url' => $this->applications->temporaryDownloadUrl($document, $request->user()), 'expires_in' => 300]);
    }

    private function find(int $id): ClinicApplication
    {
        return ClinicApplication::where('status', '!=', ClinicApplication::DRAFT)->findOrFail($id);
    }
}
