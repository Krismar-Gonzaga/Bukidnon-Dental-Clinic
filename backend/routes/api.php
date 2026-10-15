<?php

use App\Http\Controllers\Api\AppointmentController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ClinicVerificationController;
use App\Http\Controllers\Api\HomeController;
use App\Http\Controllers\Api\PatientController;
use Illuminate\Support\Facades\Route;

/*
| Paths stay under /api (no version prefix) because the mobile app already
| depends on them. Clinic-scoped staff, dentist, clinic-admin and
| system-admin routes are added module by module, each guarded by
| `clinic.permission:<permission>` or `role:system_admin`.
*/

// Public directory
Route::get('/home', [HomeController::class, 'index']);
Route::get('/clinics/search', [HomeController::class, 'searchClinics']);
Route::get('/clinics/{id}', [HomeController::class, 'clinicDetails']);
Route::get('/specializations', [HomeController::class, 'getSpecializations']);
Route::get('/cities', [HomeController::class, 'getCities']);

// Authentication
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:register');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:password-reset');
Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:password-reset');

// Signed-in users (suspended accounts are rejected by `active`)
Route::middleware(['auth:sanctum', 'active'])->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    Route::put('/profile', [AuthController::class, 'updateProfile']);
    Route::post('/change-password', [AuthController::class, 'changePassword']);

    // Patient
    Route::prefix('patient')->group(function () {
        Route::get('/appointments', [AppointmentController::class, 'patientAppointments']);
        Route::post('/appointments', [AppointmentController::class, 'store']);
        Route::put('/appointments/{id}', [AppointmentController::class, 'update']);
        Route::delete('/appointments/{id}', [AppointmentController::class, 'cancel']);
        Route::get('/profile', [PatientController::class, 'profile']);
        Route::put('/profile', [PatientController::class, 'updateProfile']);
    });

    // Clinic verification (reworked into the clinic application workflow later)
    Route::post('/clinic-verification', [ClinicVerificationController::class, 'store']);
    Route::get('/clinic-verification/status', [ClinicVerificationController::class, 'status']);
    Route::put('/clinic-verification/{id}', [ClinicVerificationController::class, 'update']);
});
