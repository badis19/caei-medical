<?php

namespace App\Events;

use App\Models\Appointment;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class AppointmentCreated implements ShouldBroadcast
{
    use SerializesModels;

    public $appointment;

    public function __construct(Appointment $appointment)
    {
        // Ensure both the relations and the parent model attributes like `clinique_id` are present
        $this->appointment = $appointment->loadMissing([
            'patient:id,name,last_name,email',
            'clinique:id,name',
            'agent:id,name,last_name',
        ]);

        Log::info('📣 Event constructed: AppointmentCreated', [
            'appointment_id' => $this->appointment->id,
            'agent' => $this->appointment->agent?->name,
            'clinique_id' => $this->appointment->clinique_id,
        ]);
    }

    public function broadcastOn()
    {
        $channels = [
            new PrivateChannel('role.admin'),
            new PrivateChannel('role.superviseur'),
            new PrivateChannel('role.confirmateur'),
        ];

        if ($this->appointment->clinique_id) {
            $channels[] = new PrivateChannel('clinique.' . $this->appointment->clinique_id);
        }

         if ($this->appointment->patient_id) {
        $channels[] = new PrivateChannel('role.patient.' . $this->appointment->patient_id);
    }
        Log::info('📡 Channels used in AppointmentCreated broadcast', [
            'channels' => array_map(fn($channel) => $channel->name, $channels),
        ]);

        return $channels;
    }

    public function broadcastAs()
    {
        return 'appointment.created';
    }

    public function broadcastWith()
    {
        $payload = [
            'id' => $this->appointment->id,
            'patient' => $this->appointment->patient,
            'clinique' => $this->appointment->clinique,
            'agent' => $this->appointment->agent,
            'date' => $this->appointment->date_du_rdv,
            'status' => $this->appointment->status,
        ];

        Log::info('📡 Broadcasting appointment.created with payload', [
            'payload' => $payload,
        ]);

        return $payload;
    }
}
