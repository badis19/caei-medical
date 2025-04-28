<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class WelcomePasswordSetup extends Notification
{
    public $token;
    public $user;

    public function __construct($token, $user)
    {
        $this->token = $token;
        $this->user = $user;
    }

    public function via($notifiable)
    {
        return ['mail'];
    }

    public function toMail($notifiable)
{
    $frontendUrl = config('app.frontend_url', 'http://localhost:5173');

    $resetUrl = "{$frontendUrl}/reset-password?token={$this->token}&email=" . urlencode($notifiable->email);

    return (new MailMessage)
        ->subject('Welcome to Caei - Set Your Password')
        ->line('Click the button below to set your password and access your account.')
        ->action('Set Password', $resetUrl)
        ->line('If you didn’t request this, no further action is required.');
}
}
