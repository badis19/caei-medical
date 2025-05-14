<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\Appointment;
use App\Models\Quote;
use Illuminate\Validation\Rule;

class PatientQuoteController extends Controller
{
    /**
     * Return all quotes associated with the authenticated patient's appointments.
     */
    public function index(Request $request)
    {
        $patientId = Auth::id();

        $appointmentsWithQuotes = Appointment::where('patient_id', $patientId)
    ->whereHas('quote', function ($q) {
    $q->whereNotNull('sent_to_patient_at')
      ->whereNotNull('file_path'); // Only include quotes that have files
})
    ->with(['quote', 'agent:id,name,last_name', 'clinique:id,name'])
    ->orderByDesc('date_du_rdv')
    ->get();


        if ($appointmentsWithQuotes->isEmpty()) {
            return response()->json(['message' => 'No quotes found for your appointments.'], 404);
        }

        $results = $appointmentsWithQuotes->map(function ($appt) {
            return [
                'quote' => [
                    'id' => $appt->quote->id,
                    'status' => $appt->quote->status,
                    'amount' => $appt->quote->amount,
                    'comment' => $appt->quote->comment,
                    'filename' => $appt->quote->filename ?? basename($appt->quote->file_path ?? ''),

                    'file_path' => $appt->quote->file_path,
                ],
                'appointment' => [
                    'id' => $appt->id,
                    'service' => $appt->service,
                    'date_du_rdv' => $appt->date_du_rdv,
                    'agent' => $appt->agent,
                    'clinique' => $appt->clinique,
                ]
            ];
        });

        return response()->json($results);
    }

    /**
     * Update the status of the specified quote (accept or refuse).
     */
    public function updateStatus(Request $request, $quoteId)
    {
        $patientId = Auth::id();

        $rules = [
            'status' => ['required', 'string', Rule::in(['accepted', 'refused'])],
            'comment' => 'nullable|string|max:1000',
        ];

        if ($request->input('status') === 'refused') {
            $rules['comment'] = 'required|string|max:1000';
        }

        $validatedData = $request->validate($rules);

        $quote = Quote::find($quoteId);

        if (!$quote) {
            return response()->json(['message' => 'Quote not found.'], 404);
        }

        $appointment = $quote->appointment;
        if (!$appointment || $appointment->patient_id !== $patientId) {
            return response()->json(['message' => 'Forbidden: You cannot modify this quote.'], 403);
        }

        if (in_array($quote->status, ['accepted', 'refused'])) {
            return response()->json(['message' => 'Quote status has already been finalized.'], 400);
        }

        $quote->status = $validatedData['status'];

        if ($validatedData['status'] === 'refused') {
            $quote->comment = $validatedData['comment'];
        }

        $quote->save();

        return response()->json($quote);
    }

    /**
     * Download a quote PDF (ensures access is restricted to owner).
     */
    public function download($id)
    {
        $user = Auth::user();
        $quote = Quote::with('appointment')->findOrFail($id);

        if (!$quote->appointment || $quote->appointment->patient_id !== $user->id) {
            return response()->json(['error' => 'Unauthorized access.'], 403);
        }

        if (!$quote->file_path) {
            return response()->json(['error' => 'File not found.'], 404);
        }

        $filePath = storage_path('app/public/' . $quote->file_path);

        if (!file_exists($filePath)) {
            return response()->json(['error' => 'File does not exist on server.'], 404);
        }

        $filename = $quote->filename ?? basename($quote->file_path) ?? 'quote.pdf';
        return response()->download($filePath, $filename);
    }
}
