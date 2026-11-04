<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Clinic;
use App\Models\ClinicMembership;
use App\Services\AuditLogger;
use App\Support\AuditPresenter;
use App\Support\CsvExport;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/** Clinic settings, the position permission table, and the clinic's own audit log. */
class ClinicSettingsController extends Controller
{
    private const AUDIT_PER_PAGE = 20;

    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function show(Clinic $clinic)
    {
        return $this->ok([
            ...$clinic->settingsValues(),
            'timezone' => config('booking.timezone'),
            'slot_options' => Clinic::SLOT_OPTIONS,
        ]);
    }

    public function update(Request $request, Clinic $clinic)
    {
        $data = $request->validate([
            'slot_minutes' => ['sometimes', 'integer', Rule::in(Clinic::SLOT_OPTIONS)],
            'allow_online_booking' => ['sometimes', 'boolean'],
            'require_approval' => ['sometimes', 'boolean'],
            'send_reminders' => ['sometimes', 'boolean'],
            'allow_patient_cancel' => ['sometimes', 'boolean'],
        ]);

        $clinic->settings = [...($clinic->settings ?? []), ...$data];
        $clinic->save();
        $this->audit->record('clinic.settings_updated', $clinic, ['fields' => array_keys($data)], $clinic->id);

        return $this->ok($clinic->settingsValues(), 'Settings saved');
    }

    /** What each staff position may open. Clinical records can never be granted here. */
    private const ROLE_LABELS = ['clinic_admin' => 'Admin', 'staff' => 'Staff', 'inventory_staff' => 'Inventory Staff', 'dentist' => 'Dentist', 'system_admin' => 'System Admin'];

    public function rolePermissions(Clinic $clinic)
    {
        return $this->ok([
            'modules' => collect(array_keys(config('permissions.staff_modules')))->map(fn (string $key) => ['key' => $key, 'label' => ucfirst($key)])->values(),
            'positions' => collect(config('permissions.staff_positions'))->map(fn (array $position, string $key) => [
                'key' => $key,
                'label' => $position['label'],
                'modules' => $clinic->positionModules($key),
            ])->values(),
        ]);
    }

    public function updateRolePermissions(Request $request, Clinic $clinic)
    {
        $positions = array_keys(config('permissions.staff_positions'));
        $data = $request->validate([
            'positions' => ['required', 'array:'.implode(',', $positions)],
            'positions.*' => ['array'],
            'positions.*.*' => [Rule::in(array_keys(config('permissions.staff_modules')))],
        ]);

        $clinic->settings = [...($clinic->settings ?? []), 'position_modules' => array_map('array_values', $data['positions'])];
        $clinic->save();
        $this->audit->record('clinic.permissions_updated', $clinic, ['positions' => array_keys($data['positions'])], $clinic->id);

        return $this->rolePermissions($clinic);
    }

    public function auditLogs(Request $request, Clinic $clinic)
    {
        $page = AuditLog::where('clinic_id', $clinic->id)->orderByDesc('id')->paginate($this->perPage($request, self::AUDIT_PER_PAGE));
        $lookups = AuditPresenter::lookups(collect($page->items()));

        return $this->paginated($page, fn (AuditLog $log) => $this->presentLog($log, $lookups));
    }

    public function exportAuditLogs(Request $request, Clinic $clinic)
    {
        $this->audit->record('audit.exported', metadata: ['scope' => 'clinic'], clinicId: $clinic->id);

        return $this->auditCsv($request, $clinic);
    }

    /** A 5-minute signed link for the mobile app, which opens files in the phone's browser. */
    public function auditExportLink(Clinic $clinic)
    {
        $this->audit->record('audit.exported', metadata: ['scope' => 'clinic'], clinicId: $clinic->id);

        return $this->ok(['url' => URL::temporarySignedRoute('clinic-audit-logs.download', now()->addMinutes(5), ['clinic' => $clinic->id], absolute: false)]);
    }

    /** Reached through the signed link above; the request that made the link was logged. */
    public function auditCsv(Request $request, Clinic $clinic)
    {
        $query = AuditLog::where('clinic_id', $clinic->id)->orderByDesc('id')->limit(CsvExport::limit($request));

        $rows = function () use ($query) {
            foreach ($query->get()->chunk(500) as $chunk) {
                $lookups = AuditPresenter::lookups($chunk);
                foreach ($chunk as $log) {
                    $row = $this->presentLog($log, $lookups);
                    yield [$row['created_at'], $row['user_name'], $row['user_role'], $row['label'], $row['category']];
                }
            }
        };

        return CsvExport::download("clinic-{$clinic->id}-audit-log.csv", ['When', 'Who', 'Role', 'Action', 'Category'], $rows());
    }

    /** Only what a clinic administrator needs: no IP addresses or browser details. */
    private function presentLog(AuditLog $log, array $lookups): array
    {
        $row = AuditPresenter::present($log, $lookups);

        return [
            'id' => $row['id'],
            'created_at' => $row['created_at'],
            'user_name' => $row['user_name'] ?? null,
            'user_role' => isset($row['user_role']) ? (self::ROLE_LABELS[$row['user_role']] ?? Str::headline($row['user_role'])) : null,
            'label' => $row['label'],
            'detail' => $row['detail'] ?? null,
            'category' => isset($row['category']) ? Str::headline($row['category']) : null,
        ];
    }
}
