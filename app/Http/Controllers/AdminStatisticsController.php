<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Appointment;
use App\Models\Quote;
use Carbon\Carbon;

class AdminStatisticsController extends Controller
{
    public function getStatistics(Request $request)
    {
        $month = $request->input('month', now()->month);
        $year = $request->input('year', now()->year);
        $granularity = $request->input('granularity', 'daily');
        $comparePrevious = (bool) $request->input('compare_previous', false);

        // Base date range
        if ($granularity === 'monthly') {
    $startDate = Carbon::create($year, 1)->startOfMonth();
    $endDate = Carbon::create($year, 12)->endOfMonth();
} else {
    $startDate = Carbon::create($year, $month)->startOfMonth();
    $endDate = Carbon::create($year, $month)->endOfMonth();
}


        // Prepare labels and period
        $labels = [];
        $period = [];

        if ($granularity === 'weekly') {
            $start = $startDate->copy()->startOfWeek();
            $end = $endDate->copy()->endOfWeek();
            while ($start <= $end) {
                $labels[] = 'Semaine ' . $start->copy()->format('W');
                $period[] = $start->copy();
                $start->addWeek();
            }
        } elseif ($granularity === 'monthly') {
            for ($i = 1; $i <= 12; $i++) {
                $labels[] = Carbon::create(null, $i)->translatedFormat('F');
                $period[] = Carbon::create($year, $i);
            }
        } else {
            // Default: daily
            $daysInMonth = $startDate->daysInMonth;
            for ($i = 1; $i <= $daysInMonth; $i++) {
                $labels[] = str_pad($i, 2, '0', STR_PAD_LEFT);
                $period[] = Carbon::create($year, $month, $i);
            }
        }

        // Helper to group appointment data
        $buildAgentDataset = function ($appointments, $isComparison = false) use ($labels, $granularity) {
            $agentsData = [];
            foreach ($appointments as $appointment) {
                $agentId = $appointment->agent_id;
                $agentName = optional($appointment->agent)->name . ' ' . optional($appointment->agent)->last_name;

                $index = match ($granularity) {
                    'weekly' => array_search('Semaine ' . Carbon::parse($appointment->date_du_rdv)->format('W'), $labels),
                    'monthly' => Carbon::parse($appointment->date_du_rdv)->month - 1,
                    default => Carbon::parse($appointment->date_du_rdv)->day - 1,
                };

                if (!isset($agentsData[$agentId])) {
                    $agentsData[$agentId] = [
                        'label' => trim($agentName) . ($isComparison ? ' (Période précédente)' : ''),
                        'data' => array_fill(0, count($labels), 0),
                    ];
                }

                if ($index !== false && $index !== null) {
                    $agentsData[$agentId]['data'][$index]++;
                }
            }
            return $agentsData;
        };

        // Fetch current appointments
        $appointments = Appointment::whereBetween('date_du_rdv', [$startDate, $endDate])
            ->whereNotNull('agent_id')
            ->with('agent:id,name,last_name')
            ->get();

        $agentsData = $buildAgentDataset($appointments, false);

        // Summary
        $totalAppointments = $appointments->count();
        $totalQuotes = Quote::whereBetween('created_at', [$startDate, $endDate])->count();
        $acceptedQuotes = Quote::whereBetween('created_at', [$startDate, $endDate])
            ->where('status', 'accepted')
            ->count();

        $acceptedPercentage = $totalQuotes > 0 ? ($acceptedQuotes / $totalQuotes) * 100 : 0;

        $previousStats = null;

        if ($comparePrevious) {
            $previousStart = $startDate->copy()->subMonth()->startOfMonth();
            $previousEnd = $startDate->copy()->subMonth()->endOfMonth();

            $previousAppointments = Appointment::whereBetween('date_du_rdv', [$previousStart, $previousEnd])
                ->whereNotNull('agent_id')
                ->with('agent:id,name,last_name')
                ->get();

            $previousAgentsData = $buildAgentDataset($previousAppointments, true);
            $agentsData = array_merge($agentsData, $previousAgentsData);

            $previousQuotes = Quote::whereBetween('created_at', [$previousStart, $previousEnd])->count();
            $previousAcceptedQuotes = Quote::whereBetween('created_at', [$previousStart, $previousEnd])
                ->where('status', 'accepted')
                ->count();

            $previousAcceptedRate = $previousQuotes > 0 ? ($previousAcceptedQuotes / $previousQuotes) * 100 : 0;

            $previousStats = [
                'appointments' => $previousAppointments->count(),
                'quotes' => $previousQuotes,
                'accepted_percentage' => round($previousAcceptedRate, 2),
            ];
        }

        return response()->json([
            'labels' => $labels,
            'datasets' => array_values($agentsData),
            'total_appointments' => $totalAppointments,
            'total_quotes' => $totalQuotes,
            'accepted_percentage' => round($acceptedPercentage, 2),
            'previous' => $previousStats,
        ]);
    }
}
