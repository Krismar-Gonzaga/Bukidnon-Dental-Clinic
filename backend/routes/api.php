<?php

use App\Http\Controllers\API\HomeController;
use App\Http\Controllers\API\AuthController;
use App\Http\Controllers\API\AppointmentController;
use App\Http\Controllers\API\PatientController;
use App\Http\Controllers\API\InventoryController;
use App\Http\Controllers\API\BillingController;
use App\Http\Controllers\API\FeedbackController;
use Illuminate\Support\Facades\Route;

// Public Routes
Route::get('/home', [HomeController::class, 'index']);
Route::get('/clinics/search', [HomeController::class, 'searchClinics']);
Route::get('/clinics/{id}', [HomeController::class, 'clinicDetails']);
// Get all specializations
Route::get('/specializations', [HomeController::class, 'getSpecializations']);
// Get all cities       
Route::get('/cities', [HomeController::class, 'getCities']);

// Authentication Routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Protected Routes
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);

    // Patient Routes
    Route::prefix('patient')->group(function () {
        Route::get('/appointments', [AppointmentController::class, 'patientAppointments']);
        Route::post('/appointments', [AppointmentController::class, 'store']);
        Route::put('/appointments/{id}', [AppointmentController::class, 'update']);
        Route::delete('/appointments/{id}', [AppointmentController::class, 'cancel']);
        Route::post('/feedback', [FeedbackController::class, 'store']);
        Route::get('/profile', [PatientController::class, 'profile']);
        Route::put('/profile', [PatientController::class, 'updateProfile']);
    });

    // Staff Routes
    Route::middleware('role:staff')->prefix('staff')->group(function () {
        Route::get('/appointments', [AppointmentController::class, 'index']);
        Route::put('/appointments/{id}/confirm', [AppointmentController::class, 'confirm']);
        Route::put('/appointments/{id}/reschedule', [AppointmentController::class, 'reschedule']);
        Route::get('/inventory', [InventoryController::class, 'index']);
        Route::post('/inventory', [InventoryController::class, 'store']);
        Route::put('/inventory/{id}', [InventoryController::class, 'update']);
        Route::get('/billing', [BillingController::class, 'index']);
        Route::post('/billing', [BillingController::class, 'store']);
    });

    // Dentist Routes
    Route::middleware('role:dentist')->prefix('dentist')->group(function () {
        Route::get('/appointments', [AppointmentController::class, 'dentistAppointments']);
        Route::get('/patients', [PatientController::class, 'dentistPatients']);
        Route::put('/patients/{id}/records', [PatientController::class, 'updateDentalRecords']);
    });

    // Clinic Admin Routes
    Route::middleware('role:clinic_admin')->prefix('clinic-admin')->group(function () {
        Route::get('/dashboard', [ClinicController::class, 'dashboard']);
        Route::get('/reports', [ClinicController::class, 'reports']);
        Route::put('/clinic', [ClinicController::class, 'update']);
        Route::post('/branches', [ClinicController::class, 'addBranch']);
        Route::put('/branches/{id}', [ClinicController::class, 'updateBranch']);
        Route::get('/subscription', [SubscriptionController::class, 'status']);
    });

    // System Admin Routes
    Route::middleware('role:system_admin')->prefix('system-admin')->group(function () {
        Route::get('/clinics/pending', [ClinicController::class, 'pendingVerifications']);
        Route::post('/clinics/{id}/verify', [ClinicController::class, 'verifyClinic']);
        Route::get('/subscriptions', [SubscriptionController::class, 'index']);
        Route::put('/subscriptions/{id}', [SubscriptionController::class, 'update']);
        Route::get('/users', [UserController::class, 'index']);
        Route::get('/audit-logs', [AuditController::class, 'index']);
    });
});