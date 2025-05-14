<?php
namespace App\Events;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Queue\SerializesModels;
use App\Models\Appointment;

class ClinicQuoteUploaded implements ShouldBroadcast
{
    use SerializesModels;

    public $appointment;

    public function __construct(Appointment $appointment)
    {
        $this->appointment = $appointment->load(['patient', 'agent', 'clinique']);
    }

    public function broadcastOn()
    {
        return [
            new PrivateChannel('role.admin'),
            new PrivateChannel('role.superviseur'),
        ];
    }

    public function broadcastAs()
    {
        return 'clinic.quote.uploaded';
    }

    public function broadcastWith()
    {
        return [
            'id' => $this->appointment->id,
            'date' => $this->appointment->date_du_rdv,
            'patient' => $this->appointment->patient,
            'agent' => $this->appointment->agent,
            'clinique' => $this->appointment->clinique,
        ];
    }
}
