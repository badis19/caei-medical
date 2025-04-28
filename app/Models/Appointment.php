<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne; // Import HasOne
use Illuminate\Validation\Rule; 

class Appointment extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     * protected $table = 'appointments'; // Default assumption
     */

    /**
     * The attributes that are mass assignable.
     * @var array<int, string>
     */
    protected $fillable = [
        'nom_du_prospect', 'prenom_du_prospect', 'telephone', 'email',
        'service', 'date_du_rdv', 'commentaire_agent', 'qualification',
        'commentaire_1', 'commentaire_2', 'whatsapp', 'type_de_soins',
        'intervention', 'prise_en_charge', 'budget', 'date_intervention',
        'objectif', 'status', 'agent_id', 'patient_id', 'clinique_id',
    ];

    /**
     * The attributes that should be cast.
     * @var array<string, string>
     */
    protected $casts = [
        'date_du_rdv' => 'datetime',
        'date_intervention' => 'datetime',
        'whatsapp' => 'boolean',
        'budget' => 'decimal:2',
    ];

    /** Get the user (patient) associated with the appointment. */
    public function patient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'patient_id');
    }

    /** Get the user (clinic) associated with the appointment. */
    public function clinique(): BelongsTo
    {
        return $this->belongsTo(User::class, 'clinique_id');
    }

    /** Get the user (agent) associated with the appointment. */
    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_id');
    }

    /**
     * Get the quote associated with the appointment (one-to-one).
     */
    public function quote(): HasOne // Changed from HasMany to HasOne
    {
        // Assumes 'appointment_id' in the 'quotes' table references 'id' in this table
        return $this->hasOne(Quote::class);
        // If the foreign key is different: return $this->hasOne(Quote::class, 'foreign_key');
    }
}
