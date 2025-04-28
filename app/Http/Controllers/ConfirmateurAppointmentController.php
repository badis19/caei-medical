<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Appointment;
use App\Models\User; // If needed
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule; // Import Rule
use Illuminate\Support\Facades\Log; // Import Log for logging
class ConfirmateurAppointmentController extends Controller
{
    /**
     * Display a listing of appointments relevant to the confirmateur.
     * Defaults to showing 'pending' appointments, but allows filtering.
     *
     * @param \Illuminate\Http\Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function index(Request $request)
    {
        // --- Potential Issue Point 1: Validation ---
        // If the request contains invalid data (e.g., bad date format),
        // validation might fail and throw an exception if not handled gracefully.
        // Laravel usually returns 422, but custom handlers could cause 500.
        try {
             $request->validate([
                'status' => ['nullable', 'string', Rule::in(['pending', 'confirmed', 'cancelled'])],
                'start_date' => 'nullable|date_format:Y-m-d', // Strict format
                'end_date' => 'nullable|date_format:Y-m-d|after_or_equal:start_date',
             ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            // Log the validation error for debugging, though it should return 422
            \Log::error('Confirmateur Appointment Index Validation Failed:', $e->errors());
            // Re-throw or handle appropriately - usually Laravel handles this
            throw $e;
        }


        $query = Appointment::query();

        // Filter by status - default to 'pending' if no status specified
        $statusFilter = $request->input('status', 'pending'); // Default to pending
        if ($statusFilter) {
             // --- Potential Issue Point 2: Incorrect Column Name ---
             // Double-check 'status' is the correct column name in your 'appointments' table.
            $query->where('status', $statusFilter);
        }

        // Optional Date Range Filter
        if ($request->filled('start_date')) {
            // --- Potential Issue Point 3: Incorrect Date Column Name ---
            // Double-check 'date_du_rdv' is the correct column name.
            $query->whereDate('date_du_rdv', '>=', $request->start_date);
        }
        if ($request->filled('end_date')) {
             // Double-check 'date_du_rdv' is the correct column name.
            $query->whereDate('date_du_rdv', '<=', $request->end_date);
        }

        // --- Potential Issue Point 4: Eager Loading Issues ---
        // Problems in relationship definitions or selected columns can cause errors.
        try {
            $query->with([
                // Check model relationships & column names:
                'patient:id,name,last_name,email,telephone', // Does User model have these? Accessible?
                'agent:id,name,last_name',                // Does User model have these? Accessible?
                'clinique:id,name',                       // Does User model have 'name'? Accessible?
                'quote:id,appointment_id,status'          // Does Quote model have these? Accessible?
            ]);
        } catch (\Exception $e) {
             \Log::error('Confirmateur Appointment Index Eager Loading Failed:', ['message' => $e->getMessage()]);
             // Return an error response instead of letting it bubble up to a generic 500
              return response()->json(['message' => 'Server error retrieving related appointment data.'], 500);
        }


        // Order by appointment date, paginate
        try {
            // --- Potential Issue Point 5: Ordering/Pagination ---
            // Incorrect column 'date_du_rdv' or DB issues during pagination.
            $appointments = $query->orderBy('date_du_rdv', 'asc')
                                   ->paginate(20); // Make sure pagination doesn't cause issues (e.g., DB connection)
        } catch (\Exception $e) {
            \Log::error('Confirmateur Appointment Index Query Execution Failed:', ['message' => $e->getMessage()]);
            // Return an error response
             return response()->json(['message' => 'Server error retrieving appointments list.'], 500);
        }


        return response()->json($appointments);
    }

    /**
     * Update the status of the specified appointment.
     * Only allows changing status to 'confirmed' or 'cancelled'.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function updateStatus(Request $request, $id)
    {
        // Define the only statuses a confirmateur can set
        $validStatuses = ['confirmed', 'cancelled'];

        // Validate the incoming status
        $validatedData = $request->validate([
            'status' => ['required', 'string', Rule::in($validStatuses)],
            // Optionally allow adding a confirmation comment
            'commentaire_confirmateur' => 'nullable|string|max:1000', // Example field name
        ]);

        $appointment = Appointment::findOrFail($id);

        // --- Optional: Add logic to prevent re-confirming/cancelling ---
        // if ($appointment->status === $validatedData['status']) {
        //     return response()->json(['message' => 'Appointment already has this status.'], 400);
        // }
        // if (in_array($appointment->status, ['confirmed', 'cancelled']) && $appointment->status !== 'pending') {
        //      // More complex logic might be needed if you allow changing FROM confirmed/cancelled
        //     return response()->json(['message' => 'Appointment status cannot be changed from its current state.'], 400);
        // }
        // --- End Optional Logic ---


        // Update only the status (and potentially the comment)
        $appointment->status = $validatedData['status'];

        // If you add a comment field to your appointments table:
        // if (isset($validatedData['commentaire_confirmateur'])) {
        //    $appointment->commentaire_confirmateur = $validatedData['commentaire_confirmateur'];
        // }

        $appointment->save(); // Save the changes

        // Return the updated appointment with relations potentially needed by frontend
        return response()->json($appointment->load(['patient:id,name,last_name', 'agent:id,name,last_name', 'quote']));
    }

    public function sendConfirmationEmail(Request $request, $id)
    {
        $appointment = Appointment::with('patient:id,name,email')->findOrFail($id);

        if (!$appointment->patient || !$appointment->patient->email) {
             return response()->json(['message' => 'Cannot send email: Patient email address is missing.'], 400);
        }
        // Optional status check...

        // --- Log the simulated email sending to default log ---
        $logMessage = sprintf(
            "[Confirmation Simulation] Email would be sent to patient %s (%s) for appointment ID %d on %s.", // Added prefix for clarity
            $appointment->patient->name,
            $appointment->patient->email,
            $appointment->id,
            $appointment->date_du_rdv->format('Y-m-d H:i')
        );

        // Log::channel('confirmations')->info($logMessage); // Removed channel specific logging
        Log::info($logMessage); // <-- Log to the default channel

        // Optional update logic...

        return response()->json(['message' => 'Confirmation email logged successfully (simulation).']);
    }

    /**
     * Simulate sending a confirmation request SMS to the patient.
     * Logs the action to the default log channel. // Updated comment
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id Appointment ID
     * @return \Illuminate\Http\JsonResponse
     */
    public function sendConfirmationSms(Request $request, $id)
    {
        $appointment = Appointment::with('patient:id,name,telephone')->findOrFail($id);

        if (!$appointment->patient || !$appointment->patient->telephone) {
             return response()->json(['message' => 'Cannot send SMS: Patient telephone number is missing.'], 400);
        }
         // Optional status check...

        // --- Log the simulated SMS sending to default log ---
        $logMessage = sprintf(
            "[Confirmation Simulation] SMS would be sent to patient %s (%s) for appointment ID %d on %s.", // Added prefix for clarity
            $appointment->patient->name,
            $appointment->patient->telephone,
            $appointment->id,
            $appointment->date_du_rdv->format('Y-m-d H:i')
        );

         // Log::channel('confirmations')->info($logMessage); // Removed channel specific logging
         Log::info($logMessage); // <-- Log to the default channel

         // Optional update logic...

        return response()->json(['message' => 'Confirmation SMS logged successfully (simulation).']);
    }
}