<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Quote extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'appointment_id',
        'file_path', // New field for PDF file path
        'status',
        'comment',
    ];
    

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'amount' => 'decimal:2', // Cast amount to decimal with 2 places
    ];

    /**
     * Get the appointment that owns the quote.
     */
    public function appointment(): BelongsTo
    {
        // Assumes 'appointment_id' in this table references 'id' in the 'appointments' table
        return $this->belongsTo(Appointment::class);
        // If the foreign key is different, specify it: return $this->belongsTo(Appointment::class, 'foreign_key');
    }
}
