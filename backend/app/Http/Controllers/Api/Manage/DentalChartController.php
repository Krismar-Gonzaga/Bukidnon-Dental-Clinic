<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Concerns\FindsClinicPatients;
use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\DentalChartTooth;
use App\Models\Patient;
use App\Services\AuditLogger;
use App\Support\BusinessTime;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Per-patient clinical tools: the dental chart (Universal Numbering System, 1-32) and the
 * pre-procedure checklist. Reads need records.view, changes records.write, and all are logged.
 */
class DentalChartController extends Controller
{
    use FindsClinicPatients;

    private const CHECKLIST = ['allergies_reviewed', 'conditions_assessed', 'medications_reviewed', 'blood_pressure_normal', 'blood_sugar_safe', 'latex_free_required'];

    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function show(Request $request, Clinic $clinic, int $patientId)
    {
        $patient = $this->clinicPatient($request, $clinic, $patientId);
        $this->audit->record('records.chart_viewed', $patient, clinicId: $clinic->id);

        return $this->ok($this->chart($clinic, $patient));
    }

    public function updateTooth(Request $request, Clinic $clinic, int $patientId, int $tooth)
    {
        $patient = $this->clinicPatient($request, $clinic, $patientId);
        abort_unless($tooth >= 1 && $tooth <= DentalChartTooth::TEETH, 404);

        $data = $request->validate([
            'status' => ['required', Rule::in(DentalChartTooth::STATUSES)],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $row = DentalChartTooth::firstOrNew(['clinic_id' => $clinic->id, 'patient_id' => $patient->id, 'tooth_number' => $tooth]);
        $previous = $row->exists ? $row->status : null;
        $row->clinic_id = $clinic->id;
        $row->patient_id = $patient->id;
        $row->tooth_number = $tooth;
        $row->fill($data);
        $row->updated_by = $request->user()->id;
        $row->save();

        // The status change is kept; the note itself is clinical and stays out of the log.
        $this->audit->record('records.chart_updated', $patient, ['tooth' => $tooth, 'from' => $previous, 'to' => $row->status], $clinic->id);

        return $this->ok($this->chart($clinic, $patient), 'Tooth saved');
    }

    public function checklist(Request $request, Clinic $clinic, int $patientId)
    {
        $patient = $this->clinicPatient($request, $clinic, $patientId);

        return $this->ok($this->presentChecklist($clinic, $patient));
    }

    /** What the dentist actually ticked. Nothing counts as reviewed until they do. */
    public function updateChecklist(Request $request, Clinic $clinic, int $patientId)
    {
        $patient = $this->clinicPatient($request, $clinic, $patientId);
        $data = $request->validate([
            'items' => ['required', 'array:'.implode(',', self::CHECKLIST)],
            'items.*' => ['boolean'],
        ]);

        $saved = [
            'items' => array_merge(array_fill_keys(self::CHECKLIST, false), $data['items']),
            'reviewed_by' => $request->user()->name,
            'reviewed_at' => BusinessTime::iso(now()),
        ];
        DB::table('clinic_patients')->where('clinic_id', $clinic->id)->where('patient_id', $patient->id)
            ->update(['pre_procedure_checklist' => json_encode($saved)]);
        $this->audit->record('records.checklist_updated', $patient, clinicId: $clinic->id);

        return $this->ok($saved, 'Checklist saved');
    }

    private function presentChecklist(Clinic $clinic, Patient $patient): array
    {
        $stored = DB::table('clinic_patients')->where('clinic_id', $clinic->id)->where('patient_id', $patient->id)->value('pre_procedure_checklist');
        $saved = $stored ? json_decode($stored, true) : [];

        return [
            'items' => array_merge(array_fill_keys(self::CHECKLIST, false), $saved['items'] ?? []),
            'reviewed_by' => $saved['reviewed_by'] ?? null,
            'reviewed_at' => $saved['reviewed_at'] ?? null,
        ];
    }

    private function chart(Clinic $clinic, Patient $patient): array
    {
        $rows = DentalChartTooth::where('clinic_id', $clinic->id)->where('patient_id', $patient->id)->get()->keyBy('tooth_number');

        $teeth = collect(range(1, DentalChartTooth::TEETH))->map(fn (int $number) => [
            'number' => $number,
            'status' => $rows[$number]->status ?? 'healthy',
            'notes' => $rows[$number]->notes ?? null,
            'charted' => isset($rows[$number]),
        ]);

        return [
            'teeth' => $teeth,
            'summary' => collect(DentalChartTooth::STATUSES)->mapWithKeys(fn (string $status) => [$status => $teeth->where('status', $status)->count()]),
            'last_updated_at' => BusinessTime::iso($rows->max('updated_at')),
        ];
    }
}
