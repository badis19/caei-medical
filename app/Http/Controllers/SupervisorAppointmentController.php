<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Appointment;

class SupervisorAppointmentController extends Controller
{
      public function index(Request $request)
{
    $perPage = $request->query('limit', 10); // default to 10 if not provided
    return response()->json(Appointment::paginate($perPage));
}

    // Display a single appointment
    public function show($id)
    {
        $appointment = Appointment::find($id);
        if (!$appointment) {
            return response()->json(['message' => 'Appointment not found'], 404);
        }
        return response()->json($appointment);
    }
}