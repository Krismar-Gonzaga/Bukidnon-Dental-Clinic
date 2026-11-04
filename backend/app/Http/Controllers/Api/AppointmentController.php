<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AppointmentResource;
use App\Models\Appointment;
use App\Models\Clinic;
use App\Models\Patient;
use App\Services\AppointmentService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/**
 * The signed-in patient's own appointments. Every lookup is scoped to the
 * patient, so other patients' appointments are simply "not found".
 */
class AppointmentController extends Controller
{
    private const RELATIONS = ['clinic', 'branch', 'dentist.user', 'serviceRate', 'review'];

    public function __construct(private readonly AppointmentService $appointments)
    {
    }

    public function patientAppointments(Request $request)
    {
        $request->validate([
            'status' => ['nullable', 'string'],
            'scope' => ['nullable', 'in:upcoming,past'],
        ]);

        $query = $this->ownAppointments($request)->with(self::RELATIONS);

        if ($request->filled('status')) {
            $query->whereIn('status', explode(',', $request->status));
        }

        match ($request->query('scope')) {
            'upcoming' => $query->where('starts_at', '>=', now())->orderBy('starts_at'),
            'past' => $query->where('starts_at', '<', now())->orderByDesc('starts_at'),
            default => $query->orderByDesc('appointment_date')->orderByDesc('appointment_time'),
        };

        return $this->ok($query->get()->map(fn ($a) => (new AppointmentResource($a))->resolve()));
    }

    public function show(Request $request, int $id)
    {
        $appointment = $this->ownAppointments($request)
            ->with([...self::RELATIONS, 'statusHistory'])
            ->findOrFail($id);

        return $this->ok((new AppointmentResource($appointment))->resolve());
    }

    /**
     * Request an appointment. Send an Idempotency-Key header (any unique
     * string per booking attempt) so a retried request cannot book twice.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'clinic_id' => ['required', 'integer'],
            'service_rate_id' => ['required', 'integer'],
            'dentist_id' => ['required', 'integer'],
            'branch_id' => ['required', 'integer'],
            'starts_at' => ['required', 'date'],
            'reason' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $patient = $this->patient($request);
        $clinic = Clinic::publiclyListed()->findOrFail($data['clinic_id']);
        $key = $request->header('Idempotency-Key');
        $key = $key ? substr($key, 0, 64) : null;

        $appointment = $this->appointments->book($clinic, $patient, $data, $request->user(), $key);

        return $this->ok(
            (new AppointmentResource($appointment->load(self::RELATIONS)))->resolve(),
            'Appointment request sent',
            $appointment->wasRecentlyCreated ? 201 : 200
        );
    }

    /**
     * Ask for a new time. Accepts `starts_at`, or the older
     * `appointment_date` + `appointment_time` pair.
     */
    public function update(Request $request, int $id)
    {
        $data = $request->validate([
            'starts_at' => ['required_without:appointment_date', 'nullable', 'date'],
            'appointment_date' => ['required_without:starts_at', 'nullable', 'date_format:Y-m-d'],
            'appointment_time' => ['required_with:appointment_date', 'nullable', 'date_format:H:i'],
        ]);

        $appointment = $this->ownAppointments($request)->findOrFail($id);
        $startsAt = $data['starts_at'] ?? "{$data['appointment_date']} {$data['appointment_time']}";

        $appointment = $this->appointments->requestReschedule($appointment, $startsAt, $request->user());

        return $this->ok(
            (new AppointmentResource($appointment->fresh(self::RELATIONS)))->resolve(),
            $appointment->status === Appointment::RESCHEDULE_REQUESTED
                ? 'Reschedule request sent to the clinic'
                : 'Appointment moved'
        );
    }

    public function cancel(Request $request, int $id)
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $appointment = $this->ownAppointments($request)->findOrFail($id);

        $this->appointments->cancelByPatient($appointment, $request->user(), $data['reason'] ?? null);

        return $this->ok(message: 'Appointment cancelled successfully');
    }

    /** Includes legacy rows that were matched to patients by email only. */
    private function ownAppointments(Request $request): Builder
    {
        $user = $request->user();
        $patientId = $user->patient?->id;

        return Appointment::query()->where(fn (Builder $q) => $q
            ->when($patientId, fn ($q) => $q->where('patient_id', $patientId))
            ->orWhere(fn ($q) => $q->whereNull('patient_id')->whereRaw('LOWER(patient_email) = ?', [strtolower($user->email)])));
    }

    private function patient(Request $request): Patient
    {
        $patient = $request->user()->patient;

        if (! $patient) {
            throw new AccessDeniedHttpException('Only patient accounts can book appointments.');
        }

        return $patient;
    }
}
