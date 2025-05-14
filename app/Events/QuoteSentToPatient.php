<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Queue\SerializesModels;
use App\Models\Quote;

class QuoteSentToPatient implements ShouldBroadcast
{
    use SerializesModels;

    public $quote;
    public $senderRole;

    public function __construct(Quote $quote, string $senderRole)
    {
        $this->quote = $quote->load(['appointment.clinique', 'appointment.patient']);
        $this->senderRole = $senderRole;
    }

    public function broadcastOn()
    {
        $channels = [];

        if ($this->senderRole === 'administrateur') {
            $channels[] = new PrivateChannel('role.superviseur');
        } elseif ($this->senderRole === 'superviseur') {
            $channels[] = new PrivateChannel('role.admin');
        }

        $cliniqueId = $this->quote->appointment->clinique_id;
        if ($cliniqueId) {
            $channels[] = new PrivateChannel("clinique.{$cliniqueId}");
        }

        $patientId = $this->quote->appointment->patient_id;
        if ($patientId) {
            $channels[] = new PrivateChannel("role.patient.{$patientId}");
        }

        return $channels;
    }

    public function broadcastAs()
    {
        return 'quote.sent.to.patient';
    }

    public function broadcastWith()
    {
        return [
            'quote_id' => $this->quote->id,
            'appointment_id' => $this->quote->appointment_id,
            'patient' => $this->quote->appointment->patient,
            'clinique' => $this->quote->appointment->clinique,
            'sent_at' => now()->toDateTimeString(),
        ];
    }
}
