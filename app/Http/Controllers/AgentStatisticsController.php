<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Appointment;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class AgentStatisticsController extends Controller
{
    public function getStats(Request $request)
    {
        $request->validate([
            'month' => 'nullable|integer|between:1,12',
            'year' => 'nullable|integer|min:2000|max:' . (now()->year + 1),
        ]);

        $agentId = Auth::id();
        $month = $request->input('month', Carbon::now()->month);
        $year = $request->input('year', Carbon::now()->year);

        $baseQuery = Appointment::where('agent_id', $agentId)
                                ->whereYear('date_du_rdv', $year);

        $monthlyQuery = $baseQuery->clone();
        if ($month) {
            $monthlyQuery->whereMonth('date_du_rdv', $month);
        } else {
            $month = null;
        }

        $totalAppointments = $monthlyQuery->count();
        $confirmedAppointments = $monthlyQuery->clone()->where('status', 'confirmed')->count();
        $cancelledAppointments = $monthlyQuery->clone()->where('status', 'cancelled')->count();
        $pendingAppointments = $monthlyQuery->clone()->where('status', 'pending')->count();

        // ✅ Evolution data (grouped by week)
        // Group stats by day for the month
        $evolution = [];

        if ($month) {
            $startDate = Carbon::create($year, $month, 1)->startOfMonth();
            $endDate = (clone $startDate)->endOfMonth();
        
            $dailyData = Appointment::where('agent_id', $agentId)
                ->whereBetween('date_du_rdv', [$startDate, $endDate])
                ->get()
                ->groupBy(function ($appointment) {
                    return Carbon::parse($appointment->date_du_rdv)->format('Y-m-d');
                });
        
            foreach ($startDate->copy()->daysUntil($endDate->copy()->addDay()) as $date) {
                $dateStr = $date->format('Y-m-d');
                $appointments = $dailyData->get($dateStr, collect());
        
                $evolution[] = [
                    'date' => $dateStr,
                    'confirmed' => $appointments->where('status', 'confirmed')->count(),
                    'cancelled' => $appointments->where('status', 'cancelled')->count(),
                    'pending' => $appointments->where('status', 'pending')->count(),
                ];
            }
        }
        


        // ✅ Return full statistics with evolution
        return response()->json([
            'requested_month' => $month,
            'requested_year' => $year,
            'total_appointments' => $totalAppointments,
            'confirmed_appointments' => $confirmedAppointments,
            'cancelled_appointments' => $cancelledAppointments,
            'pending_appointments' => $pendingAppointments,
            'evolution' => $evolution,
        ]);
    }
}
