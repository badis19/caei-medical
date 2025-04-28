<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Response;
use App\Models\Quote;
use Illuminate\Support\Facades\Auth;

class AdminQuoteController extends Controller
{
    public function index(Request $request)
    {
        $quotes = Quote::with('appointment');

        // 🔍 Search by prospect name or email
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
                    'comment' => $quote->comment, // ✅ Added comment here
                    'file_path' => $quote->file_path,
                    'filename' => basename($quote->file_path ?? ''),
                    'appointment' => $quote->appointment,
                ];
            })
        );
    }

    public function store(Request $request)
    {
        $request->validate([
            'appointment_id' => 'required|exists:appointments,id',
            'file' => 'required|file|mimes:pdf|max:20480'
        ]);

        // ❗ Check if a quote already exists for this appointment
        $existingQuote = Quote::where('appointment_id', $request->appointment_id)->first();
        if ($existingQuote) {
            return response()->json([
                'message' => 'A quote already exists for this appointment.'
            ], 422);
        }

        // ✅ Store file
        $filePath = $request->file('file')->store('quotes', 'public');

        // ✅ Create quote with default status
        $quote = Quote::create([
            'appointment_id' => $request->appointment_id,
            'file_path' => $filePath,
            'filename' => $request->file('file')->getClientOriginalName(),
            'status' => 'pending', // ✅ Set default status
        ]);

        return response()->json($quote, 201);
    }

    public function uploadFile(Request $request, $id)
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf|max:20480' // 20MB max
        ]);

        $quote = Quote::findOrFail($id);

        if ($quote->file_path) {
            Storage::disk('public')->delete($quote->file_path);
        }

        $path = $request->file('file')->store('quotes', 'public');
        $quote->file_path = $path;
        $quote->filename = $request->file('file')->getClientOriginalName(); // ✅ Preserve filename
        $quote->save();

        return response()->json([
            'message' => 'File uploaded successfully.',
            'path' => $path
        ]);
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
}
