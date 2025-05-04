<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Appointment;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class AgentAppointmentController extends Controller
{
    public function index(Request $request)
    {
        $query = Appointment::where('agent_id', Auth::id())
                            ->with(['patient:id,name,last_name,email', 'clinique:id,name', 'quote:id,appointment_id,status']);

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

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'patient_id' => ['required', 'integer', Rule::exists('users', 'id')],
            'whatsapp' => 'required|boolean',
            'service' => 'required|string|max:255',
            'date_du_rdv' => 'required|date|after_or_equal:today',
            'clinique_id' => ['nullable', 'integer', Rule::exists('users', 'id')],
            'commentaire_agent' => 'nullable|string',
            'qualification' => 'nullable|string',
            'commentaire_1' => 'nullable|string',
            'commentaire_2' => 'nullable|string',
            'type_de_soins' => 'nullable|string',
            'intervention' => 'nullable|string',
            'prise_en_charge' => 'nullable|string',
            'budget' => 'nullable|numeric',
            'date_intervention' => 'nullable|date',
            'objectif' => 'nullable|string',
        ]);
        

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $data = $validator->validated();

        // Only allow appointments for already existing patients
        $patient = User::role('patient')->find($data['patient_id']);
if (!$patient) {
    return response()->json([
        'message' => 'Invalid patient selected.',
        'errors' => ['patient_id' => ['This ID does not match any existing patient.']]
    ], 422);
}


        // Optional: Check if clinic is valid
        if (!empty($data['clinique_id'])) {
            $clinic = User::find($data['clinique_id']);
            if (!$clinic || !$clinic->hasRole('clinique')) {
                return response()->json([
                    'message' => 'Invalid clinic selected.',
                    'errors' => ['clinique_id' => ['The selected clinic is not valid.']]
                ], 422);
            }
        }

        $appointment = Appointment::create(array_merge(
            $data,
            [
                'agent_id' => Auth::id(),
                'status' => 'pending',
                'nom_du_prospect' => $patient->last_name,
                'prenom_du_prospect' => $patient->name,
                'telephone' => $patient->telephone ?? 'N/A',
                'email' => $patient->email,
            ]
        ));
        

        return response()->json($appointment->load(['patient:id,name,last_name', 'clinique:id,name']), 201);
    }

    public function show($id)
    {
        $appointment = Appointment::with(['patient', 'clinique', 'quote'])->findOrFail($id);

        if ($appointment->agent_id !== Auth::id()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        return response()->json($appointment);
    }

    // Prevent update
    public function update()
    {
        return response()->json(['message' => 'Agents are not allowed to edit appointments.'], 403);
    }

    // Prevent delete
    public function destroy()
    {
        return response()->json(['message' => 'Agents are not allowed to delete appointments.'], 403);
    }

    public function getPatients(Request $request)
    {
        return response()->json(
            User::role('patient')
                ->select('id', 'name', 'last_name', 'email', 'telephone')
                ->when($request->search, function ($query, $search) {
                    $query->where(function ($q) use ($search) {
                        $q->where('name', 'like', "%$search%")
                          ->orWhere('last_name', 'like', "%$search%")
                          ->orWhere('email', 'like', "%$search%")
                          ->orWhere('telephone', 'like', "%$search%");
                    });
                })->limit(50)->get()
        );
    }

    public function getClinics(Request $request)
    {
        return response()->json(
            User::role('clinique')
                ->select('id', 'name')
                ->when($request->search, fn($q, $search) => $q->where('name', 'like', "%$search%"))
                ->limit(50)->get()
        );
    }
}
