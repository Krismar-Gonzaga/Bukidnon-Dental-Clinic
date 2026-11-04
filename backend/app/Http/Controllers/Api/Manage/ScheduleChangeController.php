<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Models\Appointment;
use App\Models\Clinic;
use App\Models\ClinicMembership;
use App\Models\Dentist;
use App\Models\ScheduleChangeRequest;
use App\Notifications\PortalNotice;
use App\Services\AuditLogger;
use App\Support\BusinessTime;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * A dentist's own schedule changes need approval: they propose days and hours, and those who
 * manage schedules approve or decline. Until then bookings keep following the current hours.
 */
class ScheduleChangeController extends Controller
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    /** One open request per dentist, so an approver never has to work out which one is current. */
    public function store(Request $request, Clinic $clinic)
    {
        $dentist = $this->dentist($request);
        $data = $request->validate([
            'days' => ['present', 'array', 'max:7'],
            'days.*' => ['integer', 'between:0,6', 'distinct'],
            'starts_at' => ['required', 'date_format:H:i'],
            'ends_at' => ['required', 'date_format:H:i', 'after:starts_at'],
            'note' => ['nullable', 'string', 'max:500'],
            'branch_id' => ['nullable', 'integer', Rule::in($clinic->branches()->pluck('id'))],
        ]);

        $branchId = $data['branch_id']
            ?? $dentist->schedules()->whereIn('branch_id', $clinic->branches()->select('id'))->value('branch_id')
            ?? $clinic->branches()->value('id');
        if (! $branchId) {
            return $this->fail('Add a clinic branch before setting a schedule.', 422);
        }
        if ($this->requests($clinic)->pending()->where('dentist_id', $dentist->id)->exists()) {
            return $this->fail('You already have a change waiting for approval. Cancel it to send a different one.', 409);
        }

        $days = collect($data['days'])->map(fn ($day) => (int) $day)->sort()->values()->all();
        if ($clash = $this->clashWithOtherBranch($clinic, $dentist, $branchId, $days)) {
            return $this->fail("You already work at {$clash}. Change that branch's hours first.", 422, ['days' => ["You already work at {$clash}."]]);
        }
        if ($this->matchesCurrent($dentist, $branchId, $days, $data['starts_at'], $data['ends_at'])) {
            return $this->fail('These are already your working days and hours.', 422);
        }

        $change = new ScheduleChangeRequest([
            'days' => $days,
            'starts_at' => $data['starts_at'],
            'ends_at' => $data['ends_at'],
            'note' => $data['note'] ?? null,
        ]);
        $change->clinic_id = $clinic->id;
        $change->dentist_id = $dentist->id;
        $change->branch_id = $branchId;
        $change->requested_by = $request->user()->id;
        $change->status = ScheduleChangeRequest::PENDING;
        $change->save();

        $this->audit->record('dentist.schedule_change_submitted', $dentist, clinicId: $clinic->id);
        $this->notifyApprovers($clinic, new PortalNotice(
            'schedule',
            'Schedule approval needed',
            "{$request->user()->name} asked to change their working days and hours.",
            'schedule_updates',
            ['type' => 'clinic_dentist', 'id' => $dentist->id, 'clinic_id' => $clinic->id],
        ));

        return $this->ok($this->present($change), 'Sent for approval', 201);
    }

    /** The dentist changed their mind, before anyone decided. */
    public function cancel(Request $request, Clinic $clinic, int $changeId)
    {
        $dentist = $this->dentist($request);
        $change = $this->requests($clinic)->pending()->where('dentist_id', $dentist->id)->findOrFail($changeId);

        $change->status = ScheduleChangeRequest::CANCELLED;
        $change->save();
        $this->audit->record('dentist.schedule_change_cancelled', $dentist, clinicId: $clinic->id);

        return $this->ok(message: 'Request cancelled');
    }

    /** A message to the administrators, with no proposed hours to approve. */
    public function message(Request $request, Clinic $clinic)
    {
        $data = $request->validate(['message' => ['required', 'string', 'max:1000']]);
        $dentist = $this->dentist($request);

        $this->notifyApprovers($clinic, new PortalNotice(
            'schedule',
            'Schedule change request',
            "{$request->user()->name}: {$data['message']}",
            'schedule_updates',
            ['type' => 'clinic_dentist', 'id' => $dentist->id, 'clinic_id' => $clinic->id],
        ));
        $this->audit->record('dentist.schedule_change_requested', $dentist, clinicId: $clinic->id);

        return $this->ok(message: 'Request sent to the clinic administrator');
    }

    public function index(Request $request, Clinic $clinic)
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in(ScheduleChangeRequest::STATUSES)],
            'dentist_id' => ['nullable', 'integer'],
        ]);

        $changes = $this->requests($clinic)
            ->where('status', $data['status'] ?? ScheduleChangeRequest::PENDING)
            ->when($data['dentist_id'] ?? null, fn ($q, $id) => $q->where('dentist_id', $id))
            ->with(['dentist.user', 'branch', 'reviewer'])
            ->oldest()
            ->limit(50)
            ->get();

        return $this->ok($changes->map(fn (ScheduleChangeRequest $change) => $this->present($change))->values());
    }

    /** Applies the hours at that branch; other branches keep theirs and booked visits stay put. */
    public function approve(Request $request, Clinic $clinic, int $changeId)
    {
        $change = DB::transaction(function () use ($request, $clinic, $changeId) {
            $change = $this->lockedPending($request, $clinic, $changeId);
            $dentist = $change->dentist;

            // Their other hours may have changed since this was sent.
            if ($clash = $this->clashWithOtherBranch($clinic, $dentist, $change->branch_id, $change->days)) {
                throw new ConflictHttpException("This dentist now works at {$clash}. Decline this request, or change that branch's hours first.");
            }

            $dentist->schedules()->where('branch_id', $change->branch_id)->delete();
            foreach ($change->days as $day) {
                $dentist->schedules()->create([
                    'branch_id' => $change->branch_id,
                    'day_of_week' => $day,
                    'starts_at' => $change->starts_at,
                    'ends_at' => $change->ends_at,
                ]);
            }

            return $this->decide($change, ScheduleChangeRequest::APPROVED, $request);
        });

        $this->audit->record('dentist.schedule_change_approved', $change->dentist, clinicId: $clinic->id);
        $this->audit->record('dentist.schedule_updated', $change->dentist, ['by' => 'approval'], $clinic->id);
        $change->dentist->user?->notify(new PortalNotice(
            'schedule',
            'Schedule change approved',
            'Your new working days and hours are now in effect.',
            'schedule_updates',
            ['type' => 'dentist_schedule', 'clinic_id' => $clinic->id],
        ));

        return $this->ok($this->present($change->fresh(['dentist.user', 'branch', 'reviewer'])), 'Schedule change approved');
    }

    /** The reason goes to the dentist, who would otherwise have to guess what to change. */
    public function reject(Request $request, Clinic $clinic, int $changeId)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);

        $change = DB::transaction(function () use ($request, $clinic, $changeId, $data) {
            $change = $this->lockedPending($request, $clinic, $changeId);
            $change->review_note = $data['reason'];

            return $this->decide($change, ScheduleChangeRequest::REJECTED, $request);
        });

        $this->audit->record('dentist.schedule_change_rejected', $change->dentist, clinicId: $clinic->id);
        $change->dentist->user?->notify(new PortalNotice(
            'schedule',
            'Schedule change not approved',
            "Your working days and hours stay the same. Reason: {$data['reason']}",
            'schedule_updates',
            ['type' => 'dentist_schedule', 'clinic_id' => $clinic->id],
        ));

        return $this->ok($this->present($change->fresh(['dentist.user', 'branch', 'reviewer'])), 'Schedule change declined');
    }

    private function lockedPending(Request $request, Clinic $clinic, int $changeId): ScheduleChangeRequest
    {
        $change = $this->requests($clinic)->lockForUpdate()->findOrFail($changeId);

        if ($change->status !== ScheduleChangeRequest::PENDING) {
            throw new ConflictHttpException('This request has already been decided.');
        }
        if ($change->requested_by === $request->user()->id) {
            throw new ConflictHttpException('Someone else has to review your own schedule change.');
        }

        return $change;
    }

    private function decide(ScheduleChangeRequest $change, string $status, Request $request): ScheduleChangeRequest
    {
        $change->status = $status;
        $change->reviewed_by = $request->user()->id;
        $change->reviewed_at = now();
        $change->save();

        return $change;
    }

    private function requests(Clinic $clinic)
    {
        return ScheduleChangeRequest::where('clinic_id', $clinic->id);
    }

    private function dentist(Request $request): Dentist
    {
        return $this->actingDentist($request) ?? throw new NotFoundHttpException('Dentist profile not found.');
    }

    /** "Valencia Branch on Tue, Thu" when these days are already worked at another branch. */
    private function clashWithOtherBranch(Clinic $clinic, Dentist $dentist, int $branchId, array $days): ?string
    {
        $clash = $dentist->schedules()
            ->whereIn('branch_id', $clinic->branches()->select('id'))
            ->where('branch_id', '!=', $branchId)
            ->whereIn('day_of_week', $days)
            ->with('branch:id,name')
            ->orderBy('day_of_week')
            ->get();

        if ($clash->isEmpty()) {
            return null;
        }

        $names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        $first = $clash->first()->branch_id;
        $here = $clash->where('branch_id', $first);

        return $here->first()->branch?->name.' on '.$here->map(fn ($s) => $names[$s->day_of_week])->implode(', ');
    }

    private function matchesCurrent(Dentist $dentist, int $branchId, array $days, string $start, string $end): bool
    {
        $current = $dentist->schedules()->where('branch_id', $branchId)->get();

        return $current->pluck('day_of_week')->map(fn ($day) => (int) $day)->sort()->values()->all() === $days
            && $current->every(fn ($s) => substr($s->starts_at, 0, 5) === $start && substr($s->ends_at, 0, 5) === $end);
    }

    /** Everyone who can decide, including staff who were given the schedules permission. */
    private function notifyApprovers(Clinic $clinic, PortalNotice $notice): void
    {
        $approvers = ClinicMembership::where('clinic_id', $clinic->id)
            ->where('status', ClinicMembership::STATUS_ACTIVE)
            ->with('user')
            ->get()
            ->filter(fn (ClinicMembership $membership) => $membership->grants('clinic.schedules.manage'))
            ->pluck('user')
            ->filter();

        Notification::send($approvers, $notice);
    }

    private function present(ScheduleChangeRequest $change): array
    {
        $change->loadMissing(['dentist.user', 'branch', 'reviewer']);
        $current = $change->dentist->schedules()->where('branch_id', $change->branch_id)->get();

        return [
            'id' => $change->id,
            'dentist' => ['id' => $change->dentist_id, 'name' => $change->dentist->user?->name],
            'branch' => ['id' => $change->branch_id, 'name' => $change->branch?->name],
            'days' => $change->days,
            'starts_at' => $change->starts_at,
            'ends_at' => $change->ends_at,
            'note' => $change->note,
            'status' => $change->status,
            'review_note' => $change->review_note,
            'reviewed_by' => $change->reviewer?->name,
            'reviewed_at' => BusinessTime::iso($change->reviewed_at),
            'created_at' => BusinessTime::iso($change->created_at),
            'current' => [
                'days' => $current->pluck('day_of_week')->map(fn ($day) => (int) $day)->sort()->values(),
                'starts_at' => $current->map(fn ($s) => substr($s->starts_at, 0, 5))->min(),
                'ends_at' => $current->map(fn ($s) => substr($s->ends_at, 0, 5))->max(),
            ],
            // What the approver should know first: approving does not move these visits.
            'outside_hours' => $change->status === ScheduleChangeRequest::PENDING ? $this->visitsOutside($change) : null,
        ];
    }

    private function visitsOutside(ScheduleChangeRequest $change): int
    {
        return Appointment::where('dentist_id', $change->dentist_id)
            ->where('clinic_id', $change->clinic_id)
            ->where('branch_id', $change->branch_id)
            ->active()
            ->where('starts_at', '>', now())
            ->get(['id', 'starts_at', 'ends_at'])
            ->filter(function ($appointment) use ($change) {
                $start = BusinessTime::local($appointment->starts_at);

                return ! in_array($start->dayOfWeek, $change->days, true)
                    || $start->format('H:i') < $change->starts_at
                    || BusinessTime::local($appointment->ends_at)->format('H:i') > $change->ends_at;
            })
            ->count();
    }
}
