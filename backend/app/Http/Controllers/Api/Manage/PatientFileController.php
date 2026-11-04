<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\Patient;
use App\Models\PatientFile;
use App\Services\AuditLogger;
use App\Support\BusinessTime;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

/**
 * Documents a clinic keeps for a patient: clinical data, so it needs records.view or
 * records.write. Files stay on a private disk, belong to one clinic, and every read is logged.
 */
class PatientFileController extends Controller
{
    private const MAX_KILOBYTES = 10240;

    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function index(Request $request, Clinic $clinic, int $patientId)
    {
        $patient = $this->patient($request, $clinic, $patientId);

        return $this->ok($this->files($clinic, $patient)->latest()->latest('id')->get()->map(fn (PatientFile $file) => $this->present($file)));
    }

    /** Files across the patients this member may see, newest first. */
    public function clinicIndex(Request $request, Clinic $clinic)
    {
        $data = $request->validate([
            'patient_id' => ['nullable', 'integer'],
            'category' => ['nullable', Rule::in(PatientFile::CATEGORIES)],
        ]);
        $dentist = $this->actingDentist($request);

        $page = PatientFile::where('clinic_id', $clinic->id)
            ->when($dentist, fn ($q) => $q->whereHas('patient.appointments', fn ($a) => $a->where('clinic_id', $clinic->id)->where('dentist_id', $dentist->id)))
            ->when($data['patient_id'] ?? null, fn ($q, $id) => $q->where('patient_id', $id))
            ->when($data['category'] ?? null, fn ($q, $category) => $q->where('category', $category))
            ->with('patient.user')
            ->latest()->latest('id')
            ->paginate($this->perPage($request, 30));

        $this->audit->record('records.files_listed', null, ['count' => count($page->items())], $clinic->id);

        return $this->paginated($page, fn (PatientFile $file) => [
            ...$this->present($file),
            'patient' => ['id' => $file->patient_id, 'name' => $file->patient?->display_name],
        ]);
    }

    public function store(Request $request, Clinic $clinic, int $patientId)
    {
        $patient = $this->patient($request, $clinic, $patientId);
        $details = $request->validate([
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'mimetypes:application/pdf,image/jpeg,image/png,image/webp', 'max:'.self::MAX_KILOBYTES],
            'category' => ['nullable', Rule::in(PatientFile::CATEGORIES)],
            'notes' => ['nullable', 'string', 'max:500'],
        ]);

        $upload = $request->file('file');
        $record = new PatientFile([
            // Only ever shown and used as a download name, never as a path.
            'name' => mb_substr(basename($upload->getClientOriginalName()), 0, 200),
            'path' => $upload->store("patient-files/{$clinic->id}/{$patient->id}", PatientFile::DISK),
            'mime_type' => $upload->getMimeType(),
            'size' => $upload->getSize(),
            'category' => $details['category'] ?? null,
            'notes' => $details['notes'] ?? null,
        ]);
        $record->clinic_id = $clinic->id;
        $record->patient_id = $patient->id;
        $record->uploaded_by = $request->user()->id;
        $record->save();

        // The file's name can say something about the patient's health, so it is not logged.
        $this->audit->record('records.file_uploaded', $record, ['patient_id' => $patient->id], $clinic->id);

        return $this->ok($this->present($record), 'File uploaded', 201);
    }

    public function download(Request $request, Clinic $clinic, int $patientId, int $fileId)
    {
        $patient = $this->patient($request, $clinic, $patientId);
        $file = $this->files($clinic, $patient)->findOrFail($fileId);
        abort_unless(Storage::disk(PatientFile::DISK)->exists($file->path), 404);

        $this->audit->record('records.file_downloaded', $file, ['patient_id' => $patient->id], $clinic->id);

        return Storage::disk(PatientFile::DISK)->download($file->path, $file->name, [
            'Content-Type' => $file->mime_type,
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /** A 5-minute signed link for the mobile app, which opens files in the phone's browser. */
    public function link(Request $request, Clinic $clinic, int $patientId, int $fileId)
    {
        $patient = $this->patient($request, $clinic, $patientId);
        $file = $this->files($clinic, $patient)->findOrFail($fileId);

        $this->audit->record('records.file_downloaded', $file, ['patient_id' => $patient->id], $clinic->id);

        return $this->ok(['url' => URL::temporarySignedRoute('patient-files.download', now()->addMinutes(5), ['file' => $file->id], absolute: false)]);
    }

    private function patient(Request $request, Clinic $clinic, int $patientId): Patient
    {
        $query = $clinic->patients();
        if ($dentist = $this->actingDentist($request)) {
            $query->whereHas('appointments', fn ($q) => $q->where('clinic_id', $clinic->id)->where('dentist_id', $dentist->id));
        }

        return $query->findOrFail($patientId);
    }

    private function files(Clinic $clinic, Patient $patient)
    {
        return PatientFile::where('clinic_id', $clinic->id)->where('patient_id', $patient->id);
    }

    private function present(PatientFile $file): array
    {
        return [
            'id' => $file->id,
            'name' => $file->name,
            'mime_type' => $file->mime_type,
            'size' => $file->size,
            'category' => $file->category,
            'notes' => $file->notes,
            'uploaded_at' => BusinessTime::iso($file->created_at),
        ];
    }
}
