<?php

// database/migrations/xxxx_xx_xx_update_quotes_table_for_facture.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::table('quotes', function (Blueprint $table) {
            $table->string('clinique_quote_path')->nullable(); // PDF path
            $table->decimal('total_clinique', 8, 2)->default(0);
            $table->decimal('total_assistance', 8, 2)->default(0);
            $table->decimal('total_quote', 8, 2)->default(0); // Sum of both
        });
    }

    public function down(): void {
        Schema::table('quotes', function (Blueprint $table) {
            $table->dropColumn([
                'clinique_quote_path',
                'total_clinique',
                'total_assistance',
                'total_quote'
            ]);
        });
    }
};
