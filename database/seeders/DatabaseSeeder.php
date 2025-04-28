<?php
namespace Database\Seeders;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,          // MUST run first
            AdminUserSeeder::class,     // Creates the admin
            SupervisorUserSeeder::class,// Creates the supervisor
            TestDataSeeder::class,    // Creates agents, patients etc.
            // Add other seeders if you have them
        ]);
    }
}