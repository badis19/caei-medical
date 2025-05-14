<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use Illuminate\Notifications\Messages\MailMessage;

class WelcomePasswordSetup extends Notification
{
    use Queueable;

    protected $token;
    protected $email;
    protected $plaintextPassword;

    public function __construct($token = null, $email, $plaintextPassword = null)
    {
        $this->token = $token;
        $this->email = $email;
        $this->plaintextPassword = $plaintextPassword;
    }

    public function via($notifiable)
    {
        return ['mail'];
    }

    public function toMail($notifiable)
    {
        $mail = (new MailMessage)
            ->subject('Welcome to the Platform')
            ->greeting("Hello {$notifiable->name},")
            ->line("Your account has been created with email: {$this->email}");
    
        if ($this->plaintextPassword) {
            $mail->line("Your temporary password is: **{$this->plaintextPassword}**")
                 ->line("You can log in directly using these credentials.");
        } else {
            // ✅ Update this line to point to your React frontend
            $frontendUrl = "http://localhost:5173/reset-password?token={$this->token}&email={$this->email}&welcome=true";
    
            $mail->line('To set your password, click the button below:')
                 ->action('Set Password', $frontendUrl);
        }
    
        return $mail->line('Thank you for joining us!');
    }
    
}
