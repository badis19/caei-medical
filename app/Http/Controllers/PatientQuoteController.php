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
     * Display the quote associated with the authenticated patient's most recent appointment.
     */
    public function show(Request $request)
    {
        $patientId = Auth::id();

        // Find the latest appointment for this patient that HAS a quote
        $appointmentWithQuote = Appointment::where('patient_id', $patientId)
            ->whereHas('quote')
            ->with([
                'quote',
                'agent:id,name,last_name',
                'clinique:id,name'
            ])
            ->latest('date_du_rdv')
            ->first();

        if (!$appointmentWithQuote || !$appointmentWithQuote->quote) {
            return response()->json(['message' => 'No quote found for your appointments.'], 404);
        }

        return response()->json([
            'quote' => [
                'id' => $appointmentWithQuote->quote->id,
                'status' => $appointmentWithQuote->quote->status,
                'amount' => $appointmentWithQuote->quote->amount, // ✅ Ensure this is returned
                'comment' => $appointmentWithQuote->quote->comment,
                'filename' => $appointmentWithQuote->quote->filename, // ✅ Optional for display
                'file_path' => $appointmentWithQuote->quote->file_path, // ✅ Needed for PDF download
            ],
            'appointment' => [
                'id' => $appointmentWithQuote->id,
                'service' => $appointmentWithQuote->service,
                'date_du_rdv' => $appointmentWithQuote->date_du_rdv,
                'agent' => $appointmentWithQuote->agent,
                'clinique' => $appointmentWithQuote->clinique,
            ]
        ]);
        
    }

    /**
     * Update the status of the specified quote (accept or refuse) with optional rejection comment.
     */
    public function updateStatus(Request $request, $quoteId)
{
    $patientId = Auth::id(); // ✅ Add this line

    $rules = [
        'status' => ['required', 'string', Rule::in(['accepted', 'refused'])],
    ];
    
    if ($request->input('status') === 'refused') {
        $rules['comment'] = 'required|string|max:1000';
    } else {
        $rules['comment'] = 'nullable|string|max:1000';
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

    // Store comment if refused
    if ($validatedData['status'] === 'refused') {
        $quote->comment = $validatedData['comment'];
    }

    $quote->save();

    return response()->json($quote);
}
public function download($id)
{
    $user = Auth::user();
    $quote = Quote::with('appointment')->findOrFail($id);

    // ✅ Ensure quote belongs to the current patient
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
