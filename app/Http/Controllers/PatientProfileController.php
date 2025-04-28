<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\User;

class PatientProfileController extends Controller
{
    /**
     * Display the authenticated patient's profile information.
     *
     * @param  \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function show(Request $request)
    {
        $patient = $request->user(); // Get the authenticated user

        return response()->json($patient->only([
            'id', 'name', 'last_name', 'email', 'telephone',
            'date_de_naissance',
            'adresse',
            'allergies',
            'medical_history',
        ]));
    }

    /**
     * Upload a medical file (PDF) for the authenticated patient.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function uploadMedicalFile(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf|max:20480' // Max 20MB
        ]);

        $user = $request->user();
        $file = $request->file('file');

        $path = $file->store('patient_files', 'public');

        $record = $user->patientFiles()->create([
            'file_name' => $file->getClientOriginalName(),
            'file_path' => $path,
        ]);

        return response()->json([
            'message' => 'Medical file uploaded.',
            'file' => $record
        ], 201);
    }

    /**
     * Get the list of the authenticated patient's appointments.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function appointments(Request $request)
    {
        $appointments = $request->user()
            ->patientAppointments()
            ->latest('date_du_rdv')
            ->get();

        return response()->json($appointments);
    }
}
