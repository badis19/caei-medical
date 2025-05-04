<x-mail::message>
# Appointment Status Updated

Dear {{ $appointment->prenom_du_prospect }},

We are writing to inform you that your appointment scheduled on:

**{{ \Carbon\Carbon::parse($appointment->date_du_rdv)->format('F j, Y \a\t H:i') }}**

has been:

<x-mail::panel>
**{{ strtoupper($appointment->status) }}**
</x-mail::panel>

@if ($appointment->status === 'cancelled')
We are sorry to inform you that your appointment has been cancelled. Please feel free to contact us or reschedule.
@else
We are happy to confirm your appointment. Please make sure to arrive on time.
@endif

Thanks,<br>
{{ config('app.name') }}
</x-mail::message>
