<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Response;
use App\Models\Quote;

class SupervisorQuoteController extends Controller
{
    /**
     * List quotes with optional search by patient name/email
     */
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

        return response()->json(
            $quotes->paginate(10)->through(function ($quote) {
                return [
                    'id' => $quote->id,
                    'amount' => $quote->amount,
                    'status' => $quote->status,
                    'comment' => $quote->comment,
                    'file_path' => $quote->file_path,
                    'filename' => basename($quote->file_path ?? ''),
                    'appointment' => $quote->appointment,
                ];
            })
        );
    }

    /**
     * Store a new quote (supervisor can only create for non-admin users)
     */
    public function store(Request $request)
    {
        $request->validate([
            'appointment_id' => 'required|exists:appointments,id',
            'file' => 'required|file|mimes:pdf|max:20480'
        ]);

        $existingQuote = Quote::where('appointment_id', $request->appointment_id)->first();
        if ($existingQuote) {
            return response()->json([
                'message' => 'A quote already exists for this appointment.'
            ], 422);
        }

        $filePath = $request->file('file')->store('quotes', 'public');

        $quote = Quote::create([
            'appointment_id' => $request->appointment_id,
            'file_path' => $filePath,
            'filename' => $request->file('file')->getClientOriginalName(),
            'status' => 'pending',
        ]);

        return response()->json($quote, 201);
    }

    /**
     * Upload or replace a PDF file for a quote
     */
    public function uploadFile(Request $request, $id)
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf|max:20480'
        ]);

        $quote = Quote::findOrFail($id);

        if ($quote->file_path) {
            Storage::disk('public')->delete($quote->file_path);
        }

        $path = $request->file('file')->store('quotes', 'public');

        $quote->file_path = $path;
        $quote->filename = $request->file('file')->getClientOriginalName();
        $quote->save();

        return response()->json([
            'message' => 'File uploaded successfully.',
            'path' => $path
        ]);
    }

    /**
     * Download a quote file by ID
     */
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
                'file_url' => Storage::disk('public')->url($appt->clinic_quote_file),
            ];
        });
    
        return response()->json($appointments);
    }
    
}
