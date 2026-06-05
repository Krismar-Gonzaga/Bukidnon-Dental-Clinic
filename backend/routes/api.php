<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\ClinicController;
use App\Http\Controllers\Api\ServiceController;
use App\Http\Controllers\Api\AuthController;

// Public routes
Route::get('/clinics', [ClinicController::class, 'index']);
Route::get('/clinics/featured', [ClinicController::class, 'featured']);
Route::get('/clinics/search', [ClinicController::class, 'search']);
Route::get('/clinics/{id}', [ClinicController::class, 'show']);
Route::get('/services', [ServiceController::class, 'index']);
Route::get('/services/popular', [ServiceController::class, 'popular']);
Route::get('/services/rates', [ServiceController::class, 'rates']);
Route::get('/clinics/{clinicId}/rates', [ServiceController::class, 'clinicRates']);

// Auth routes
Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

// Protected routes (require authentication)
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/appointments/book', [AppointmentController::class, 'store']); // Create this controller
});