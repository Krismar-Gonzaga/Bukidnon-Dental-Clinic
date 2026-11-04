<?php

use App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Api\AppointmentController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClinicApplicationController;
use App\Http\Controllers\Api\ClinicVerificationController;
use App\Http\Controllers\Api\DocumentDownloadController;
use App\Http\Controllers\Api\SignedFileController;
use App\Http\Controllers\Api\HomeController;
use App\Http\Controllers\Api\InvitationController;
use App\Http\Controllers\Api\Manage;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PatientController;
use App\Http\Controllers\Api\SessionController;
use App\Http\Controllers\Api\TwoFactorController;
use App\Http\Controllers\Api\PatientDashboardController;
use App\Http\Controllers\Api\PatientReviewController;
use App\Http\Controllers\Api\PublicClinicController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\PublicDentistController;
use App\Http\Controllers\Api\ReviewReportController;
use App\Http\Controllers\Api\SavedClinicController;
use Illuminate\Support\Facades\Route;

/*
| All paths are under /api (no version prefix: the mobile app already
| depends on these). See backend/docs/API.md for request/response details.
|
| Authorization layers:
|  - auth:sanctum + active  → signed-in, non-suspended account
|  - clinic.permission:<p>  → active membership in {clinic} with permission p
|                             (non-members get 404, members without p get 403)
|  - role:system_admin      → platform administration
| Nested {models} under a {clinic} are resolved through that clinic
| (scopeBindings), so ids from another clinic are "not found".
*/

// ---------------------------------------------------------------- Public
Route::get('/home', [HomeController::class, 'index']);
Route::get('/clinics/search', [HomeController::class, 'searchClinics']);
Route::get('/clinics/map', [PublicClinicController::class, 'map']);
Route::get('/clinics/{id}', [HomeController::class, 'clinicDetails'])->whereNumber('id');
Route::get('/clinics/{id}/availability', [PublicClinicController::class, 'availability'])->whereNumber('id');
Route::get('/clinics/{id}/available-dates', [PublicClinicController::class, 'availableDates'])->whereNumber('id');
Route::get('/clinics/{id}/reviews', [PublicClinicController::class, 'reviews'])->whereNumber('id');
Route::get('/dentists', [PublicDentistController::class, 'index']);
Route::get('/dentists/{id}', [PublicDentistController::class, 'show'])->whereNumber('id');
Route::post('/contact', [ContactController::class, 'store'])->middleware('throttle:5,1');
Route::get('/specializations', [HomeController::class, 'getSpecializations']);
Route::get('/services', [HomeController::class, 'getServices']);
Route::get('/cities', [HomeController::class, 'getCities']);
Route::get('/platform', [HomeController::class, 'platform']);

// Short-lived signed links handed out by the document-link endpoints.
Route::get('/documents/{document}/download', DocumentDownloadController::class)
    ->middleware('signed:relative')
    ->name('documents.download');
Route::get('/patient-files/{file}/download', [SignedFileController::class, 'patientFile'])
    ->middleware('signed:relative')
    ->name('patient-files.download');
Route::get('/prescriptions/{prescription}/print', [SignedFileController::class, 'prescription'])
    ->middleware('signed:relative')
    ->name('prescriptions.print');
Route::get('/certificates/{certificate}/print', [SignedFileController::class, 'certificate'])
    ->middleware('signed:relative')
    ->name('certificates.print');
Route::get('/subscription-invoices/{payment}/download', [SignedFileController::class, 'invoice'])
    ->middleware('signed:relative')
    ->name('subscription-invoices.download');
Route::get('/subscription-proofs/{payment}/download', [SignedFileController::class, 'paymentProof'])
    ->middleware('signed:relative')
    ->name('subscription-proofs.download');
Route::get('/clinic-audit-logs/{clinic}/download', [Manage\ClinicSettingsController::class, 'auditCsv'])
    ->middleware('signed:relative')
    ->name('clinic-audit-logs.download');

// ---------------------------------------------------------------- Authentication
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:register');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
// Session check for app start-up: 200 with data null when signed out.
Route::get('/session', [AuthController::class, 'session']);
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:password-reset');
Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:password-reset');

Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);

    // ------------------------------------------------------------ Any signed-in user
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
    Route::get('/notification-preferences', [NotificationController::class, 'preferences']);
    Route::put('/notification-preferences', [NotificationController::class, 'updatePreferences']);
    Route::get('/two-factor', [TwoFactorController::class, 'status']);
    Route::post('/two-factor/recovery-codes', [TwoFactorController::class, 'regenerateRecoveryCodes'])->middleware('throttle:5,1');
    Route::get('/sessions', [SessionController::class, 'index']);
    Route::post('/sessions/sign-out-others', [SessionController::class, 'destroyOthers'])->middleware('throttle:5,1');
    Route::delete('/sessions/{session}', [SessionController::class, 'destroy'])->middleware('throttle:20,1');
    Route::post('/two-factor/setup', [TwoFactorController::class, 'setup'])->middleware('throttle:10,1');
    Route::post('/two-factor/confirm', [TwoFactorController::class, 'confirm'])->middleware('throttle:10,1');
    Route::post('/two-factor/disable', [TwoFactorController::class, 'disable'])->middleware('throttle:10,1');
    Route::post('/reviews/{id}/report', ReviewReportController::class)->middleware('throttle:10,1');

    Route::get('/my/invitations', [InvitationController::class, 'index']);
    Route::post('/my/invitations/{id}/accept', [InvitationController::class, 'accept']);
    Route::post('/my/invitations/{id}/decline', [InvitationController::class, 'decline']);

    // ------------------------------------------------------------ Patient
    Route::prefix('patient')->group(function () {
        Route::get('/dashboard', PatientDashboardController::class);
        Route::get('/appointments', [AppointmentController::class, 'patientAppointments']);
        Route::post('/appointments', [AppointmentController::class, 'store'])->middleware('throttle:20,1');
        Route::get('/appointments/{id}', [AppointmentController::class, 'show']);
        Route::put('/appointments/{id}', [AppointmentController::class, 'update']);
        Route::delete('/appointments/{id}', [AppointmentController::class, 'cancel']);
        Route::post('/appointments/{id}/cancel', [AppointmentController::class, 'cancel']);
        Route::post('/appointments/{id}/review', [PatientReviewController::class, 'store'])->middleware('throttle:10,1');
        Route::get('/reviews', [PatientReviewController::class, 'index']);
        Route::get('/reviews/eligible', [PatientReviewController::class, 'eligible']);
        Route::get('/records', [PatientController::class, 'records']);
        Route::get('/medical-history', [PatientController::class, 'medicalHistory']);
        Route::get('/saved-clinics', [SavedClinicController::class, 'index']);
        Route::put('/saved-clinics/{clinicId}', [SavedClinicController::class, 'store']);
        Route::delete('/saved-clinics/{clinicId}', [SavedClinicController::class, 'destroy']);
        Route::get('/profile', [PatientController::class, 'profile']);
        Route::put('/profile', [PatientController::class, 'updateProfile']);
        Route::put('/profile/health', [PatientController::class, 'updateHealth']);
        Route::get('/profile/photo', [PatientController::class, 'photo']);
        Route::post('/profile/photo', [PatientController::class, 'uploadPhoto'])->middleware('throttle:10,1');
    });

    // ------------------------------------------------------------ Clinic applications (owners)
    Route::get('/clinic-applications', [ClinicApplicationController::class, 'index']);
    Route::post('/clinic-applications', [ClinicApplicationController::class, 'store']);
    Route::get('/clinic-applications/{id}', [ClinicApplicationController::class, 'show']);
    Route::put('/clinic-applications/{id}', [ClinicApplicationController::class, 'update']);
    Route::post('/clinic-applications/{id}/documents', [ClinicApplicationController::class, 'uploadDocument'])->middleware('throttle:30,1');
    Route::delete('/clinic-applications/{id}/documents/{documentId}', [ClinicApplicationController::class, 'deleteDocument']);
    Route::get('/clinic-applications/{id}/documents/{documentId}/link', [ClinicApplicationController::class, 'documentLink']);
    Route::post('/clinic-applications/{id}/submit', [ClinicApplicationController::class, 'submit']);
    // Older one-step endpoints used by the mobile app.
    Route::post('/clinic-verification', [ClinicVerificationController::class, 'store']);
    Route::get('/clinic-verification/status', [ClinicVerificationController::class, 'status']);

    // ------------------------------------------------------------ Clinic portal
    Route::prefix('manage/clinics/{clinic}')->scopeBindings()->group(function () {
        Route::get('/', [Manage\ClinicController::class, 'show'])->middleware('clinic.permission:clinic.view');
        Route::get('/me', [Manage\FrontDeskController::class, 'me'])->middleware('clinic.permission:clinic.view');
        Route::put('/me', [Manage\FrontDeskController::class, 'updateMe'])->middleware(['clinic.permission:clinic.view', 'throttle:20,1']);
        Route::put('/', [Manage\ClinicController::class, 'update'])->middleware('clinic.permission:clinic.profile.manage');
        Route::put('/publish', [Manage\ClinicController::class, 'publish'])->middleware('clinic.permission:clinic.profile.manage');
        Route::get('/dashboard', [Manage\ClinicController::class, 'dashboard'])->middleware('clinic.permission:clinic.view');
        Route::get('/dashboard/insights', Manage\DashboardInsightsController::class)->middleware('clinic.permission:reports.view');
        Route::get('/reports/analytics', Manage\ReportAnalyticsController::class)->middleware('clinic.permission:reports.view');
        Route::get('/reports/appointments', [Manage\ClinicController::class, 'report'])->middleware('clinic.permission:reports.view');

        Route::get('/branches', [Manage\BranchController::class, 'index'])->middleware('clinic.permission:clinic.view');
        Route::post('/branches', [Manage\BranchController::class, 'store'])->middleware('clinic.permission:clinic.branches.manage');
        Route::put('/branches/{branch}', [Manage\BranchController::class, 'update'])->middleware('clinic.permission:clinic.branches.manage');
        Route::put('/branches/{branch}/hours', [Manage\BranchController::class, 'updateHours'])->middleware('clinic.permission:clinic.schedules.manage');
        Route::delete('/branches/{branch}', [Manage\BranchController::class, 'destroy'])->middleware('clinic.permission:clinic.branches.manage');

        Route::get('/holidays', [Manage\ScheduleController::class, 'holidays'])->middleware('clinic.permission:clinic.view');
        Route::post('/holidays', [Manage\ScheduleController::class, 'storeHoliday'])->middleware('clinic.permission:clinic.schedules.manage');
        Route::delete('/holidays/{holiday}', [Manage\ScheduleController::class, 'destroyHoliday'])->middleware('clinic.permission:clinic.schedules.manage');
        Route::get('/schedule-blocks', [Manage\ScheduleController::class, 'blocks'])->middleware('clinic.permission:clinic.view');
        Route::post('/schedule-blocks', [Manage\ScheduleController::class, 'storeBlock'])->middleware('clinic.permission:clinic.schedules.manage');
        Route::delete('/schedule-blocks/{scheduleBlock}', [Manage\ScheduleController::class, 'destroyBlock'])->middleware('clinic.permission:clinic.schedules.manage');

        Route::get('/services', [Manage\ServiceController::class, 'index'])->middleware('clinic.permission:clinic.view');
        Route::post('/services', [Manage\ServiceController::class, 'store'])->middleware('clinic.permission:clinic.services.manage');
        Route::put('/services/{serviceRate}', [Manage\ServiceController::class, 'update'])->middleware('clinic.permission:clinic.services.manage');
        Route::delete('/services/{serviceRate}', [Manage\ServiceController::class, 'destroy'])->middleware('clinic.permission:clinic.services.manage');

        Route::get('/dentists/{dentistId}', [Manage\DentistController::class, 'show'])->middleware('clinic.permission:clinic.dentists.manage|clinic.schedules.manage')->whereNumber('dentistId');
        Route::get('/dentists', [Manage\DentistController::class, 'index'])->middleware('clinic.permission:clinic.view');
        Route::put('/dentists/{dentistId}', [Manage\DentistController::class, 'update'])->middleware('clinic.permission:clinic.dentists.manage');
        Route::put('/dentists/{dentistId}/schedules', [Manage\DentistController::class, 'updateSchedules'])->middleware('clinic.permission:clinic.schedules.manage');

        Route::get('/schedule-changes', [Manage\ScheduleChangeController::class, 'index'])->middleware('clinic.permission:clinic.schedules.manage');
        Route::post('/schedule-changes/{changeId}/approve', [Manage\ScheduleChangeController::class, 'approve'])->middleware(['clinic.permission:clinic.schedules.manage', 'throttle:30,1'])->whereNumber('changeId');
        Route::post('/schedule-changes/{changeId}/reject', [Manage\ScheduleChangeController::class, 'reject'])->middleware(['clinic.permission:clinic.schedules.manage', 'throttle:30,1'])->whereNumber('changeId');

        Route::get('/members', [Manage\MemberController::class, 'index'])->middleware('clinic.permission:clinic.staff.manage');
        Route::post('/members', [Manage\MemberController::class, 'store'])->middleware(['clinic.permission:clinic.staff.manage', 'throttle:20,1']);
        Route::put('/members/{membership}', [Manage\MemberController::class, 'update'])->middleware('clinic.permission:clinic.staff.manage');

        Route::post('/members/{membership}/reset-password', [Manage\MemberController::class, 'resetPassword'])->middleware(['clinic.permission:clinic.staff.manage', 'throttle:5,1']);

        $viewAppointments = 'clinic.permission:appointments.view_all|appointments.view_assigned';
        Route::get('/appointments', [Manage\AppointmentController::class, 'index'])->middleware($viewAppointments);
        Route::post('/appointments', [Manage\AppointmentController::class, 'store'])->middleware('clinic.permission:appointments.manage');
        Route::get('/appointments/calendar', [Manage\AppointmentController::class, 'calendar'])->middleware($viewAppointments);
        Route::get('/appointments/queue', [Manage\FrontDeskController::class, 'queue'])->middleware('clinic.permission:appointments.view_all');
        Route::put('/appointments/{appointmentId}/front-desk-notes', [Manage\FrontDeskController::class, 'saveNotes'])->middleware('clinic.permission:appointments.manage')->whereNumber('appointmentId');
        Route::get('/appointments/{appointmentId}', [Manage\AppointmentController::class, 'show'])->middleware($viewAppointments);
        foreach (['confirm', 'reject'] as $action) {
            Route::post("/appointments/{appointmentId}/{$action}", [Manage\AppointmentController::class, $action])->middleware('clinic.permission:appointments.manage|appointments.review_assigned');
        }
        Route::put('/appointments/{appointmentId}/treatment-notes', [Manage\AppointmentController::class, 'saveTreatmentNotes'])->middleware('clinic.permission:records.write')->whereNumber('appointmentId');
        foreach (['cancel', 'reschedule', 'approve-reschedule' => 'approveReschedule', 'check-in' => 'checkIn'] as $path => $action) {
            $path = is_int($path) ? $action : $path;
            Route::post("/appointments/{appointmentId}/{$path}", [Manage\AppointmentController::class, $action])->middleware('clinic.permission:appointments.manage');
        }
        Route::post('/appointments/{appointmentId}/reassign', [Manage\AppointmentController::class, 'reassign'])->middleware('clinic.permission:appointments.manage');
        foreach (['start' => 'start', 'complete' => 'complete', 'no-show' => 'noShow'] as $path => $action) {
            Route::post("/appointments/{appointmentId}/{$path}", [Manage\AppointmentController::class, $action])->middleware('clinic.permission:appointments.manage|appointments.progress');
        }

        Route::get('/patients', [Manage\PatientController::class, 'index'])->middleware('clinic.permission:patients.view');
        Route::post('/patients', [Manage\PatientController::class, 'store'])->middleware('clinic.permission:patients.manage');
        Route::get('/patients/{patientId}', [Manage\PatientController::class, 'show'])->middleware('clinic.permission:patients.view');
        Route::put('/patients/{patientId}', [Manage\PatientController::class, 'update'])->middleware('clinic.permission:patients.manage');
        Route::get('/patients/{patientId}/medical-history', [Manage\PatientController::class, 'medicalHistory'])->middleware('clinic.permission:records.view');
        Route::post('/patients/{patientId}/medical-history', [Manage\PatientController::class, 'storeMedicalHistory'])->middleware('clinic.permission:records.write');
        Route::get('/records', [Manage\RecordController::class, 'clinicIndex'])->middleware('clinic.permission:records.view');
        Route::get('/patients/{patientId}/records',[Manage\RecordController::class, 'index'])->middleware('clinic.permission:records.view');
        Route::post('/patients/{patientId}/records', [Manage\RecordController::class, 'store'])->middleware('clinic.permission:records.write');
        Route::put('/patients/{patientId}/records/{recordId}', [Manage\RecordController::class, 'update'])->middleware('clinic.permission:records.write')->whereNumber(['patientId', 'recordId']);
        Route::post('/patients/{patientId}/records/{recordId}/amend', [Manage\RecordController::class, 'amend'])->middleware('clinic.permission:records.write');
        Route::get('/patients/{patientId}/dental-chart', [Manage\DentalChartController::class, 'show'])->middleware('clinic.permission:records.view')->whereNumber('patientId');
        Route::put('/patients/{patientId}/dental-chart/{tooth}', [Manage\DentalChartController::class, 'updateTooth'])->middleware('clinic.permission:records.write')->whereNumber(['patientId', 'tooth']);
        Route::get('/patients/{patientId}/checklist', [Manage\DentalChartController::class, 'checklist'])->middleware('clinic.permission:records.view')->whereNumber('patientId');
        Route::put('/patients/{patientId}/checklist', [Manage\DentalChartController::class, 'updateChecklist'])->middleware('clinic.permission:records.write')->whereNumber('patientId');

        Route::get('/prescriptions', [Manage\ClinicalDocumentController::class, 'prescriptions'])->middleware('clinic.permission:records.view');
        Route::post('/prescriptions', [Manage\ClinicalDocumentController::class, 'storePrescription'])->middleware(['clinic.permission:documents.issue', 'throttle:30,1']);
        Route::get('/prescriptions/{prescriptionId}/print-link', [Manage\ClinicalDocumentController::class, 'prescriptionPrintLink'])->middleware(['clinic.permission:records.view', 'throttle:30,1'])->whereNumber('prescriptionId');
        Route::post('/certificates/preview', [Manage\ClinicalDocumentController::class, 'previewCertificate'])->middleware('clinic.permission:documents.issue');
        Route::post('/certificates', [Manage\ClinicalDocumentController::class, 'issueCertificate'])->middleware(['clinic.permission:documents.issue', 'throttle:30,1']);

        Route::get('/follow-ups', [Manage\FollowUpController::class, 'index'])->middleware('clinic.permission:records.view');
        Route::post('/follow-ups', [Manage\FollowUpController::class, 'store'])->middleware('clinic.permission:records.write');
        Route::put('/follow-ups/{followUpId}', [Manage\FollowUpController::class, 'update'])->middleware('clinic.permission:records.write')->whereNumber('followUpId');

        Route::get('/files', [Manage\PatientFileController::class, 'clinicIndex'])->middleware('clinic.permission:records.view');

        Route::prefix('dentist')->middleware('clinic.permission:appointments.view_assigned')->group(function () {
            Route::get('/overview', [Manage\DentistPortalController::class, 'overview']);
            Route::get('/schedule', [Manage\DentistPortalController::class, 'schedule']);
            Route::post('/schedule/changes', [Manage\ScheduleChangeController::class, 'store'])->middleware('throttle:10,1');
            Route::delete('/schedule/changes/{changeId}', [Manage\ScheduleChangeController::class, 'cancel'])->middleware('throttle:20,1')->whereNumber('changeId');
            Route::post('/schedule/request-change', [Manage\ScheduleChangeController::class, 'message'])->middleware('throttle:5,1');
            Route::get('/profile', [Manage\DentistPortalController::class, 'profile']);
            Route::put('/profile', [Manage\DentistPortalController::class, 'updateProfile'])->middleware('throttle:20,1');
        });

        Route::get('/inventory/movements', [Manage\InventoryController::class, 'movements'])->middleware('clinic.permission:inventory.view');
        Route::get('/inventory/items', [Manage\InventoryController::class, 'index'])->middleware('clinic.permission:inventory.view');
        Route::post('/inventory/items', [Manage\InventoryController::class, 'store'])->middleware('clinic.permission:inventory.manage');
        Route::get('/inventory/items/{inventoryItem}', [Manage\InventoryController::class, 'show'])->middleware('clinic.permission:inventory.view');
        Route::put('/inventory/items/{inventoryItem}', [Manage\InventoryController::class, 'update'])->middleware('clinic.permission:inventory.manage');
        Route::post('/inventory/items/{inventoryItem}/movements', [Manage\InventoryController::class, 'storeMovement'])->middleware('clinic.permission:inventory.manage');
        Route::get('/inventory/alerts', [Manage\InventoryController::class, 'alerts'])->middleware('clinic.permission:inventory.view');
        Route::get('/inventory/categories', [Manage\InventoryController::class, 'categories'])->middleware('clinic.permission:inventory.view');
        Route::post('/inventory/categories', [Manage\InventoryController::class, 'storeCategory'])->middleware('clinic.permission:inventory.manage');
        Route::get('/inventory/suppliers', [Manage\InventoryController::class, 'suppliers'])->middleware('clinic.permission:inventory.view');
        Route::post('/inventory/suppliers', [Manage\InventoryController::class, 'storeSupplier'])->middleware('clinic.permission:inventory.manage');

        Route::get('/reviews', [Manage\FeedbackController::class, 'index'])->middleware('clinic.permission:feedback.view');
        Route::post('/reviews/{review}/reply', [Manage\FeedbackController::class, 'reply'])->middleware(['clinic.permission:feedback.respond', 'throttle:30,1']);

        Route::get('/settings', [Manage\ClinicSettingsController::class, 'show'])->middleware('clinic.permission:clinic.settings.manage');
        Route::put('/settings', [Manage\ClinicSettingsController::class, 'update'])->middleware('clinic.permission:clinic.settings.manage');
        Route::get('/role-permissions', [Manage\ClinicSettingsController::class, 'rolePermissions'])->middleware('clinic.permission:clinic.permissions.manage');
        Route::put('/role-permissions', [Manage\ClinicSettingsController::class, 'updateRolePermissions'])->middleware('clinic.permission:clinic.permissions.manage');
        Route::get('/audit-logs', [Manage\ClinicSettingsController::class, 'auditLogs'])->middleware('clinic.permission:clinic.audit.view');
        Route::get('/audit-logs/export-link', [Manage\ClinicSettingsController::class, 'auditExportLink'])->middleware(['clinic.permission:clinic.audit.view', 'throttle:5,1']);
        Route::get('/audit-logs/export', [Manage\ClinicSettingsController::class, 'exportAuditLogs'])->middleware(['clinic.permission:clinic.audit.view', 'throttle:5,1']);

        Route::get('/subscription', [Manage\SubscriptionController::class, 'show'])->middleware('clinic.permission:subscription.manage');
        Route::post('/subscription/payments', [Manage\SubscriptionController::class, 'storePayment'])->middleware(['clinic.permission:subscription.manage', 'throttle:10,1']);
        Route::post('/subscription/renewal-request', [Manage\SubscriptionController::class, 'requestRenewal'])->middleware(['clinic.permission:subscription.manage', 'throttle:5,1']);
        Route::get('/subscription/payments/{paymentId}/invoice-link', [Manage\SubscriptionController::class, 'invoiceLink'])->middleware('clinic.permission:subscription.manage')->whereNumber('paymentId');
        Route::get('/subscription/payments/{paymentId}/invoice', [Manage\SubscriptionController::class, 'invoice'])->middleware('clinic.permission:subscription.manage')->whereNumber('paymentId');

        Route::get('/patients/{patientId}/files', [Manage\PatientFileController::class, 'index'])->middleware('clinic.permission:records.view');
        Route::post('/patients/{patientId}/files', [Manage\PatientFileController::class, 'store'])->middleware(['clinic.permission:records.write', 'throttle:30,1']);
        Route::get('/patients/{patientId}/files/{fileId}/link', [Manage\PatientFileController::class, 'link'])->middleware(['clinic.permission:records.view', 'throttle:30,1'])->whereNumber(['patientId', 'fileId']);
        Route::get('/patients/{patientId}/files/{fileId}', [Manage\PatientFileController::class, 'download'])->middleware('clinic.permission:records.view')->whereNumber('fileId');
        Route::post('/reviews/{review}/report', [Manage\FeedbackController::class, 'report'])->middleware('clinic.permission:feedback.view');
    });

    // ------------------------------------------------------------ System administration
    Route::middleware('role:system_admin')->prefix('admin')->group(function () {
        Route::get('/dashboard', Admin\DashboardController::class);
        Route::get('/system/health', Admin\SystemHealthController::class)->middleware('throttle:admin-health');
        Route::post('/confirm-password', [Admin\PasswordConfirmationController::class, 'store'])->middleware('throttle:admin-confirm');
        Route::get('/clinic-applications', [Admin\ClinicApplicationController::class, 'index']);
        Route::get('/clinic-applications/summary', [Admin\ClinicApplicationController::class, 'summary']);
        Route::get('/clinic-applications/{id}', [Admin\ClinicApplicationController::class, 'show'])->whereNumber('id');
        Route::post('/clinic-applications/{id}/start-review', [Admin\ClinicApplicationController::class, 'startReview']);
        Route::post('/clinic-applications/{id}/notes', [Admin\ClinicApplicationController::class, 'storeNote'])->middleware('throttle:admin-actions');
        Route::get('/clinic-applications/{id}/documents/{documentId}/link', [Admin\ClinicApplicationController::class, 'documentLink']);
        Route::get('/clinics', [Admin\ClinicController::class, 'index']);
        Route::get('/clinics/directory', [Admin\ClinicController::class, 'directory']);
        Route::get('/clinics/{clinic}', [Admin\ClinicController::class, 'show'])->whereNumber('clinic');
        Route::get('/subscriptions', [Admin\SubscriptionController::class, 'index']);
        Route::get('/subscriptions/{clinic}', [Admin\SubscriptionController::class, 'show'])->whereNumber('clinic');
        Route::get('/reports', [Admin\ReportController::class, 'show']);
        Route::get('/reports/export', [Admin\ReportController::class, 'export'])->middleware('throttle:admin-reports');
        Route::get('/announcements', [Admin\AnnouncementController::class, 'index']);
        Route::get('/announcements/{announcement}', [Admin\AnnouncementController::class, 'show']);
        Route::post('/announcements', [Admin\AnnouncementController::class, 'store'])->middleware('throttle:admin-actions');
        Route::put('/announcements/{announcement}', [Admin\AnnouncementController::class, 'update'])->middleware('throttle:admin-actions');
        Route::post('/announcements/{announcement}/publish', [Admin\AnnouncementController::class, 'publish'])->middleware('throttle:admin-actions');
        Route::post('/announcements/{announcement}/archive', [Admin\AnnouncementController::class, 'archive'])->middleware('throttle:admin-actions');
        Route::get('/settings', [Admin\SettingsController::class, 'show']);
        Route::get('/users', [Admin\UserController::class, 'index']);
        Route::get('/audit-logs', [Admin\AuditLogController::class, 'index']);
        Route::get('/audit-logs/summary', [Admin\AuditLogController::class, 'summary']);
        Route::post('/audit-logs/integrity', [Admin\AuditLogController::class, 'integrity'])->middleware('throttle:admin-integrity');
        Route::get('/reviews', [Admin\ReviewModerationController::class, 'index']);
        Route::get('/subscription-payments', [Admin\SubscriptionPaymentController::class, 'index']);
        Route::get('/subscription-payments/{payment}/proof', [Admin\SubscriptionPaymentController::class, 'proof']);
        Route::get('/subscription-payments/{payment}/proof-link', [Admin\SubscriptionPaymentController::class, 'proofLink']);

        // High-impact actions: the password must have been re-entered recently.
        Route::middleware(['password.recent', 'throttle:admin-actions'])->group(function () {
            Route::post('/clinic-applications/{id}/approve', [Admin\ClinicApplicationController::class, 'approve']);
            Route::post('/clinic-applications/{id}/reject', [Admin\ClinicApplicationController::class, 'reject']);
            Route::post('/clinic-applications/{id}/request-documents', [Admin\ClinicApplicationController::class, 'requestDocuments']);
            Route::put('/subscriptions/{clinic}/plan', [Admin\SubscriptionController::class, 'changePlan'])->whereNumber('clinic');
            Route::put('/settings', [Admin\SettingsController::class, 'update']);
            Route::post('/clinics/{clinic}/suspend', [Admin\ClinicController::class, 'suspend']);
            Route::post('/clinics/{clinic}/reactivate', [Admin\ClinicController::class, 'reactivate']);
            Route::put('/users/{user}', [Admin\UserController::class, 'update']);
            Route::post('/reviews/{review}/moderate', [Admin\ReviewModerationController::class, 'moderate']);
            Route::post('/subscription-payments/{payment}/verify', [Admin\SubscriptionPaymentController::class, 'verify']);
            Route::post('/subscription-payments/{payment}/reject', [Admin\SubscriptionPaymentController::class, 'reject']);
        });

        // Bulk exports of personal data (emails, IP addresses): password re-confirmed, few per minute.
        Route::middleware(['password.recent', 'throttle:admin-exports'])->group(function () {
            Route::get('/clinic-applications/export', [Admin\ClinicApplicationController::class, 'export']);
            Route::get('/audit-logs/export', [Admin\AuditLogController::class, 'export']);
        });
    });
});
