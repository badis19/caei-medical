<?php

namespace App\Models;


use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\SoftDeletes; // Import SoftDeletes
use Spatie\Permission\Traits\HasRoles;        // Import Spatie HasRoles trait

class User extends Authenticatable
{
    // Order of traits matters sometimes, especially with bootable traits.
    // HasRoles should generally come after HasFactory if both are used.
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes, HasRoles; // Use SoftDeletes and HasRoles

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'name',
        'last_name',
        'image_de_profil',
        'telephone',
        'adresse',
        'email',
        'password',
        'role', // Keep if you need a primary role display, otherwise Spatie handles roles
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var array<int, string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed', // Automatically hashes passwords
    ];

    // No need for $dates array when using SoftDeletes trait

    /**
     * Get the appointments associated with the user acting as an Agent.
     */
    public function agentAppointments(): HasMany
    {
        // Specifies the foreign key 'agent_id' in the 'appointments' table
        return $this->hasMany(Appointment::class, 'agent_id');
    }

    /**
     * Get the appointments associated with the user acting as a Patient.
     */
    public function patientAppointments(): HasMany
    {
        // Specifies the foreign key 'patient_id' in the 'appointments' table
        return $this->hasMany(Appointment::class, 'patient_id');
    }

    /**
     * Get the appointments associated with the user acting as a Clinic.
     */
    public function clinicAppointments(): HasMany
    {
        // Specifies the foreign key 'clinique_id' in the 'appointments' table
        return $this->hasMany(Appointment::class, 'clinique_id');
    }
    public function patientFiles()
{
    return $this->hasMany(PatientFile::class);
}


    // Note: The HasRoles trait from Spatie automatically adds the following relationships:
    // - roles(): BelongsToMany relationship to Role model
    // - permissions(): BelongsToMany relationship to Permission model
    // You don't need to define them manually here.
}
