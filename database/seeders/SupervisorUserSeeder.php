<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User; // Import User model
use Illuminate\Support\Facades\Hash; // Import Hash facade

class SupervisorUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $supervisorUser = User::firstOrCreate(
            ['email' => 'supervisor@example.com'], // Find by email first
            [
                'name' => 'Supervisor',
                'last_name' => 'User',
                'password' => Hash::make('password'), // Use a secure default password
                'email_verified_at' => now(), // Mark as verified
                'role' => 'superviseur', // Set primary role column if used
                 // Add other fields like telephone, adresse if needed
                'telephone' => '22222222',
                'adresse' => '2 Supervisor Avenue',
            ]
        );

        // Assign the 'superviseur' role using Spatie
        $supervisorUser->assignRole('superviseur');
    }
}

