<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use App\Models\Appointment;

class CliniqueAppointmentController extends Controller
{
    // GET /clinique/appointments
    public function index(Request $request)
{
    $appointments = Appointment::with([
            'patient:id,name,last_name,email',
            'agent:id,name,last_name',
            'quote:id,appointment_id,status'
        ])
        ->where('clinique_id', $request->user()->id)
        ->latest()
        ->paginate(15);

    // Add file_url to each appointment
    $appointments->getCollection()->transform(function ($appt) {
        $appt->file_url = $appt->clinic_quote_file ? Storage::disk('public')->url($appt->clinic_quote_file) : null;
        return $appt;
    });

    return response()->json($appointments);
}


    // POST /clinique/appointments/{id}/upload-quote
    public function uploadQuote(Request $request, $appointmentId)
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf|max:20480',
        ]);

        $appointment = Appointment::where('id', $appointmentId)
            ->where('clinique_id', $request->user()->id)
            ->firstOrFail();

        // Delete old file if exists
        if ($appointment->clinic_quote_file) {
            Storage::disk('public')->delete($appointment->clinic_quote_file);
        }

        $path = $request->file('file')->store('clinic-quotes', 'public');

        $appointment->clinic_quote_file = $path;
        $appointment->save();

        return response()->json([
            'message' => 'Clinic quote uploaded successfully.',
            'file_url' => Storage::disk('public')->url($path),
        ]);
    }

    public function deleteQuote(Request $request, $appointmentId)
{
    $appointment = Appointment::where('id', $appointmentId)
        ->where('clinique_id', $request->user()->id)
        ->firstOrFail();

    if ($appointment->clinic_quote_file) {
        Storage::disk('public')->delete($appointment->clinic_quote_file);
        $appointment->clinic_quote_file = null;
        $appointment->save();
    }

    return response()->json(['message' => 'Quote deleted successfully.']);
}

}
