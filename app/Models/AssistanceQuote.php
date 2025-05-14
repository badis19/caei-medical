<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssistanceQuote extends Model
{
    use HasFactory;

    protected $fillable = ['quote_id', 'label', 'amount'];

    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class);
    }
}
