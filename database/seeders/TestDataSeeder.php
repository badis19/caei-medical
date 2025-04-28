<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\User;
use App\Models\Appointment;
use App\Models\Quote; // Assuming you have a Quote model
use Illuminate\Support\Facades\Hash;
use Carbon\Carbon; // For date manipulation

class TestDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // --- Create Test Users ---

        // Agent Users
        $agent1 = User::factory()->create([
            'name' => 'Agent',
            'last_name' => 'One',
            'email' => 'agent1@example.com',
            'password' => Hash::make('password'),
            'email_verified_at' => now(),
            'role' => 'agent',
        ]);
        $agent1->assignRole('agent');

        $agent2 = User::factory()->create([
            'name' => 'Agent',
            'last_name' => 'Two',
            'email' => 'agent2@example.com',
            'password' => Hash::make('password'),
            'email_verified_at' => now(),
            'role' => 'agent',
        ]);
        $agent2->assignRole('agent');

        // Patient Users
        $patient1 = User::factory()->create([
            'name' => 'Patient',
            'last_name' => 'Alpha',
            'email' => 'patient1@example.com',
            'password' => Hash::make('password'),
            'email_verified_at' => now(),
            'role' => 'patient',
        ]);
        $patient1->assignRole('patient');

        $patient2 = User::factory()->create([
            'name' => 'Patient',
            'last_name' => 'Beta',
            'email' => 'patient2@example.com',
            'password' => Hash::make('password'),
            'email_verified_at' => now(),
            'role' => 'patient',
        ]);
        $patient2->assignRole('patient');

        // Clinic Users
        $clinic1 = User::factory()->create([
            'name' => 'Central Clinic', // Use 'name' for clinic name
            'last_name' => '', // Last name might not apply
            'email' => 'clinic1@example.com',
            'password' => Hash::make('password'),
            'email_verified_at' => now(),
            'role' => 'clinique',
        ]);
        $clinic1->assignRole('clinique');

        $clinic2 = User::factory()->create([
            'name' => 'Downtown Medical',
            'last_name' => '',
            'email' => 'clinic2@example.com',
            'password' => Hash::make('password'),
            'email_verified_at' => now(),
            'role' => 'clinique',
        ]);
        $clinic2->assignRole('clinique');

        // Confirmateur User
        $confirmateur1 = User::factory()->create([
            'name' => 'Confirmatuer',
            'last_name' => 'Main',
            'email' => 'confirmateur1@example.com',
            'password' => Hash::make('password'),
            'email_verified_at' => now(),
            'role' => 'confirmateur',
        ]);
        $confirmateur1->assignRole('confirmateur');


        // --- Create Test Appointments ---

        $appt1 = Appointment::create([
            'nom_du_prospect' => $patient1->last_name,
            'prenom_du_prospect' => $patient1->name,
            'telephone' => $patient1->telephone ?? '12345678',
            'email' => $patient1->email,
            'service' => 'General Checkup',
            'date_du_rdv' => Carbon::now()->addDays(5)->setHour(10),
            'whatsapp' => true,
            'status' => 'pending', // Initial status
            'agent_id' => $agent1->id,
            'patient_id' => $patient1->id,
            'clinique_id' => $clinic1->id, // Assign a clinic
            'commentaire_agent' => 'Patient requests morning appointment.',
            'type_de_soins' => 'Preventive',
        ]);

        $appt2 = Appointment::create([
            'nom_du_prospect' => $patient2->last_name,
            'prenom_du_prospect' => $patient2->name,
            'telephone' => $patient2->telephone ?? '87654321',
            'email' => $patient2->email,
            'service' => 'Dental Cleaning',
            'date_du_rdv' => Carbon::now()->addDays(7)->setHour(14),
            'whatsapp' => false,
            'status' => 'confirmed', // Example confirmed status
            'agent_id' => $agent2->id,
            'patient_id' => $patient2->id,
            'clinique_id' => $clinic2->id,
            'commentaire_agent' => 'Requires specific dentist.',
            'type_de_soins' => 'Dental',
            'intervention' => 'Cleaning',
            'prise_en_charge' => 'Insurance XYZ',
            'budget' => 150.00,
        ]);

        $appt3 = Appointment::create([
            'nom_du_prospect' => 'New', // Prospect not yet a user maybe?
            'prenom_du_prospect' => 'Prospect',
            'telephone' => '55555555',
            'email' => 'newprospect@temp.com',
            'service' => 'Consultation',
            'date_du_rdv' => Carbon::now()->addDays(3)->setHour(11),
            'whatsapp' => true,
            'status' => 'pending',
            'agent_id' => $agent1->id,
            'patient_id' => null, // Not linked to a user yet
            'clinique_id' => null, // Not assigned yet
        ]);


        // --- Create Test Quotes (Optional) ---
        // Remember: One-to-one relationship assumed now

        if ($appt1) {
             Quote::create([
                'appointment_id' => $appt1->id,
                'status' => 'pending', // Initial quote status
            ]);
        }

         if ($appt2) {
             Quote::create([
                'appointment_id' => $appt2->id,
                'status' => 'accepted',
            ]);
        }

    }
}
