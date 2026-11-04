<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Http\Resources\AppointmentResource;
use App\Models\Appointment;
use App\Models\Clinic;
use App\Models\ClinicMembership;
use App\Models\Dentist;
use App\Models\FollowUp;
use App\Models\ScheduleChangeRequest;
use App\Models\Specialization;
use App\Services\AuditLogger;
use App\Support\BusinessTime;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * What a dentist works from: their day, their week, and their own profile. Everything here
 * is about the signed-in dentist, so there is no dentist id to get wrong in the request.
 */
class DentistPortalController extends Controller
{
    private const UPCOMING_DAYS = 3;

    private const LIST_LIMIT = 5;

    private const RELATIONS = ['serviceRate', 'branch', 'dentist.user', 'patient:id,user_id,birth_date,gender'];

    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function overview(Request $request, Clinic $clinic)
    {
        $dentist = $this->dentist($request);
        $today = BusinessTime::today();
        $mine = fn () => $clinic->appointments()->where('dentist_id', $dentist->id);
        $booked = fn () => $mine()->whereNotIn('status', [Appointment::CANCELLED, Appointment::REJECTED]);
        $present = fn (Appointment $a) => (new AppointmentResource($a))->clinicView()->withTreatmentNotes()->resolve();

        $todays = $booked()->whereBetween('starts_at', $this->dayRange($today))->with(self::RELATIONS)->orderBy('starts_at')->get();

        $from = $today->addDay();
        $until = $today->addDays(self::UPCOMING_DAYS);
        $upcoming = $mine()->active()
            ->whereBetween('starts_at', [BusinessTime::utc($from), BusinessTime::utc($until->endOfDay())])
            ->with(self::RELATIONS)->orderBy('starts_at')->get();

        $pending = $mine()->whereIn('status', [Appointment::PENDING, Appointment::RESCHEDULE_REQUESTED])
            ->where('starts_at', '>=', now())
            ->with(self::RELATIONS)->orderBy('starts_at');

        $followUps = FollowUp::where('clinic_id', $clinic->id)->where('dentist_id', $dentist->id)->open()
            ->with('patient.user')->orderBy('due_on')->limit(self::LIST_LIMIT)->get();

        return $this->ok([
            'today' => $todays->map($present)->values(),
            'counts' => [
                'today' => $todays->count(),
                'today_confirmed' => $todays->where('status', Appointment::CONFIRMED)->count(),
                'pending' => (clone $pending)->count(),
                'active_patients' => $clinic->patients()
                    ->whereHas('appointments', fn ($q) => $q->where('clinic_id', $clinic->id)->where('dentist_id', $dentist->id))
                    ->count(),
                'upcoming' => $upcoming->count(),
            ],
            'upcoming_range' => ['from' => $from->toDateString(), 'to' => $until->toDateString()],
            'pending_requests' => $pending->limit(self::LIST_LIMIT)->get()->map($present)->values(),
            'upcoming_patients' => $upcoming->take(self::LIST_LIMIT)->map($present)->values(),
            'follow_ups_due' => $followUps->map(fn (FollowUp $f) => [
                'id' => $f->id,
                'patient' => $f->patient?->display_name,
                'due_on' => $f->due_on?->toDateString(),
                'priority' => $f->priority,
            ])->values(),
            'week' => $this->weekCounts($clinic, $dentist, $today),
        ]);
    }

    public function schedule(Request $request, Clinic $clinic)
    {
        return $this->ok($this->presentSchedule($request, $clinic, $this->dentist($request)));
    }

    public function profile(Request $request, Clinic $clinic)
    {
        return $this->ok($this->presentProfile($request, $clinic, $this->dentist($request)));
    }

    /** Their own details. Licence numbers stay with the clinic admin, who verifies them. */
    public function updateProfile(Request $request, Clinic $clinic)
    {
        $dentist = $this->dentist($request);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:30'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'website' => ['sometimes', 'nullable', 'string', 'max:255'],
            'specialization_id' => ['sometimes', 'nullable', 'integer', 'exists:specializations,id'],
            'secondary_specialization' => ['sometimes', 'nullable', 'string', 'max:255'],
            'education' => ['sometimes', 'nullable', 'string', 'max:255'],
            'years_experience' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:70'],
            'bio' => ['sometimes', 'nullable', 'string', 'max:2000'],
        ]);
        $own = array_flip(['website', 'specialization_id', 'secondary_specialization', 'education', 'years_experience', 'bio']);

        DB::transaction(function () use ($request, $dentist, $data, $own) {
            $dentist->update(array_intersect_key($data, $own));
            $this->membership($request)->forceFill(array_intersect_key($data, array_flip(['phone', 'address'])))->save();
            if (isset($data['name'])) {
                $request->user()->update(['name' => $data['name']]);
            }
        });

        $this->audit->record('dentist.updated', $dentist, ['fields' => array_keys($data), 'by' => 'dentist'], $clinic->id);

        return $this->ok($this->presentProfile($request, $clinic, $dentist->fresh()), 'Profile updated');
    }

    private function dentist(Request $request): Dentist
    {
        return $this->actingDentist($request) ?? throw new NotFoundHttpException('Dentist profile not found.');
    }

    private function dayRange(CarbonInterface $day): array
    {
        return [BusinessTime::utc($day), BusinessTime::utc($day->endOfDay())];
    }

    /** Booked visits per day, Monday to Sunday of this week. */
    private function weekCounts(Clinic $clinic, Dentist $dentist, CarbonImmutable $today): array
    {
        $monday = $today->startOfWeek(CarbonInterface::MONDAY);
        $day = BusinessTime::daySql('starts_at');

        $totals = $clinic->appointments()->where('dentist_id', $dentist->id)
            ->whereNotIn('status', [Appointment::CANCELLED, Appointment::REJECTED])
            ->whereBetween('starts_at', [BusinessTime::utc($monday), BusinessTime::utc($monday->addDays(6)->endOfDay())])
            ->selectRaw("{$day} AS day, COUNT(*) AS total")
            ->groupByRaw($day)
            ->toBase()
            ->pluck('total', 'day');

        return collect(range(0, 6))->map(function (int $offset) use ($monday, $totals) {
            $date = $monday->addDays($offset)->toDateString();

            return ['date' => $date, 'total' => (int) ($totals[$date] ?? 0)];
        })->all();
    }

    private function presentSchedule(Request $request, Clinic $clinic, Dentist $dentist): array
    {
        $schedules = $dentist->schedules()->whereIn('branch_id', $clinic->branches()->select('id'))->with('branch:id,name')->get();
        $starts = $schedules->map(fn ($s) => substr($s->starts_at, 0, 5));
        $ends = $schedules->map(fn ($s) => substr($s->ends_at, 0, 5));
        $minutes = $schedules->map(fn ($s) => CarbonImmutable::parse($s->starts_at)->diffInMinutes(CarbonImmutable::parse($s->ends_at)))->max() ?? 0;

        $monday = BusinessTime::today()->startOfWeek(CarbonInterface::MONDAY);
        $appointments = $clinic->appointments()->where('dentist_id', $dentist->id)
            ->whereNotIn('status', [Appointment::CANCELLED, Appointment::REJECTED])
            ->whereBetween('starts_at', [BusinessTime::utc($monday), BusinessTime::utc($monday->addDays(6)->endOfDay())])
            ->orderBy('starts_at')
            ->get(['id', 'starts_at', 'ends_at', 'patient_name', 'status']);

        $week = collect(range(0, 6))->map(fn (int $offset) => $monday->addDays($offset))
            ->map(fn (CarbonImmutable $date) => [
                'date' => $date->toDateString(),
                'appointments' => $appointments
                    ->filter(fn ($a) => BusinessTime::local($a->starts_at)->toDateString() === $date->toDateString())
                    ->map(fn ($a) => ['id' => $a->id, 'starts_at' => BusinessTime::iso($a->starts_at), 'patient' => $a->patient_name])
                    ->values(),
            ]);

        $days = $schedules->pluck('day_of_week')->unique()->sort()->values();

        return [
            'days' => $days,
            'starts_at' => $starts->min(),
            'ends_at' => $ends->max(),
            // Hours are kept per branch, and a change proposes hours for one of them.
            'branches' => $clinic->branches()->orderByDesc('is_main')->orderBy('id')->get(['id', 'name'])->map(function ($branch) use ($schedules) {
                $here = $schedules->where('branch_id', $branch->id);

                return [
                    'id' => $branch->id,
                    'name' => $branch->name,
                    'days' => $here->pluck('day_of_week')->map(fn ($day) => (int) $day)->sort()->values(),
                    'starts_at' => $here->map(fn ($s) => substr($s->starts_at, 0, 5))->min(),
                    'ends_at' => $here->map(fn ($s) => substr($s->ends_at, 0, 5))->max(),
                ];
            })->values(),
            'week' => $week->values(),
            // Proposed hours waiting for approval, and the last answer, so a decline is not missed.
            'pending_change' => $this->changeSummary($clinic, $dentist, [ScheduleChangeRequest::PENDING]),
            'last_decision' => $this->changeSummary($clinic, $dentist, [ScheduleChangeRequest::APPROVED, ScheduleChangeRequest::REJECTED]),
            'summary' => [
                'working_days' => $days->count(),
                'max_daily_slots' => (int) floor($minutes / max(1, (int) config('booking.slot_minutes'))),
                'clinic' => $clinic->name,
                'status' => $dentist->is_active && $this->membership($request)->status === ClinicMembership::STATUS_ACTIVE ? 'active' : 'inactive',
            ],
        ];
    }

    private function changeSummary(Clinic $clinic, Dentist $dentist, array $statuses): ?array
    {
        $change = ScheduleChangeRequest::where('clinic_id', $clinic->id)->where('dentist_id', $dentist->id)
            ->whereIn('status', $statuses)
            ->with('branch:id,name')
            ->latest('updated_at')->latest('id')
            ->first();

        return $change ? [
            'id' => $change->id,
            'branch' => $change->branch?->name,
            'days' => $change->days,
            'starts_at' => $change->starts_at,
            'ends_at' => $change->ends_at,
            'note' => $change->note,
            'status' => $change->status,
            'review_note' => $change->review_note,
            'reviewed_at' => BusinessTime::iso($change->reviewed_at),
            'created_at' => BusinessTime::iso($change->created_at),
        ] : null;
    }

    private function presentProfile(Request $request, Clinic $clinic, Dentist $dentist): array
    {
        $dentist->loadMissing('specialization');
        $membership = $this->membership($request);
        $user = $request->user();

        return [
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $membership->phone,
            'address' => $membership->address,
            'website' => $dentist->website,
            'specialization' => $dentist->specialization?->name,
            'specialization_id' => $dentist->specialization_id,
            'secondary_specialization' => $dentist->secondary_specialization,
            'education' => $dentist->education,
            'years_experience' => $dentist->years_experience,
            'bio' => $dentist->bio,
            'license_number' => $dentist->license_number,
            'ptr_number' => $dentist->ptr_number,
            's2_number' => $dentist->s2_number,
            'clinic_name' => $clinic->name,
            'status' => $dentist->is_active && $membership->status === ClinicMembership::STATUS_ACTIVE ? 'active' : 'inactive',
            'specializations' => Specialization::orderBy('name')->get(['id', 'name']),
        ];
    }
}
