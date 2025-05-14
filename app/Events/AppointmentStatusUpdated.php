<?php

namespace App\Events;

use App\Models\Appointment;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Queue\SerializesModels;

class AppointmentStatusUpdated implements ShouldBroadcast
{
    use SerializesModels;

    public $appointment;

    public function __construct(Appointment $appointment)
    {
        $this->appointment = $appointment->loadMissing([
            'patient:id,name,last_name,email',
            'clinique:id,name',
            'agent:id,name,last_name',
        ]);
    }

    public function broadcastOn()
    {
        $channels = [
            new PrivateChannel('role.admin'),
            new PrivateChannel('role.superviseur'),
        ];

        if ($this->appointment->patient_id) {
            $channels[] = new PrivateChannel("role.patient.{$this->appointment->patient_id}");
        }

        if ($this->appointment->clinique_id) {
            $channels[] = new PrivateChannel("clinique.{$this->appointment->clinique_id}"); // ✅ MATCHES routes/channels.php
    }

        return $channels;
    }

    public function broadcastAs()
    {
        return 'appointment.status.updated';
    }

    public function broadcastWith()
    {
        return [
            'id' => $this->appointment->id,
            'status' => $this->appointment->status,
            'patient' => $this->appointment->patient,
            'clinique' => $this->appointment->clinique,
            'agent' => $this->appointment->agent,
            'date' => $this->appointment->date_du_rdv,
        ];
    }
}
