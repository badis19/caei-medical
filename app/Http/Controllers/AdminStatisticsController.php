<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Appointment;
use Carbon\Carbon;

class AdminStatisticsController extends Controller
{
    public function getStatistics(Request $request)
    {
        $month = $request->input('month', now()->month);
        $year = $request->input('year', now()->year);
    
        // Get all days in the month as labels
        $daysInMonth = Carbon::create($year, $month)->daysInMonth;
        $labels = [];
        for ($i = 1; $i <= $daysInMonth; $i++) {
            $labels[] = str_pad($i, 2, '0', STR_PAD_LEFT);
        }
    
        // Fetch appointments
        $appointments = Appointment::whereMonth('date_du_rdv', $month)
            ->whereYear('date_du_rdv', $year)
            ->whereNotNull('agent_id')
            ->with('agent:id,name,last_name')
            ->get();
    
        $agentsData = [];
    
        foreach ($appointments as $appointment) {
            $agentId = $appointment->agent_id;
            $agentName = optional($appointment->agent)->name . ' ' . optional($appointment->agent)->last_name;
            $day = Carbon::parse($appointment->date_du_rdv)->format('d');
    
            // Init agent dataset if not set
            if (!isset($agentsData[$agentId])) {
                $agentsData[$agentId] = [
                    'label' => trim($agentName),
                    'data' => array_fill(0, $daysInMonth, 0),
                ];
            }
    
            // Convert day to zero-based index for data array
            $dayIndex = (int)$day - 1;
            $agentsData[$agentId]['data'][$dayIndex]++;
        }
    
        return response()->json([
            'labels' => $labels,
            'datasets' => array_values($agentsData),
        ]);
    }
    
}