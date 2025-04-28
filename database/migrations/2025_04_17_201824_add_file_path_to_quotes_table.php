<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
{
    Schema::table('quotes', function (Blueprint $table) {
        $table->string('file_path')->nullable(); // For storing PDF path
        $table->dropColumn('amount'); // Optional if no longer used
        $table->dropColumn('status'); // Optional if no longer used
    });
}

public function down()
{
    Schema::table('quotes', function (Blueprint $table) {
        $table->dropColumn('file_path');
        $table->decimal('amount', 8, 2)->nullable();
        $table->enum('status', ['pending', 'accepted', 'rejected'])->default('pending');
    });
}

};
