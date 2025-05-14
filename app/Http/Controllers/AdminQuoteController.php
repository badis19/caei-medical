<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use App\Models\Quote;
use App\Models\Appointment;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Log;
use App\Events\QuoteSentToPatient;

class AdminQuoteController extends Controller
{
    public function index(Request $request)
    {
        $quotes = Quote::with('appointment');

        if ($request->has('search') && $request->search) {
            $searchTerm = $request->search;
            $quotes->whereHas('appointment', function ($query) use ($searchTerm) {
                $query->where('nom_du_prospect', 'like', "%{$searchTerm}%")
                      ->orWhere('prenom_du_prospect', 'like', "%{$searchTerm}%")
                      ->orWhere('email', 'like', "%{$searchTerm}%");
            });
        }

        $result = $quotes->orderBy('id', 'desc')->paginate(10)->through(function ($quote) {
            return [
                'id' => $quote->id,
                'appointment_id' => $quote->appointment_id,
                'amount' => $quote->amount,
                'status' => $quote->status,
                'comment' => $quote->comment,
                'file_path' => $quote->file_path,
                'filename' => basename($quote->file_path ?? ''),
                'total_quote' => $quote->total_quote,
                'total_clinique' => $quote->total_clinique,
                'total_assistance' => $quote->total_assistance,
                'sent_to_patient_at' => $quote->sent_to_patient_at,
                'appointment' => $quote->appointment,
            ];
        });

        Log::info('Quote API response:', $result->items());
        return response()->json($result);
    }

    public function store(Request $request)
    {
        $request->validate([
            'appointment_id' => 'required|exists:appointments,id',
            'file' => 'nullable|file|mimes:pdf|max:20480',
            'status' => 'nullable|string',
            'comment' => 'nullable|string',
            'total_clinique' => 'nullable|numeric',
            'assistance_items' => 'nullable|array',
            'assistance_items.*.label' => 'required|string',
            'assistance_items.*.amount' => 'required|numeric',
        ]);

        $existingQuote = Quote::where('appointment_id', $request->appointment_id)->first();
        if ($existingQuote) {
            if ($existingQuote->sent_to_patient_at) {
                return response()->json(['error' => 'This quote has already been sent and is locked.'], 403);
            }
            $existingQuote->assistanceQuotes()->delete();
            if ($existingQuote->file_path && Storage::disk('public')->exists($existingQuote->file_path)) {
                Storage::disk('public')->delete($existingQuote->file_path);
            }
            $existingQuote->delete();
        }

        $filePath = null;
        $fileName = null;

        if ($request->hasFile('file')) {
            $filePath = $request->file('file')->store('quotes', 'public');
            $fileName = $request->file('file')->getClientOriginalName();
        }

        // ✅ Ensure filename is never null
        if (!$fileName && $filePath) {
            $fileName = basename($filePath);
        }

        $totalAssistance = collect($request->assistance_items ?? [])->sum('amount');
        $totalClinique = $request->total_clinique ?? 0;
        $totalQuote = $totalAssistance + $totalClinique;

        $quote = Quote::create([
            'appointment_id' => $request->appointment_id,
            'status' => $request->status ?? 'pending',
            'comment' => $request->comment ?? null,
            'file_path' => $filePath,
            'filename' => $fileName,
            'clinique_quote_path' => $filePath,
            'total_clinique' => $totalClinique,
            'total_assistance' => $totalAssistance,
            'total_quote' => $totalQuote,
        ]);

        foreach ($request->assistance_items ?? [] as $item) {
            $quote->assistanceQuotes()->create([
                'label' => $item['label'],
                'amount' => $item['amount'],
            ]);
        }

        Log::info('Quote created:', $quote->toArray());

        return response()->json([
            'message' => 'Quote created with assistance successfully.',
            'quote' => $quote->load('assistanceQuotes'),
        ], 201);
    }

    public function update(Request $request, $id)
    {
        $quote = Quote::with('assistanceQuotes')->findOrFail($id);

        if ($quote->sent_to_patient_at) {
            return response()->json(['error' => 'This quote has already been sent and is locked.'], 403);
        }

        $request->validate([
            'appointment_id' => 'required|exists:appointments,id',
            'total_clinique' => 'nullable|numeric',
            'assistance_items' => 'nullable|array',
            'assistance_items.*.label' => 'required|string',
            'assistance_items.*.amount' => 'required|numeric',
        ]);

        $quote->assistanceQuotes()->delete();

        $totalAssistance = collect($request->assistance_items ?? [])->sum('amount');
        $totalClinique = $request->total_clinique ?? 0;
        $totalQuote = $totalAssistance + $totalClinique;

        $quote->update([
            'appointment_id' => $request->appointment_id,
            'total_clinique' => $totalClinique,
            'total_assistance' => $totalAssistance,
            'total_quote' => $totalQuote,
        ]);

        foreach ($request->assistance_items ?? [] as $item) {
            $quote->assistanceQuotes()->create([
                'label' => $item['label'],
                'amount' => $item['amount'],
            ]);
        }

        // ✅ Ensure filename is present if file_path exists
        if (!$quote->filename && $quote->file_path) {
            $quote->update(['filename' => basename($quote->file_path)]);
        }

        Log::info('Quote updated:', $quote->toArray());

        return response()->json([
            'message' => 'Quote updated successfully.',
            'quote' => $quote->load('assistanceQuotes'),
        ]);
    }

    public function sendToPatient(Request $request, $id)
    {
        $quote = Quote::with(['appointment', 'assistanceQuotes'])->findOrFail($id);

        if ($quote->sent_to_patient_at) {
            return response()->json(['error' => 'Quote has already been sent and is locked.'], 403);
        }

        $patientEmail = $quote->appointment?->email ?? null;
        if (!$patientEmail) {
            return response()->json(['error' => 'No patient email associated with the appointment.'], 422);
        }

        $pdf = Pdf::loadView('quotes.facture', compact('quote'));
        $pdfContent = $pdf->output();

        $filename = "quote-{$quote->id}.pdf";
        $filePath = "quotes/{$filename}";
        Storage::disk('public')->put($filePath, $pdfContent);

        \Mail::send([], [], function ($message) use ($patientEmail, $pdfContent, $filename) {
            $message->to($patientEmail)
                    ->subject('Your Quote')
                    ->attachData($pdfContent, $filename, ['mime' => 'application/pdf']);
        });

        $quote->update([
            'sent_to_patient_at' => now(),
            'file_path' => $filePath,
            'filename' => $filename,
        ]);

        $senderRole = $request->user()->roles->pluck('name')->first();
        event(new QuoteSentToPatient($quote, $senderRole));

        return response()->json(['message' => 'Quote generated, saved, and sent to patient successfully.']);
    }

    public function download($id)
    {
        $quote = Quote::findOrFail($id);

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

    public function exportPdf($id)
    {
        $quote = Quote::with(['appointment', 'assistanceQuotes'])->findOrFail($id);
        $pdf = Pdf::loadView('quotes.facture', compact('quote'));
        $pdfContent = $pdf->output();

        return response($pdfContent, 200)
            ->header('Content-Type', 'application/pdf')
            ->header('Content-Disposition', 'attachment; filename="quote-' . $quote->id . '.pdf"');
    }

    public function preview($id)
    {
        $quote = Quote::with(['appointment', 'assistanceQuotes'])->findOrFail($id);
        $pdf = Pdf::loadView('quotes.facture', compact('quote'));
        return $pdf->stream("quote-{$quote->id}.pdf");
    }

    public function clinicQuotes(Request $request)
    {
        $appointments = Appointment::with(['patient:id,name,last_name,email', 'agent:id,name,last_name'])
            ->whereNotNull('clinic_quote_file')
            ->latest()
            ->paginate(10);

        $appointments->getCollection()->transform(function ($appt) {
            return [
                'id' => $appt->id,
                'patient' => $appt->patient,
                'agent' => $appt->agent,
                'date' => $appt->created_at->toDateTimeString(),
                'file_url' => url(Storage::url($appt->clinic_quote_file)),
            ];
        });

        return response()->json($appointments);
    }
}
