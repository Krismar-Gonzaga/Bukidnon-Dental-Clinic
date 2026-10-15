<?php

use App\Http\Controllers\Api\Admin;
use App\Http\Controllers\Api\AppointmentController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClinicApplicationController;
use App\Http\Controllers\Api\ClinicVerificationController;
use App\Http\Controllers\Api\DocumentDownloadController;
use App\Http\Controllers\Api\HomeController;
use App\Http\Controllers\Api\InvitationController;
use App\Http\Controllers\Api\Manage;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PatientController;
use App\Http\Controllers\Api\PatientDashboardController;
use App\Http\Controllers\Api\PatientReviewController;
use App\Http\Controllers\Api\PublicClinicController;
use App\Http\Controllers\Api\ReviewReportController;
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
Route::get('/clinics/{id}/reviews', [PublicClinicController::class, 'reviews'])->whereNumber('id');
Route::get('/specializations', [HomeController::class, 'getSpecializations']);
Route::get('/services', [HomeController::class, 'getServices']);
Route::get('/cities', [HomeController::class, 'getCities']);

// Short-lived signed links handed out by the document-link endpoints.
Route::get('/documents/{document}/download', DocumentDownloadController::class)
    ->middleware('signed:relative')
    ->name('documents.download');

// ---------------------------------------------------------------- Authentication
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:register');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
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
    Route::put('/notification-preferences', [NotificationController::class, 'updatePreferences']);
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
        Route::get('/profile', [PatientController::class, 'profile']);
        Route::put('/profile', [PatientController::class, 'updateProfile']);
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
        Route::put('/', [Manage\ClinicController::class, 'update'])->middleware('clinic.permission:clinic.profile.manage');
        Route::put('/publish', [Manage\ClinicController::class, 'publish'])->middleware('clinic.permission:clinic.profile.manage');
        Route::get('/dashboard', [Manage\ClinicController::class, 'dashboard'])->middleware('clinic.permission:clinic.view');
        Route::get('/reports/appointments', [Manage\ClinicController::class, 'report'])->middleware('clinic.permission:reports.view');

        Route::get('/branches', [Manage\BranchController::class, 'index'])->middleware('clinic.permission:clinic.view');
        Route::post('/branches', [Manage\BranchController::class, 'store'])->middleware('clinic.permission:clinic.branches.manage');
        Route::put('/branches/{branch}', [Manage\BranchController::class, 'update'])->middleware('clinic.permission:clinic.branches.manage');
        Route::put('/branches/{branch}/hours', [Manage\BranchController::class, 'updateHours'])->middleware('clinic.permission:clinic.schedules.manage');

        Route::get('/holidays', [Manage\ScheduleController::class, 'holidays'])->middleware('clinic.permission:clinic.view');
        Route::post('/holidays', [Manage\ScheduleController::class, 'storeHoliday'])->middleware('clinic.permission:clinic.schedules.manage');
        Route::delete('/holidays/{holiday}', [Manage\ScheduleController::class, 'destroyHoliday'])->middleware('clinic.permission:clinic.schedules.manage');
        Route::get('/schedule-blocks', [Manage\ScheduleController::class, 'blocks'])->middleware('clinic.permission:clinic.view');
        Route::post('/schedule-blocks', [Manage\ScheduleController::class, 'storeBlock'])->middleware('clinic.permission:clinic.schedules.manage');
        Route::delete('/schedule-blocks/{scheduleBlock}', [Manage\ScheduleController::class, 'destroyBlock'])->middleware('clinic.permission:clinic.schedules.manage');

        Route::get('/services', [Manage\ServiceController::class, 'index'])->middleware('clinic.permission:clinic.view');
        Route::post('/services', [Manage\ServiceController::class, 'store'])->middleware('clinic.permission:clinic.services.manage');
        Route::put('/services/{serviceRate}', [Manage\ServiceController::class, 'update'])->middleware('clinic.permission:clinic.services.manage');

        Route::get('/dentists', [Manage\DentistController::class, 'index'])->middleware('clinic.permission:clinic.view');
        Route::put('/dentists/{dentistId}', [Manage\DentistController::class, 'update'])->middleware('clinic.permission:clinic.dentists.manage');
        Route::put('/dentists/{dentistId}/schedules', [Manage\DentistController::class, 'updateSchedules'])->middleware('clinic.permission:clinic.schedules.manage');

        Route::get('/members', [Manage\MemberController::class, 'index'])->middleware('clinic.permission:clinic.staff.manage');
        Route::post('/members', [Manage\MemberController::class, 'store'])->middleware(['clinic.permission:clinic.staff.manage', 'throttle:20,1']);
        Route::put('/members/{membership}', [Manage\MemberController::class, 'update'])->middleware('clinic.permission:clinic.staff.manage');

        $viewAppointments = 'clinic.permission:appointments.view_all|appointments.view_assigned';
        Route::get('/appointments', [Manage\AppointmentController::class, 'index'])->middleware($viewAppointments);
        Route::post('/appointments', [Manage\AppointmentController::class, 'store'])->middleware('clinic.permission:appointments.manage');
        Route::get('/appointments/{appointmentId}', [Manage\AppointmentController::class, 'show'])->middleware($viewAppointments);
        foreach (['confirm', 'reject', 'cancel', 'reschedule', 'approve-reschedule' => 'approveReschedule', 'check-in' => 'checkIn'] as $path => $action) {
            $path = is_int($path) ? $action : $path;
            Route::post("/appointments/{appointmentId}/{$path}", [Manage\AppointmentController::class, $action])->middleware('clinic.permission:appointments.manage');
        }
        foreach (['start' => 'start', 'complete' => 'complete', 'no-show' => 'noShow'] as $path => $action) {
            Route::post("/appointments/{appointmentId}/{$path}", [Manage\AppointmentController::class, $action])->middleware('clinic.permission:appointments.manage|appointments.progress');
        }

        Route::get('/patients', [Manage\PatientController::class, 'index'])->middleware('clinic.permission:patients.view');
        Route::post('/patients', [Manage\PatientController::class, 'store'])->middleware('clinic.permission:patients.manage');
        Route::get('/patients/{patientId}', [Manage\PatientController::class, 'show'])->middleware('clinic.permission:patients.view');
        Route::put('/patients/{patientId}', [Manage\PatientController::class, 'update'])->middleware('clinic.permission:patients.manage');
        Route::get('/patients/{patientId}/medical-history', [Manage\PatientController::class, 'medicalHistory'])->middleware('clinic.permission:records.view');
        Route::post('/patients/{patientId}/medical-history', [Manage\PatientController::class, 'storeMedicalHistory'])->middleware('clinic.permission:records.write');
        Route::get('/patients/{patientId}/records', [Manage\RecordController::class, 'index'])->middleware('clinic.permission:records.view');
        Route::post('/patients/{patientId}/records', [Manage\RecordController::class, 'store'])->middleware('clinic.permission:records.write');
        Route::post('/patients/{patientId}/records/{recordId}/amend', [Manage\RecordController::class, 'amend'])->middleware('clinic.permission:records.write');

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
        Route::post('/reviews/{review}/report', [Manage\FeedbackController::class, 'report'])->middleware('clinic.permission:feedback.view');
    });

    // ------------------------------------------------------------ System administration
    Route::middleware('role:system_admin')->prefix('admin')->group(function () {
        Route::get('/dashboard', Admin\DashboardController::class);
        Route::get('/clinic-applications', [Admin\ClinicApplicationController::class, 'index']);
        Route::get('/clinic-applications/{id}', [Admin\ClinicApplicationController::class, 'show']);
        Route::post('/clinic-applications/{id}/start-review', [Admin\ClinicApplicationController::class, 'startReview']);
        Route::post('/clinic-applications/{id}/approve', [Admin\ClinicApplicationController::class, 'approve']);
        Route::post('/clinic-applications/{id}/reject', [Admin\ClinicApplicationController::class, 'reject']);
        Route::get('/clinic-applications/{id}/documents/{documentId}/link', [Admin\ClinicApplicationController::class, 'documentLink']);
        Route::get('/clinics', [Admin\ClinicController::class, 'index']);
        Route::post('/clinics/{clinic}/suspend', [Admin\ClinicController::class, 'suspend']);
        Route::post('/clinics/{clinic}/reactivate', [Admin\ClinicController::class, 'reactivate']);
        Route::get('/users', [Admin\UserController::class, 'index']);
        Route::put('/users/{user}', [Admin\UserController::class, 'update']);
        Route::get('/audit-logs', [Admin\AuditLogController::class, 'index']);
        Route::get('/reviews', [Admin\ReviewModerationController::class, 'index']);
        Route::post('/reviews/{review}/moderate', [Admin\ReviewModerationController::class, 'moderate']);
    });
});
