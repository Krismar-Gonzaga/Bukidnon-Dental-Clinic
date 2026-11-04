<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use App\Services\PlatformReports;
use App\Support\BusinessTime;
use App\Support\CsvExport;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Reports & Analytics. Aggregates only, so exporting needs no password check; it is recorded. */
class ReportController extends Controller
{
    public function __construct(
        private readonly PlatformReports $reports,
        private readonly AuditLogger $audit,
    ) {
    }

    public function show(Request $request)
    {
        $data = $request->validate(['month' => ['nullable', 'date_format:Y-m']]);

        return $this->ok($this->reports->build($this->reports->month($data['month'] ?? null)));
    }

    /** CSV of one report, or every report when no section is named (the Overview tab). */
    public function export(Request $request)
    {
        $data = $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
            'section' => ['nullable', Rule::in(PlatformReports::SECTIONS)],
        ]);
        $month = $this->reports->month($data['month'] ?? null);
        $sections = isset($data['section']) ? [$data['section']] : PlatformReports::SECTIONS;

        $this->audit->record('report.exported', metadata: ['month' => $month->format('Y-m'), 'section' => $data['section'] ?? 'all']);

        $rows = function () use ($sections, $month) {
            foreach ($sections as $section) {
                foreach ($this->reports->section($section, $month) as $row) {
                    yield [ucfirst($section), $row['metric'], $row['current'], $row['previous'], $row['change']];
                }
            }
        };

        return CsvExport::download(
            'platform-report-'.$month->format('Y-m').'-'.BusinessTime::now()->format('His').'.csv',
            ['Report', 'Metric', $month->format('F Y'), $month->subMonthNoOverflow()->format('F Y'), 'Change'],
            $rows(),
        );
    }
}
