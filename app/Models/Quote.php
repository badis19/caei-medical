<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Quote extends Model
{
    use HasFactory;

    protected $fillable = [
        'appointment_id',
        'file_path',
        'filename',
        'status',
        'comment',
        'clinique_quote_path',
        'total_clinique',
        'total_assistance',
        'total_quote',
        'sent_to_patient_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'total_clinique' => 'decimal:2',
        'total_assistance' => 'decimal:2',
        'total_quote' => 'decimal:2',
    ];

    public function appointment(): BelongsTo
    {
        return $this->belongsTo(Appointment::class);
    }

    public function assistanceQuotes(): HasMany
    {
        return $this->hasMany(AssistanceQuote::class);
    }
}
