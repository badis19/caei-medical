<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User; // Import User model
use Illuminate\Support\Facades\Hash; // Import Hash facade

class AdminUserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $adminUser = User::firstOrCreate(
            ['email' => 'admin@example.com'], // Find by email first
            [
                'name' => 'Admin',
                'last_name' => 'User',
                'password' => Hash::make('password'), // Use a secure default password
                'email_verified_at' => now(), // Mark as verified
                'role' => 'administrateur', // Set primary role column if used
                // Add other fields like telephone, adresse if needed
                'telephone' => '11111111',
                'adresse' => '1 Admin Street',
            ]
        );

        // Assign the 'administrateur' role using Spatie
        $adminUser->assignRole('administrateur');
    }
}
