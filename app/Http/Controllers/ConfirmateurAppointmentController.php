<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use App\Mail\AppointmentStatusUpdated as AppointmentStatusUpdatedMail;
use App\Events\AppointmentStatusUpdated;

class ConfirmateurAppointmentController extends Controller
{
    // GET /confirmateur/appointments
    public function index(Request $request)
    {
        $query = Appointment::with([
            'patient:id,name,last_name,email,telephone',
            'clinique:id,name',
            'agent:id,name,last_name'
        ]);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('start_date')) {
            $query->whereDate('date_du_rdv', '>=', $request->start_date);
        }

        if ($request->has('end_date')) {
            $query->whereDate('date_du_rdv', '<=', $request->end_date);
        }

        return response()->json($query->latest()->paginate(15));
    }

    // GET /confirmateur/appointments/{id}
    public function show($id)
    {
        $appointment = Appointment::with([
            'patient:id,name,last_name,email',
            'clinique:id,name'
        ])->findOrFail($id);

        return response()->json($appointment);
    }

    // PATCH /confirmateur/appointments/{id}/status
    public function updateStatus(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:confirmed,cancelled',
        ]);

        $appointment = Appointment::with(['patient', 'clinique', 'agent'])->findOrFail($id);
        $appointment->status = $request->status;
        $appointment->save();

        // 🔄 Broadcast the status update to admin, superviseur, and patient
        event(new AppointmentStatusUpdated($appointment));

        // 📧 Send email notification to the patient
        if ($appointment->patient && $appointment->patient->email) {
            Mail::to($appointment->patient->email)->send(new AppointmentStatusUpdatedMail($appointment));
        }

        return response()->json([
            'message' => "Appointment {$appointment->id} updated to {$appointment->status}, broadcasted and email sent.",
            'appointment' => $appointment->load(
                'patient:id,name,last_name,email,telephone',
                'agent:id,name,last_name',
                'clinique:id,name'
            ),
        ]);
    }

    // POST /confirmateur/appointments/{id}/send-confirmation-email
    public function sendConfirmationEmail($id)
    {
        $appointment = Appointment::with('patient')->findOrFail($id);

        if ($appointment->patient && $appointment->patient->email) {
            Mail::to($appointment->patient->email)->send(new AppointmentStatusUpdatedMail($appointment));
            return response()->json(['message' => 'Confirmation email sent.']);
        }

        return response()->json(['message' => 'No valid patient email found.'], 422);
    }

    // POST /confirmateur/appointments/{id}/send-confirmation-sms
    public function sendConfirmationSms($id)
    {
        $appointment = Appointment::with('patient')->findOrFail($id);

        if ($appointment->patient && $appointment->patient->telephone) {
            // Simulate SMS sending
            // Example: Twilio::send($appointment->patient->telephone, "Your appointment on {$appointment->date_du_rdv} is {$appointment->status}.");
            return response()->json(['message' => 'SMS sent (simulation).']);
        }

        return response()->json(['message' => 'No valid patient phone number found.'], 422);
    }
}
