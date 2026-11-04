<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Concerns\FindsClinicPatients;
use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\FollowUp;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Planned return visits. A dentist works with their own; a clinic admin sees the clinic's. */
class FollowUpController extends Controller
{
    use FindsClinicPatients;

    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function index(Request $request, Clinic $clinic)
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in(FollowUp::STATUSES)],
            'patient_id' => ['nullable', 'integer'],
        ]);
        $mine = fn () => $this->visible($request, $clinic);

        $page = $mine()
            ->when($data['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->when($data['patient_id'] ?? null, fn ($q, $id) => $q->where('patient_id', $id))
            ->with('patient.user')
            ->orderBy('due_on')->orderBy('id')
            ->paginate($this->perPage($request, 50));

        return $this->ok(
            collect($page->items())->map(fn (FollowUp $f) => $this->present($f))->values(),
            meta: [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'summary' => [
                    'total' => $mine()->open()->count(),
                    'high_priority' => $mine()->open()->where('priority', 'high')->count(),
                    'confirmed' => $mine()->where('status', 'confirmed')->count(),
                ],
            ],
        );
    }

    public function store(Request $request, Clinic $clinic)
    {
        $data = $request->validate([
            'patient_id' => ['required', 'integer'],
            ...$this->rules(),
        ]);
        $patient = $this->clinicPatient($request, $clinic, $data['patient_id']);

        $followUp = new FollowUp($data);
        $followUp->clinic_id = $clinic->id;
        $followUp->patient_id = $patient->id;
        $followUp->dentist_id = $this->actingDentist($request)?->id;
        $followUp->created_by = $request->user()->id;
        $followUp->status = $data['status'] ?? 'scheduled';
        $followUp->priority = $data['priority'] ?? 'routine';
        $followUp->save();

        $this->audit->record('records.follow_up_created', $followUp, ['patient_id' => $patient->id], $clinic->id);

        return $this->ok($this->present($followUp->load('patient.user')), 'Follow-up scheduled', 201);
    }

    public function update(Request $request, Clinic $clinic, int $followUpId)
    {
        $followUp = $this->visible($request, $clinic)->findOrFail($followUpId);
        $data = $request->validate($this->rules());

        $followUp->fill($data);
        // A new date is a new reminder.
        if ($followUp->isDirty('due_on')) {
            $followUp->reminder_sent_at = null;
        }
        $followUp->save();

        $this->audit->record('records.follow_up_updated', $followUp, ['patient_id' => $followUp->patient_id, 'status' => $followUp->status], $clinic->id);

        return $this->ok($this->present($followUp->load('patient.user')), 'Follow-up updated');
    }

    private function visible(Request $request, Clinic $clinic)
    {
        $dentist = $this->actingDentist($request);

        return FollowUp::where('clinic_id', $clinic->id)->when($dentist, fn ($q) => $q->where('dentist_id', $dentist->id));
    }

    private function rules(): array
    {
        return [
            'purpose' => ['required', 'string', 'max:255'],
            'due_on' => ['required', 'date_format:Y-m-d'],
            'priority' => ['sometimes', Rule::in(FollowUp::PRIORITIES)],
            'status' => ['sometimes', Rule::in(FollowUp::STATUSES)],
            'notes' => ['nullable', 'string', 'max:500'],
        ];
    }

    private function present(FollowUp $f): array
    {
        return [
            'id' => $f->id,
            'patient' => ['id' => $f->patient_id, 'name' => $f->patient?->display_name],
            'purpose' => $f->purpose,
            'due_on' => $f->due_on?->toDateString(),
            'priority' => $f->priority,
            'status' => $f->status,
            'notes' => $f->notes,
        ];
    }
}
