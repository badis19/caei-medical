<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission; // Optional: If you use permissions

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Define roles to be created
        $roles = [
            'administrateur',
            'superviseur',
            'agent',
            'confirmateur',
            'patient',
            'clinique',
        ];

        // Create roles if they don't exist
        foreach ($roles as $roleName) {
            Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'web']);
             // Use 'web' guard by default for web apps, change to 'api' if using API guard for roles
             // Or create for both if needed: Role::firstOrCreate(['name' => $roleName, 'guard_name' => 'api']);
        }

        // Optional: Create permissions and assign them to roles here if needed
        // Example:
        // Permission::firstOrCreate(['name' => 'manage users']);
        // $adminRole = Role::findByName('administrateur');
        // $adminRole->givePermissionTo('manage users');
    }
}
