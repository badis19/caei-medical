<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\VerificationController;
use App\Http\Controllers\PasswordResetController;
// Admin Controllers
use App\Http\Controllers\AdminUserController;
use App\Http\Controllers\AdminAppointmentController;
use App\Http\Controllers\AdminStatisticsController;
use App\Http\Controllers\AdminQuoteController;

// Supervisor Controllers
use App\Http\Controllers\SupervisorAppointmentController;
use App\Http\Controllers\SupervisorQuoteController;
use App\Http\Controllers\SupervisorUserController;
use App\Http\Controllers\SupervisorStatisticsController;
// Agent Controllers
use App\Http\Controllers\AgentAppointmentController;
use App\Http\Controllers\AgentStatisticsController;
// Confirmateur Controllers
use App\Http\Controllers\ConfirmateurAppointmentController;
// Patient Controllers
use App\Http\Controllers\PatientProfileController; // <-- Import
use App\Http\Controllers\PatientQuoteController; 
use Illuminate\Http\Request;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Public Endpoints (Authentication, Verification, Password Reset)

Route::post('/login', [AuthController::class, 'login'])->name('login');

Route::get('/email/verify/{id}/{hash}', [VerificationController::class, 'verify'])->name('verification.verify');
Route::post('/email/resend', [VerificationController::class, 'resend'])->name('verification.resend');

Route::post('/password/forgot', [PasswordResetController::class, 'sendResetLinkEmail'])->name('password.email');
Route::post('/password/reset', [PasswordResetController::class, 'reset'])->name('password.reset');

// Protected Endpoints (Require Sanctum Authentication)
Route::middleware('auth:sanctum')->group(function () {

    // General Authenticated User Routes
    Route::get('/user', function (Request $request) {
        return $request->user()->load('roles:id,name');
    })->name('user');

    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

    // Admin Routes (Protected by 'admin' middleware)
    Route::middleware('admin')->prefix('admin')->name('admin.')->group(function () {
        // User Management
        Route::get('/users', [AdminUserController::class, 'index'])->name('users.index');
        Route::post('/users', [AdminUserController::class, 'store'])->name('users.store');
        Route::get('/users/{id}', [AdminUserController::class, 'show'])->name('users.show');
        Route::put('/users/{id}', [AdminUserController::class, 'update'])->name('users.update');
        Route::delete('/users/{id}', [AdminUserController::class, 'destroy'])->name('users.destroy');

        // ✅ Enable/Disable User
        Route::post('/users/{id}/toggle-status', [AdminUserController::class, 'toggleStatus'])->name('users.toggleStatus');

        // ✅ Patient PDF Files
        Route::get('/users/{id}/patient-files', [AdminUserController::class, 'listPatientFiles'])->name('users.patientFiles');
        Route::get('/files/{id}/download', [AdminUserController::class, 'downloadPatientFile'])->name('files.download');

        // Appointment Management
        Route::get('/appointments', [AdminAppointmentController::class, 'index'])->name('appointments.index');
        Route::get('/appointments/{id}', [AdminAppointmentController::class, 'show'])->name('appointments.show');

        // Statistics
        Route::get('/statistics', [AdminStatisticsController::class, 'getStatistics'])->name('statistics');

        // Quote Management
        Route::get('/quotes', [AdminQuoteController::class, 'index'])->name('quotes.index');
        // ✅ Ajouter devis (create quote)
        Route::post('/quotes', [AdminQuoteController::class, 'store'])->name('quotes.store');
        
        Route::post('/quotes/{id}/upload', [AdminQuoteController::class, 'uploadFile'])->name('quotes.upload');
        Route::get('/quotes/{id}/download', [AdminQuoteController::class, 'download'])->name('quotes.download');
        



    });

    // Supervisor Routes (Protected by 'supervisor' middleware)
    Route::middleware('superviseur')->prefix('superviseur')->name('superviseur.')->group(function () {
        // ✅ User Management
        Route::get('/users', [SupervisorUserController::class, 'index'])->name('users.index');
        Route::post('/users', [SupervisorUserController::class, 'store'])->name('users.store');
        Route::put('/users/{id}', [SupervisorUserController::class, 'update'])->name('users.update');
        Route::delete('/users/{id}', [SupervisorUserController::class, 'destroy'])->name('users.destroy');
        Route::post('/users/{id}/toggle-status', [SupervisorUserController::class, 'toggleStatus'])->name('users.toggleStatus');
    
        // ✅ Patient Files
        Route::get('/users/{id}/patient-files', [SupervisorUserController::class, 'listPatientFiles'])->name('users.patientFiles');
        Route::get('/files/{id}/download', [SupervisorUserController::class, 'downloadPatientFile'])->name('files.download');
    
        // ✅ Appointment Management
        Route::get('/appointments', [SupervisorAppointmentController::class, 'index'])->name('appointments.index');
        Route::get('/appointments/{id}', [SupervisorAppointmentController::class, 'show'])->name('appointments.show');
    
        // ✅ Quote Management
        Route::get('/quotes', [SupervisorQuoteController::class, 'index'])->name('quotes.index');
        Route::post('/quotes', [SupervisorQuoteController::class, 'store'])->name('quotes.store');
        Route::post('/quotes/{id}/upload', [SupervisorQuoteController::class, 'uploadFile'])->name('quotes.upload');
        Route::get('/quotes/{id}/download', [SupervisorQuoteController::class, 'download'])->name('quotes.download');
    
        // ✅ Statistics
        Route::get('/statistics', [SupervisorStatisticsController::class, 'getStatistics'])->name('statistics');
    });
    // Agent Routes (Protected by 'agent' middleware)
    Route::middleware('agent')->prefix('agent')->name('agent.')->group(function () {
        // Appointment Management (Agent can only create and view their own)
        Route::get('/appointments', [AgentAppointmentController::class, 'index'])->name('appointments.index');
        Route::post('/appointments', [AgentAppointmentController::class, 'store'])->name('appointments.store');
        Route::get('/appointments/{id}', [AgentAppointmentController::class, 'show'])->name('appointments.show');
    
        // ⚠️ Removed PUT & DELETE to prevent editing/deleting appointments
        // Route::put('/appointments/{id}', ...) 
        // Route::delete('/appointments/{id}', ...)
    
        // Statistics (Agent views their own)
        Route::get('/statistics', [AgentStatisticsController::class, 'getStats'])->name('statistics');
    
        // Routes for fetching Patients and Clinics (for appointment creation/assignment)
        Route::get('/patients', [AgentAppointmentController::class, 'getPatients'])->name('patients');
        Route::get('/clinics', [AgentAppointmentController::class, 'getClinics'])->name('clinics');
    });
    

    Route::middleware('confirmateur')->prefix('confirmateur')->name('confirmateur.')->group(function () {
        // Appointment Viewing & Status Update
        Route::get('/appointments', [ConfirmateurAppointmentController::class, 'index'])->name('appointments.index');
        Route::get('/appointments/{id}', [ConfirmateurAppointmentController::class, 'show'])->name('appointments.show');
        // Use PATCH for partial update (status only)
        Route::patch('/appointments/{id}/status', [ConfirmateurAppointmentController::class, 'updateStatus'])->name('appointments.updateStatus');
        Route::post('/appointments/{id}/send-confirmation-email', [ConfirmateurAppointmentController::class, 'sendConfirmationEmail'])->name('appointments.sendEmail');
        Route::post('/appointments/{id}/send-confirmation-sms', [ConfirmateurAppointmentController::class, 'sendConfirmationSms'])->name('appointments.sendSms');
    });

    Route::middleware('patient')->prefix('patient')->group(function () {
        Route::get('/profile', [PatientProfileController::class, 'show']);
        Route::put('/profile', [PatientProfileController::class, 'update']);
        Route::get('/appointments', [PatientProfileController::class, 'appointments']);
        Route::post('/medical-files/upload', [PatientProfileController::class, 'uploadMedicalFile']);
        Route::get('/quote', [PatientQuoteController::class, 'show']);
        Route::patch('/quotes/{quote}/status', [PatientQuoteController::class, 'updateStatus']);
        Route::get('/quotes/{id}/download', [PatientQuoteController::class, 'download']);

    });
    


    

    // Add routes for 'Confirmateur', 'Patient', 'Clinique' roles here later
    // Route::middleware('confirmateur')->prefix('confirmateur')->name('confirmateur.')->group(function () { ... });
    // Route::middleware('patient')->prefix('patient')->name('patient.')->group(function () { ... });
    // Route::middleware('clinique')->prefix('clinique')->name('clinique.')->group(function () { ... });

}); // End auth:sanctum middleware group

