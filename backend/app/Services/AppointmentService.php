<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\Clinic;
use App\Models\ClinicBranch;
use App\Models\ClinicMembership;
use App\Models\Dentist;
use App\Models\Patient;
use App\Models\ServiceRate;
use App\Models\User;
use App\Notifications\AppointmentUpdated;
use App\Notifications\ClinicAppointmentActivity;
use App\Notifications\PortalNotice;
use App\Support\BusinessTime;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * The only place appointments are created or change status/time.
 *
 * Double booking is prevented in three layers:
 *  1. AvailabilityService validates the slot (hours, schedule, holidays,
 *     blocks, existing appointments).
 *  2. Inside a transaction the dentist row is locked (SELECT ... FOR UPDATE),
 *     so concurrent bookings for the same dentist run one at a time, and the
 *     overlap check is repeated.
 *  3. On PostgreSQL, an exclusion constraint rejects any overlap that still
 *     slipped through (reported as a 409 conflict).
 */
class AppointmentService
{
    public function __construct(
        private readonly AvailabilityService $availability,
        private readonly AuditLogger $audit,
    ) {
    }

    /**
     * @param  array{service_rate_id: int, dentist_id: int, branch_id: int, starts_at: string, reason?: ?string, notes?: ?string}  $data
     */
    public function book(Clinic $clinic, Patient $patient, array $data, User $actor, ?string $idempotencyKey = null): Appointment
    {
        if ($idempotencyKey) {
            $existing = Appointment::where('patient_id', $patient->id)->where('idempotency_key', $idempotencyKey)->first();
            if ($existing) {
                return $existing;
            }
        }

        if (! $clinic->isPubliclyListed()) {
            throw new UnprocessableEntityHttpException('This clinic is not accepting appointments.');
        }

        $settings = $clinic->settingsValues();
        // The clinic can still book for a patient; these settings are about online requests.
        $selfBooked = $patient->user_id !== null && $patient->user_id === $actor->id;
        if ($selfBooked && ! $settings['allow_online_booking']) {
            throw new UnprocessableEntityHttpException('This clinic is not taking online bookings right now. Please contact the clinic.');
        }
        $initialStatus = $selfBooked && ! $settings['require_approval'] ? Appointment::CONFIRMED : Appointment::PENDING;

        [$service, $dentist, $branch] = $this->resolveBookingTargets($clinic, $data);
        $start = BusinessTime::parse($data['starts_at']);
        $end = $start->addMinutes($service->duration_minutes);

        if (! $this->availability->isBookable($clinic, $start, $service, $dentist, $branch)) {
            throw new ConflictHttpException('That time is no longer available. Please choose another slot.');
        }

        $isNewToDentist = ! Appointment::where('clinic_id', $clinic->id)->where('patient_id', $patient->id)->where('dentist_id', $dentist->id)->exists();

        $appointment = $this->withOverlapGuard(function () use ($clinic, $patient, $data, $actor, $idempotencyKey, $service, $dentist, $branch, $start, $end, $initialStatus) {
            Dentist::whereKey($dentist->id)->lockForUpdate()->first();
            $this->assertNoOverlap($dentist, $patient, $start, $end);

            $appointment = new Appointment([
                'reason' => $data['reason'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);
            $appointment->clinic_id = $clinic->id;
            $appointment->branch_id = $branch->id;
            $appointment->dentist_id = $dentist->id;
            $appointment->service_rate_id = $service->id;
            $appointment->service_id = $service->service_id;
            $appointment->patient_id = $patient->id;
            $appointment->patient_name = $patient->display_name ?? 'Patient';
            $appointment->patient_email = $patient->contact_email ?? '';
            $appointment->patient_phone = $patient->phone ?? '';
            $appointment->status = $initialStatus;
            $appointment->status_changed_at = now();
            $appointment->idempotency_key = $idempotencyKey;
            $appointment->created_by = $actor->id;
            $this->setTimes($appointment, $start, $end);
            $appointment->save();

            $appointment->statusHistory()->create([
                'from_status' => null,
                'to_status' => $initialStatus,
                'changed_by' => $actor->id,
            ]);

            $patient->registerWith($clinic, $actor);

            return $appointment;
        });

        $this->audit->record('appointment.created', $appointment, clinicId: $clinic->id);
        $this->notifyPatient($appointment, 'requested');
        $this->notifyClinic($appointment, 'requested');
        if ($isNewToDentist) {
            $dentist->user?->notify(new PortalNotice(
                'patient',
                'New Patient Assigned',
                "{$appointment->patient_name} has been assigned to your caseload.",
                'appointment_requests',
                ['type' => 'clinic_patient', 'id' => $patient->id, 'clinic_id' => $clinic->id],
            ));
        }

        return $appointment->load(['clinic', 'branch', 'dentist.user', 'serviceRate']);
    }

    /** Move an appointment along the state machine. */
    public function transition(Appointment $appointment, string $to, User $actor, ?string $reason = null, bool $byPatient = false): Appointment
    {
        $appointment = DB::transaction(function () use ($appointment, $to, $actor, $reason) {
            /** @var Appointment $locked */
            $locked = Appointment::whereKey($appointment->id)->lockForUpdate()->firstOrFail();

            if (! $locked->canTransitionTo($to)) {
                throw new ConflictHttpException("An appointment that is {$this->label($locked->status)} cannot be {$this->label($to)}.");
            }

            if (in_array($to, [Appointment::CANCELLED, Appointment::REJECTED], true)) {
                $locked->cancellation_reason = $reason;
            }

            // Confirming a pending reschedule request without moving it keeps the old time.
            if ($locked->status === Appointment::RESCHEDULE_REQUESTED) {
                $locked->requested_starts_at = null;
                $locked->requested_ends_at = null;
            }

            $from = $locked->status;
            $locked->status = $to;
            $locked->status_changed_at = now();
            $locked->save();

            $locked->statusHistory()->create([
                'from_status' => $from,
                'to_status' => $to,
                'reason' => $reason,
                'changed_by' => $actor->id,
            ]);

            return $locked;
        });

        $this->audit->record('appointment.status_changed', $appointment, ['to' => $to], $appointment->clinic_id, $actor);

        if ($byPatient) {
            $this->notifyClinic($appointment, $to);
        } else {
            $this->notifyPatient($appointment, $to);
        }

        return $appointment;
    }

    /**
     * Clinic staff move an appointment to a new valid slot. A pending reschedule
     * request is resolved by this (→ confirmed).
     */
    public function reschedule(Appointment $appointment, string $startsAt, User $actor, ?string $reason = null, ?int $dentistId = null): Appointment
    {
        $allowed = [Appointment::PENDING, Appointment::CONFIRMED, Appointment::RESCHEDULE_REQUESTED];
        if (! in_array($appointment->status, $allowed, true)) {
            throw new ConflictHttpException("An appointment that is {$this->label($appointment->status)} cannot be rescheduled.");
        }

        $clinic = $appointment->clinic;
        $service = $appointment->serviceRate;
        $dentist = $dentistId
            ? $clinic->dentistProfiles()->whereKey($dentistId)->first()
            : $appointment->dentist;
        $branch = $appointment->branch;

        if (! $service || ! $dentist || ! $branch) {
            throw new UnprocessableEntityHttpException('This appointment cannot be rescheduled automatically.');
        }

        $start = BusinessTime::parse($startsAt);
        $end = $start->addMinutes($service->duration_minutes);

        if (! $this->availability->isBookable($clinic, $start, $service, $dentist, $branch, $appointment->id)) {
            throw new ConflictHttpException('That time is not available. Please choose another slot.');
        }

        $appointment = $this->withOverlapGuard(function () use ($appointment, $dentist, $start, $end, $actor, $reason) {
            Dentist::whereKey($dentist->id)->lockForUpdate()->first();
            $locked = Appointment::whereKey($appointment->id)->lockForUpdate()->firstOrFail();
            $this->assertNoOverlap($dentist, $locked->patient, $start, $end, $locked->id);

            $from = $locked->status;
            $locked->dentist_id = $dentist->id;
            $this->setTimes($locked, $start, $end);
            $locked->requested_starts_at = null;
            $locked->requested_ends_at = null;
            if ($from === Appointment::RESCHEDULE_REQUESTED) {
                $locked->status = Appointment::CONFIRMED;
            }
            $locked->status_changed_at = now();
            $locked->save();

            $locked->statusHistory()->create([
                'from_status' => $from,
                'to_status' => $locked->status,
                'reason' => trim('Rescheduled to '.BusinessTime::iso($start).'. '.($reason ?? '')),
                'changed_by' => $actor->id,
            ]);

            return $locked;
        });

        $this->audit->record('appointment.rescheduled', $appointment, ['starts_at' => BusinessTime::iso($start)], $appointment->clinic_id, $actor);
        $this->notifyPatient($appointment, 'rescheduled');

        return $appointment;
    }

    /**
     * Patient asks for a new time. A pending request simply moves (it is not
     * confirmed yet); a confirmed appointment becomes reschedule_requested
     * and keeps its slot until the clinic approves the new time.
     */
    public function requestReschedule(Appointment $appointment, string $startsAt, User $actor): Appointment
    {
        $this->assertPatientCanChange($appointment);

        if ($appointment->status === Appointment::PENDING) {
            return $this->reschedule($appointment, $startsAt, $actor, 'Moved by patient');
        }

        if ($appointment->status !== Appointment::CONFIRMED) {
            throw new ConflictHttpException("An appointment that is {$this->label($appointment->status)} cannot be rescheduled.");
        }

        $start = BusinessTime::parse($startsAt);
        $end = $start->addMinutes($appointment->serviceRate->duration_minutes);

        if (! $this->availability->isBookable($appointment->clinic, $start, $appointment->serviceRate, $appointment->dentist, $appointment->branch, $appointment->id)) {
            throw new ConflictHttpException('That time is not available. Please choose another slot.');
        }

        DB::transaction(function () use ($appointment, $start, $end, $actor) {
            $appointment->requested_starts_at = BusinessTime::utc($start);
            $appointment->requested_ends_at = BusinessTime::utc($end);
            $appointment->save();
            $this->transition($appointment, Appointment::RESCHEDULE_REQUESTED, $actor, 'Patient requested '.BusinessTime::iso($start), byPatient: true);
        });

        return $appointment->fresh();
    }

    public function approveRescheduleRequest(Appointment $appointment, User $actor): Appointment
    {
        if ($appointment->status !== Appointment::RESCHEDULE_REQUESTED || ! $appointment->requested_starts_at) {
            throw new ConflictHttpException('There is no pending reschedule request.');
        }

        return $this->reschedule($appointment, BusinessTime::iso($appointment->requested_starts_at), $actor, 'Patient request approved');
    }

    public function cancelByPatient(Appointment $appointment, User $actor, ?string $reason): Appointment
    {
        if (! $appointment->clinic->settingsValues()['allow_patient_cancel']) {
            throw new ConflictHttpException('This clinic does not take cancellations online. Please contact the clinic.');
        }
        $this->assertPatientCanChange($appointment);

        return $this->transition($appointment, Appointment::CANCELLED, $actor, $reason ?? 'Cancelled by patient', byPatient: true);
    }

    private function assertPatientCanChange(Appointment $appointment): void
    {
        $cutoff = BusinessTime::now()->addHours(config('booking.patient_change_cutoff_hours'));

        if ($appointment->starts_at && $appointment->starts_at->lt($cutoff)) {
            throw new ConflictHttpException(
                'Appointments can only be changed online up to '.config('booking.patient_change_cutoff_hours').' hours before the start. Please contact the clinic.'
            );
        }
    }

    private function resolveBookingTargets(Clinic $clinic, array $data): array
    {
        $service = ServiceRate::where('clinic_id', $clinic->id)->available()->find($data['service_rate_id']);
        $dentist = $clinic->dentistProfiles()->find($data['dentist_id']);
        $branch = ClinicBranch::where('clinic_id', $clinic->id)->where('is_active', true)->find($data['branch_id']);

        if (! $service || ! $dentist || ! $branch) {
            throw new UnprocessableEntityHttpException('The selected service, dentist or branch is not available at this clinic.');
        }

        return [$service, $dentist, $branch];
    }

    private function assertNoOverlap(Dentist $dentist, ?Patient $patient, CarbonImmutable $start, CarbonImmutable $end, ?int $ignoreId = null): void
    {
        $from = BusinessTime::utc($start);
        $to = BusinessTime::utc($end);

        $dentistBusy = Appointment::active()->where('dentist_id', $dentist->id)
            ->overlapping($from, $to)
            ->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))
            ->exists();

        if ($dentistBusy) {
            throw new ConflictHttpException('That time was just booked. Please choose another slot.');
        }

        $patientBusy = $patient && Appointment::active()->where('patient_id', $patient->id)
            ->overlapping($from, $to)
            ->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))
            ->exists();

        if ($patientBusy) {
            throw new ConflictHttpException('You already have an appointment at that time.');
        }
    }

    private function setTimes(Appointment $appointment, CarbonImmutable $start, CarbonImmutable $end): void
    {
        $appointment->starts_at = BusinessTime::utc($start);
        $appointment->ends_at = BusinessTime::utc($end);
        // Older clients read these local date/time columns.
        $appointment->appointment_date = $start->toDateString();
        $appointment->appointment_time = $start->format('H:i:s');
    }

    /** Runs $callback in a transaction, turning a DB overlap rejection into a 409. */
    private function withOverlapGuard(callable $callback): Appointment
    {
        try {
            return DB::transaction($callback);
        } catch (QueryException $e) {
            if (($e->errorInfo[0] ?? null) === '23P01') { // exclusion_violation
                throw new ConflictHttpException('That time was just booked. Please choose another slot.');
            }
            throw $e;
        }
    }

    private function notifyPatient(Appointment $appointment, string $event): void
    {
        $user = $appointment->patient?->user;
        if ($user) {
            $user->notify(new AppointmentUpdated($appointment, $event));
        }
    }

    private function notifyClinic(Appointment $appointment, string $event): void
    {
        $recipients = User::whereHas('clinicMemberships', fn ($q) => $q
            ->where('clinic_id', $appointment->clinic_id)
            ->where('status', ClinicMembership::STATUS_ACTIVE)
            ->whereIn('role', [ClinicMembership::ROLE_CLINIC_ADMIN, ClinicMembership::ROLE_STAFF]))
            ->where('status', User::STATUS_ACTIVE)
            ->get();

        // And the dentist whose patient it is.
        $dentist = $appointment->dentist()->with('user')->first()?->user;
        if ($dentist?->status === User::STATUS_ACTIVE) {
            $recipients = $recipients->push($dentist)->unique('id');
        }

        Notification::send($recipients, new ClinicAppointmentActivity($appointment, $event));
    }

    private function label(string $status): string
    {
        return str_replace('_', ' ', $status);
    }
}
