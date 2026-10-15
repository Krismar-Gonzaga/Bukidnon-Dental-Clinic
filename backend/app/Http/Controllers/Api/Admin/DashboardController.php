<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Clinic;
use App\Models\ClinicApplication;
use App\Models\ReviewReport;
use App\Models\User;
use App\Support\BusinessTime;

/** Platform summary. Aggregates only — no patient-level data. */
class DashboardController extends Controller
{
    public function __invoke()
    {
        return $this->ok([
            'clinics' => [
                'total' => Clinic::count(),
                'listed' => Clinic::publiclyListed()->count(),
                'suspended' => Clinic::where('status', Clinic::STATUS_SUSPENDED)->count(),
            ],
            'applications' => [
                'pending' => ClinicApplication::where('status', ClinicApplication::PENDING)->count(),
                'under_review' => ClinicApplication::where('status', ClinicApplication::UNDER_REVIEW)->count(),
                'approved' => ClinicApplication::where('status', ClinicApplication::APPROVED)->count(),
                'rejected' => ClinicApplication::where('status', ClinicApplication::REJECTED)->count(),
            ],
            'users' => User::selectRaw('role, COUNT(*) as total')->groupBy('role')->pluck('total', 'role'),
            'open_review_reports' => ReviewReport::where('status', ReviewReport::STATUS_OPEN)->count(),
            'recent_activity' => AuditLog::where('action', 'like', 'admin.%')
                ->orWhere('action', 'like', 'clinic_application.%')
                ->orWhere('action', 'like', 'clinic.suspended')
                ->orderByDesc('id')->limit(10)->get()
                ->map(fn ($log) => [
                    'action' => $log->action,
                    'subject_type' => $log->subject_type,
                    'subject_id' => $log->subject_id,
                    'created_at' => BusinessTime::iso($log->created_at),
                ]),
        ]);
    }
}
