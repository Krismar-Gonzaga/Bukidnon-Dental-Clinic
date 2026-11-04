<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Http\Resources\AppointmentResource;
use App\Models\Appointment;
use App\Models\Clinic;
use App\Models\ClinicMembership;
use App\Services\AuditLogger;
use App\Support\BusinessTime;
use Illuminate\Http\Request;

/**
 * What the front desk works from: today's waiting queue, scheduling notes on an appointment,
 * and a member's own work details. Status changes stay in AppointmentController.
 */
class FrontDeskController extends Controller
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    /**
     * Patients checked in today who are waiting or being seen. Numbers follow check-in order
     * and count those already finished, so a patient's number does not change during the day.
     */
    public function queue(Clinic $clinic)
    {
        $today = BusinessTime::today();
        $checkedIn = $clinic->appointments()
            ->whereBetween('starts_at', [BusinessTime::utc($today), BusinessTime::utc($today->endOfDay())])
            ->whereHas('statusHistory', fn ($q) => $q->where('to_status', Appointment::CHECKED_IN))
            ->with(['dentist.user', 'serviceRate', 'statusHistory'])
            ->get()
            ->map(fn (Appointment $a) => [$a, $a->statusHistory->firstWhere('to_status', Appointment::CHECKED_IN)->created_at])
            ->sortBy(fn (array $row) => $row[1]->getTimestamp())
            ->values();

        $queue = $checkedIn->map(fn (array $row, int $index) => [
            'id' => $row[0]->id,
            'queue_number' => $index + 1,
            'patient' => $row[0]->patient_name,
            'service' => $row[0]->serviceRate?->service_name,
            'dentist' => $row[0]->dentist?->user?->name,
            'status' => $row[0]->status,
            'checked_in_at' => BusinessTime::iso($row[1]),
        ])->whereIn('status', [Appointment::CHECKED_IN, Appointment::IN_PROGRESS])->values();

        return $this->ok($queue);
    }

    /** Scheduling notes for the front desk. Clinical notes belong in patient records. */
    public function saveNotes(Request $request, Clinic $clinic, int $appointmentId)
    {
        $data = $request->validate(['notes' => ['present', 'nullable', 'string', 'max:2000']]);

        $appointment = $clinic->appointments()->findOrFail($appointmentId);
        $appointment->forceFill(['front_desk_notes' => $data['notes']])->save();
        $this->audit->record('appointment.front_desk_notes_updated', $appointment, clinicId: $clinic->id);

        return $this->ok((new AppointmentResource($appointment))->clinicView()->resolve(), 'Notes saved');
    }

    /** The signed-in member's own details at this clinic. */
    public function me(Request $request, Clinic $clinic)
    {
        return $this->ok($this->presentMe($request->attributes->get('clinicMembership'), $clinic));
    }

    /** Members keep their own contact details; their role and schedule stay with the clinic admin. */
    public function updateMe(Request $request, Clinic $clinic)
    {
        $data = $request->validate([
            'phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $membership = $request->attributes->get('clinicMembership');
        $membership->forceFill($data)->save();
        $this->audit->record('membership.contact_updated', $membership, ['fields' => array_keys($data)], $clinic->id);

        return $this->ok($this->presentMe($membership, $clinic), 'Details saved');
    }

    private function presentMe(ClinicMembership $membership, Clinic $clinic): array
    {
        $user = $membership->user;

        return [
            'name' => $user?->name,
            'email' => $user?->email,
            'phone' => $membership->phone,
            'address' => $membership->address,
            'position_label' => $membership->positionLabel(),
            'clinic_name' => $clinic->name,
            'status' => $membership->status,
            'work_schedule' => $membership->work_schedule,
        ];
    }
}
