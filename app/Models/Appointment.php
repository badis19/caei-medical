<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Storage;

class Appointment extends Model
{
    use HasFactory;

    protected $fillable = [
        'nom_du_prospect', 'prenom_du_prospect', 'telephone', 'email',
        'service', 'date_du_rdv', 'commentaire_agent', 'qualification',
        'commentaire_1', 'commentaire_2', 'whatsapp', 'type_de_soins',
        'intervention', 'prise_en_charge', 'budget', 'date_intervention',
        'objectif', 'status', 'agent_id', 'patient_id', 'clinique_id',
        'clinic_quote_file', // ✅ Add this
    ];

    protected $casts = [
        'date_du_rdv' => 'datetime',
        'date_intervention' => 'datetime',
        'whatsapp' => 'boolean',
        'budget' => 'decimal:2',
    ];

    // Relationships
    public function patient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'patient_id');
    }

    public function clinique(): BelongsTo
    {
        return $this->belongsTo(User::class, 'clinique_id');
    }

    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_id');
    }

    public function quote(): HasOne
    {
        return $this->hasOne(Quote::class);
    }

    // ✅ Accessor to get the URL of clinic quote
    public function getClinicQuoteUrlAttribute(): ?string
    {
        return $this->clinic_quote_file
            ? Storage::disk('public')->url($this->clinic_quote_file)
            : null;
    }

    protected $appends = ['clinic_quote_url']; // ✅ Include in API output
}
