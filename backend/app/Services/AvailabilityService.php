<?php

namespace App\Services;

use App\Models\Appointment;
use App\Models\Clinic;
use App\Models\ClinicBranch;
use App\Models\ClinicHoliday;
use App\Models\Dentist;
use App\Models\ScheduleBlock;
use App\Models\ServiceRate;
use App\Support\BusinessTime;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * Computes bookable time slots. A slot is offered only when ALL hold:
 *  - inside the booking window (minimum notice .. max days ahead)
 *  - the branch is active, open that weekday, and not on holiday
 *  - inside the dentist's schedule for that branch and weekday
 *  - long enough for the service's duration
 *  - not overlapping a schedule block (clinic, branch or dentist level)
 *  - not overlapping the dentist's active appointments
 *
 * The same check is used to validate bookings and reschedules, so clients
 * can never book a time this service would not offer.
 */
class AvailabilityService
{
    /**
     * @return Collection<int, array{starts_at: CarbonImmutable, ends_at: CarbonImmutable, dentist_id: int, branch_id: int}>
     */
    public function slots(
        Clinic $clinic,
        CarbonImmutable $date,
        ServiceRate $service,
        ?Dentist $dentist = null,
        ?ClinicBranch $branch = null,
        ?int $ignoreAppointmentId = null,
    ): Collection {
        $day = BusinessTime::parse($date->toDateString());
        $now = BusinessTime::now();
        $earliest = $now->addMinutes(config('booking.minimum_notice_minutes'));
        $latest = $now->addDays(config('booking.max_days_ahead'))->endOfDay();

        if ($day->endOfDay()->lt($earliest) || $day->gt($latest)) {
            return collect();
        }

        $dentists = $dentist
            ? collect([$dentist])
            : $clinic->dentistProfiles()->get();

        if ($dentists->isEmpty()) {
            return collect();
        }

        $holidayBranchIds = ClinicHoliday::where('clinic_id', $clinic->id)
            ->whereDate('date', $day->toDateString())
            ->get();
        $clinicWideHoliday = $holidayBranchIds->contains(fn ($h) => $h->branch_id === null);
        if ($clinicWideHoliday) {
            return collect();
        }
        $closedBranchIds = $holidayBranchIds->pluck('branch_id')->all();

        $dayStart = BusinessTime::utc($day->startOfDay());
        $dayEnd = BusinessTime::utc($day->endOfDay());

        $blocks = ScheduleBlock::where('clinic_id', $clinic->id)
            ->where('starts_at', '<', $dayEnd)
            ->where('ends_at', '>', $dayStart)
            ->get();

        $appointments = Appointment::active()
            ->whereIn('dentist_id', $dentists->pluck('id'))
            ->when($ignoreAppointmentId, fn ($q) => $q->whereKeyNot($ignoreAppointmentId))
            ->where('starts_at', '<', $dayEnd)
            ->where('ends_at', '>', $dayStart)
            ->get(['id', 'dentist_id', 'starts_at', 'ends_at']);

        $step = config('booking.slot_minutes');
        $duration = max(1, (int) $service->duration_minutes);
        $slots = collect();

        foreach ($dentists as $candidate) {
            $schedules = $candidate->schedules()
                ->where('day_of_week', $day->dayOfWeek)
                ->when($branch, fn ($q) => $q->where('branch_id', $branch->id))
                ->whereHas('branch', fn ($q) => $q->where('clinic_id', $clinic->id)->where('is_active', true))
                ->with(['branch.operatingHours' => fn ($q) => $q->where('day_of_week', $day->dayOfWeek)])
                ->get();

            foreach ($schedules as $schedule) {
                if (in_array($schedule->branch_id, $closedBranchIds, true)) {
                    continue;
                }

                $hours = $schedule->branch->operatingHours->first();
                if (! $hours) {
                    continue; // branch closed that weekday
                }

                $windowStart = max($this->at($day, $schedule->starts_at), $this->at($day, $hours->opens_at));
                $windowEnd = min($this->at($day, $schedule->ends_at), $this->at($day, $hours->closes_at));

                for ($start = $windowStart; $start->addMinutes($duration)->lte($windowEnd); $start = $start->addMinutes($step)) {
                    $end = $start->addMinutes($duration);

                    if ($start->lt($earliest)) {
                        continue;
                    }

                    $blocked = $blocks->contains(fn (ScheduleBlock $b) => $b->starts_at->lt($end) && $b->ends_at->gt($start)
                        && ($b->branch_id === null || $b->branch_id === $schedule->branch_id)
                        && ($b->dentist_id === null || $b->dentist_id === $candidate->id));

                    $taken = $appointments->contains(fn (Appointment $a) => $a->dentist_id === $candidate->id
                        && $a->starts_at->lt($end) && $a->ends_at->gt($start));

                    if (! $blocked && ! $taken) {
                        $slots->push([
                            'starts_at' => $start,
                            'ends_at' => $end,
                            'dentist_id' => $candidate->id,
                            'branch_id' => $schedule->branch_id,
                        ]);
                    }
                }
            }
        }

        return $slots->sortBy([['starts_at', 'asc'], ['dentist_id', 'asc']])->values();
    }

    /**
     * Dates in [from, to] on which the dentist (or any clinic dentist) works
     * long enough for the service at an open, non-holiday branch, inside the
     * booking window. Cheap: does not look at existing bookings, so a date
     * may still turn out fully booked when its slots are fetched.
     *
     * @return list<string> Y-m-d dates
     */
    public function availableDates(
        Clinic $clinic,
        CarbonImmutable $from,
        CarbonImmutable $to,
        ServiceRate $service,
        ?Dentist $dentist = null,
    ): array {
        $today = BusinessTime::today();
        $from = BusinessTime::parse($from->toDateString())->max($today);
        $to = BusinessTime::parse($to->toDateString())->min($today->addDays(config('booking.max_days_ahead')));
        if ($from->gt($to)) {
            return [];
        }

        $dentistIds = $dentist ? [$dentist->id] : $clinic->dentistProfiles()->pluck('id')->all();
        $duration = max(1, (int) $service->duration_minutes);

        $schedules = \App\Models\DentistSchedule::whereIn('dentist_id', $dentistIds)
            ->whereHas('branch', fn ($q) => $q->where('clinic_id', $clinic->id)->where('is_active', true))
            ->with('branch.operatingHours')
            ->get();

        $holidays = ClinicHoliday::where('clinic_id', $clinic->id)
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->get();

        $dates = [];
        for ($day = $from; $day->lte($to); $day = $day->addDay()) {
            $date = $day->toDateString();
            $closed = $holidays->filter(fn ($h) => $h->date->toDateString() === $date);
            if ($closed->contains(fn ($h) => $h->branch_id === null)) {
                continue;
            }

            $works = $schedules->contains(function ($schedule) use ($day, $duration, $closed) {
                if ($schedule->day_of_week !== $day->dayOfWeek || $closed->contains('branch_id', $schedule->branch_id)) {
                    return false;
                }
                $hours = $schedule->branch->operatingHours->firstWhere('day_of_week', $day->dayOfWeek);
                if (! $hours) {
                    return false;
                }
                $start = max($this->at($day, $schedule->starts_at), $this->at($day, $hours->opens_at));
                $end = min($this->at($day, $schedule->ends_at), $this->at($day, $hours->closes_at));

                return $start->addMinutes($duration)->lte($end);
            });

            if ($works) {
                $dates[] = $date;
            }
        }

        return $dates;
    }

    public function isBookable(
        Clinic $clinic,
        CarbonImmutable $start,
        ServiceRate $service,
        Dentist $dentist,
        ClinicBranch $branch,
        ?int $ignoreAppointmentId = null,
    ): bool {
        $local = BusinessTime::local($start);

        return $this->slots($clinic, $local->startOfDay(), $service, $dentist, $branch, $ignoreAppointmentId)
            ->contains(fn (array $slot) => $slot['starts_at']->equalTo($local));
    }

    private function at(CarbonImmutable $day, string $time): CarbonImmutable
    {
        [$h, $m] = array_map('intval', explode(':', $time));

        return $day->setTime($h, $m);
    }
}
