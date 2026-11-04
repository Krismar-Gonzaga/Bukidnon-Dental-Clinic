<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\ClinicHoliday;
use App\Models\ScheduleBlock;
use App\Services\AuditLogger;
use App\Support\BusinessTime;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Holidays (whole days) and blocked time ranges. */
class ScheduleController extends Controller
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function holidays(Request $request, Clinic $clinic)
    {
        return $this->ok($clinic->holidays()
            ->where('date', '>=', BusinessTime::today()->subDays(30)->toDateString())
            ->orderBy('date')
            ->get(['id', 'branch_id', 'date', 'name']));
    }

    public function storeHoliday(Request $request, Clinic $clinic)
    {
        $data = $request->validate([
            'date' => ['required', 'date_format:Y-m-d'],
            'name' => ['required', 'string', 'max:255'],
            'branch_id' => ['nullable', 'integer', Rule::exists('clinic_branches', 'id')->where('clinic_id', $clinic->id)],
        ]);

        $holiday = $clinic->holidays()->create($data);
        $this->audit->record('schedule.holiday_added', $holiday, clinicId: $clinic->id);

        return $this->ok($holiday, 'Holiday added', 201);
    }

    public function destroyHoliday(Clinic $clinic, ClinicHoliday $holiday)
    {
        $holiday->delete();
        $this->audit->record('schedule.holiday_removed', $holiday, clinicId: $clinic->id);

        return $this->ok(message: 'Holiday removed');
    }

    public function blocks(Request $request, Clinic $clinic)
    {
        return $this->ok($clinic->scheduleBlocks()
            ->where('ends_at', '>=', BusinessTime::utc(BusinessTime::today()))
            ->orderBy('starts_at')
            ->get()
            ->map(fn (ScheduleBlock $b) => [
                'id' => $b->id,
                'branch_id' => $b->branch_id,
                'dentist_id' => $b->dentist_id,
                'starts_at' => BusinessTime::iso($b->starts_at),
                'ends_at' => BusinessTime::iso($b->ends_at),
                'reason' => $b->reason,
            ]));
    }

    public function storeBlock(Request $request, Clinic $clinic)
    {
        $data = $request->validate([
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'reason' => ['nullable', 'string', 'max:255'],
            'branch_id' => ['nullable', 'integer', Rule::exists('clinic_branches', 'id')->where('clinic_id', $clinic->id)],
            'dentist_id' => ['nullable', 'integer'],
        ]);

        if (isset($data['dentist_id']) && ! $clinic->dentistProfiles()->whereKey($data['dentist_id'])->exists()) {
            return $this->fail('That dentist does not work at this clinic.', 422, ['dentist_id' => ['That dentist does not work at this clinic.']]);
        }

        $block = new ScheduleBlock([
            ...$data,
            'starts_at' => BusinessTime::utc(BusinessTime::parse($data['starts_at'])),
            'ends_at' => BusinessTime::utc(BusinessTime::parse($data['ends_at'])),
        ]);
        $block->clinic_id = $clinic->id;
        $block->created_by = $request->user()->id;
        $block->save();

        $this->audit->record('schedule.block_added', $block, clinicId: $clinic->id);

        return $this->ok(['id' => $block->id], 'Time blocked', 201);
    }

    public function destroyBlock(Clinic $clinic, ScheduleBlock $scheduleBlock)
    {
        $scheduleBlock->delete();
        $this->audit->record('schedule.block_removed', $scheduleBlock, clinicId: $clinic->id);

        return $this->ok(message: 'Block removed');
    }
}
