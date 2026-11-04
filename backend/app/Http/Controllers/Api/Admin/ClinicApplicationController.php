<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ClinicApplicationResource;
use App\Models\AuditLog;
use App\Models\ClinicApplication;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\ClinicApplicationService;
use App\Support\BusinessTime;
use App\Support\CsvExport;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Clinic verification queue (system administrators). */
class ClinicApplicationController extends Controller
{
    /** Audit events shown in an application's review history. */
    private const HISTORY_ACTIONS = [
        'clinic_application.submitted',
        'clinic_application.document_uploaded',
        'clinic_application.review_started',
        'clinic_application.document_accessed',
        'clinic_application.note_added',
        'clinic_application.approved',
        'clinic_application.rejected',
        'clinic_application.documents_requested',
    ];

    public function __construct(
        private readonly ClinicApplicationService $applications,
        private readonly AuditLogger $audit,
    ) {
    }

    /** Open registrations waiting this long, or missing a required document, need attention. */
    public const ATTENTION_DAYS = 3;

    private const OPEN = [ClinicApplication::PENDING, ClinicApplication::UNDER_REVIEW];

    public function index(Request $request)
    {
        $page = $this->filtered($request)
            ->with(['applicant', 'documents', 'clinic:id,status'])
            ->orderByRaw("CASE status WHEN 'pending' THEN 0 WHEN 'under_review' THEN 1 ELSE 2 END")
            ->orderBy('submitted_at')
            ->paginate($this->perPage($request, 20));

        return $this->paginated($page, fn (ClinicApplication $a) => $this->row($a));
    }

    /**
     * The four cards on the Verification page. One query for the counts and
     * one for the decision times of the last 30 days.
     */
    public function summary()
    {
        $now = CarbonImmutable::now('UTC');
        $today = BusinessTime::utc(BusinessTime::today());
        $missing = $this->missingDocumentsSql();
        $counts = ClinicApplication::query()->toBase()
            ->where('status', '!=', ClinicApplication::DRAFT)
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS pending', [ClinicApplication::PENDING])
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS under_review', [ClinicApplication::UNDER_REVIEW])
            ->selectRaw('SUM(CASE WHEN submitted_at >= ? THEN 1 ELSE 0 END) AS submitted_this_week', [$now->subDays(7)])
            ->selectRaw('SUM(CASE WHEN submitted_at >= ? AND submitted_at < ? THEN 1 ELSE 0 END) AS submitted_last_week', [$now->subDays(14), $now->subDays(7)])
            ->selectRaw("SUM(CASE WHEN status IN (?, ?) AND {$missing[0]} THEN 1 ELSE 0 END) AS missing_info", [...self::OPEN, ...$missing[1]])
            ->selectRaw('SUM(CASE WHEN status IN (?, ?) AND submitted_at <= ? THEN 1 ELSE 0 END) AS overdue', [...self::OPEN, $now->subDays(self::ATTENTION_DAYS)])
            ->selectRaw("SUM(CASE WHEN status IN (?, ?) AND ({$missing[0]} OR submitted_at <= ?) THEN 1 ELSE 0 END) AS attention", [...self::OPEN, ...$missing[1], $now->subDays(self::ATTENTION_DAYS)])
            ->selectRaw('SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS returned', [ClinicApplication::REJECTED])
            ->selectRaw('SUM(CASE WHEN status = ? AND reviewed_at >= ? THEN 1 ELSE 0 END) AS verified_today', [ClinicApplication::APPROVED, $today])
            ->selectRaw('SUM(CASE WHEN status = ? AND reviewed_at >= ? THEN 1 ELSE 0 END) AS decided_today', [ClinicApplication::REJECTED, $today])
            ->first();

        $decisions = ClinicApplication::whereIn('status', [ClinicApplication::APPROVED, ClinicApplication::REJECTED])
            ->where('reviewed_at', '>=', $now->subDays(30))
            ->whereNotNull('submitted_at')
            ->get(['id', 'submitted_at', 'reviewed_at']);
        $hours = $decisions->map(fn ($a) => abs($a->submitted_at->diffInMinutes($a->reviewed_at)) / 60);
        $oldest = ClinicApplication::whereIn('status', self::OPEN)->orderBy('submitted_at')->value('id');

        return $this->ok([
            'pending' => (int) ($counts->pending ?? 0),
            'under_review' => (int) ($counts->under_review ?? 0),
            'submitted_this_week' => (int) ($counts->submitted_this_week ?? 0),
            'submitted_last_week' => (int) ($counts->submitted_last_week ?? 0),
            'missing_info' => (int) ($counts->missing_info ?? 0),
            'overdue' => (int) ($counts->overdue ?? 0),
            'needs_attention' => (int) ($counts->attention ?? 0),
            'returned' => (int) ($counts->returned ?? 0),
            'verified_today' => (int) ($counts->verified_today ?? 0),
            'returned_today' => (int) ($counts->decided_today ?? 0),
            'average_decision_hours' => $hours->isEmpty() ? null : round($hours->avg(), 1),
            'decisions_last_30_days' => $hours->count(),
            'oldest_open_id' => $oldest,
            'attention_days' => self::ATTENTION_DAYS,
            'required_documents' => ClinicApplication::requiredDocuments(),
        ]);
    }

    /** CSV of the filtered registrations (up to CsvExport::MAX_ROWS). Password re-confirmed; recorded. */
    public function export(Request $request)
    {
        $applications = $this->filtered($request)
            ->with(['applicant', 'documents', 'clinic:id,status'])
            ->orderBy('submitted_at')
            ->limit(CsvExport::limit($request))
            ->get();
        $this->audit->record('clinic_application.exported', metadata: array_filter([
            ...$request->only(['status', 'search', 'view', 'from', 'to']),
            'rows' => $applications->count(),
        ]));

        return CsvExport::download(
            'clinic-registrations-'.BusinessTime::now()->format('Y-m-d-His').'.csv',
            ['Reference', 'Clinic', 'City', 'Province', 'Applicant', 'Applicant email', 'Representative', 'Status', 'Document status', 'Priority', 'Missing documents', 'Submitted (Philippines)', 'Decided (Philippines)'],
            $applications->map(function (ClinicApplication $a) {
                $row = $this->row($a);

                return [
                    $row['reference'], $a->clinic_name, $a->city, $a->province, $a->applicant?->name, $a->applicant?->email,
                    trim($a->representative_name.($a->representative_position ? " ({$a->representative_position})" : '')),
                    $a->status, $row['document_status'], $row['priority'], implode(', ', $row['missing_documents']),
                    $row['submitted_at'], $row['reviewed_at'],
                ];
            }),
        );
    }

    /** Submitted registrations with the list filters applied. Drafts stay private to the applicant. */
    private function filtered(Request $request): Builder
    {
        $request->validate([
            'status' => ['nullable', Rule::in([
                ClinicApplication::PENDING, ClinicApplication::UNDER_REVIEW, ClinicApplication::APPROVED, ClinicApplication::REJECTED,
            ])],
            'search' => ['nullable', 'string', 'max:100'],
            'view' => ['nullable', Rule::in(['attention'])],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);
        [$missingSql, $missingBindings] = $this->missingDocumentsSql();

        return ClinicApplication::where('status', '!=', ClinicApplication::DRAFT)
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->when($request->filled('search'), function ($q) use ($request) {
                $term = '%'.mb_strtolower($request->search).'%';
                $q->where(fn ($w) => $w->whereRaw('LOWER(clinic_name) LIKE ?', [$term])->orWhereRaw('LOWER(city) LIKE ?', [$term]));
            })
            ->when($request->view === 'attention', fn ($q) => $q->whereIn('status', self::OPEN)->where(fn ($w) => $w
                ->whereRaw($missingSql, $missingBindings)
                ->orWhere('submitted_at', '<=', now()->subDays(self::ATTENTION_DAYS))))
            ->when($request->filled('from'), fn ($q) => $q->where('submitted_at', '>=', BusinessTime::utc(BusinessTime::parse($request->from))))
            ->when($request->filled('to'), fn ($q) => $q->where('submitted_at', '<=', BusinessTime::utc(BusinessTime::parse($request->to)->endOfDay())));
    }

    /** True when a registration lacks one of the required document types. */
    private function missingDocumentsSql(): array
    {
        $required = ClinicApplication::requiredDocuments();

        return [
            '(SELECT COUNT(DISTINCT document_type) FROM verification_documents WHERE verification_documents.clinic_application_id = clinic_applications.id AND document_type IN ('
                .implode(', ', array_fill(0, count($required), '?')).')) < '.count($required),
            $required,
        ];
    }

    /** A list row: the registration plus its reference, document status and review priority. */
    private function row(ClinicApplication $application): array
    {
        $data = (new ClinicApplicationResource($application))->resolve();
        $open = in_array($application->status, self::OPEN, true);
        $missing = $data['missing_documents'];
        $waitedDays = $application->submitted_at ? $application->submitted_at->diffInDays(now()) : 0;

        return [
            ...$data,
            'reference' => sprintf('REG-%05d', $application->id),
            'documents_required' => count(ClinicApplication::requiredDocuments()),
            'documents_submitted' => count(ClinicApplication::requiredDocuments()) - count($missing),
            'clinic_status' => $application->clinic?->status,
            'document_status' => match (true) {
                $application->status === ClinicApplication::APPROVED => $application->clinic?->status === 'suspended' ? 'suspended' : 'verified',
                $application->status === ClinicApplication::REJECTED => $application->documents_requested_at ? 'documents_requested' : 'returned',
                $missing !== [] => 'missing_info',
                default => $application->status,
            },
            'priority' => ! $open ? null : match (true) {
                $missing !== [] || $waitedDays >= self::ATTENTION_DAYS => 'high',
                $waitedDays >= 1 => 'medium',
                default => 'standard',
            },
        ];
    }

    public function show(int $id)
    {
        $application = $this->find($id)->load(['applicant', 'documents', 'clinic:id,status']);

        return $this->ok([...$this->row($application), 'history' => $this->history($application)]);
    }

    /**
     * Internal note for other administrators. Notes are part of the audit
     * trail: they cannot be edited or deleted and are never shown to the
     * applicant (unlike the notes sent with a decision).
     */
    public function storeNote(Request $request, int $id)
    {
        $data = $request->validate(['note' => ['required', 'string', 'max:2000']]);
        $application = $this->find($id);
        $this->audit->record('clinic_application.note_added', $application, ['note' => trim($data['note'])]);

        return $this->ok($this->history($application), 'Note saved', 201);
    }

    /** Review timeline from the audit log, oldest first. */
    private function history(ClinicApplication $application): array
    {
        $logs = AuditLog::where('subject_type', class_basename($application))
            ->where('subject_id', $application->id)
            ->whereIn('action', self::HISTORY_ACTIONS)
            ->orderBy('id')
            ->get();
        $actors = User::whereIn('id', $logs->pluck('user_id')->filter()->unique())->pluck('name', 'id');

        return $logs->map(fn (AuditLog $log) => [
            'id' => $log->id,
            'action' => $log->action,
            'actor' => $actors[$log->user_id] ?? null,
            'note' => $log->action === 'clinic_application.note_added' ? ($log->metadata['note'] ?? null) : null,
            'document_type' => $log->metadata['type'] ?? null,
            'at' => BusinessTime::iso($log->created_at),
        ])->all();
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

    /** Ask for more documents; the applicant adds them and resubmits. */
    public function requestDocuments(Request $request, int $id)
    {
        $data = $request->validate(['notes' => ['required', 'string', 'max:2000']]);
        $application = $this->applications->requestDocuments($this->find($id), $request->user(), $data['notes']);

        return $this->ok((new ClinicApplicationResource($application->load(['applicant', 'documents'])))->resolve(), 'More documents requested');
    }

    public function documentLink(Request $request, int $id, int $documentId)
    {
        $document = $this->find($id)->documents()->findOrFail($documentId);

        return $this->ok(['url' => $this->applications->temporaryDownloadUrl($document, $request->user(), $request->boolean('download')), 'expires_in' => 300]);
    }

    private function find(int $id): ClinicApplication
    {
        return ClinicApplication::where('status', '!=', ClinicApplication::DRAFT)->findOrFail($id);
    }
}
