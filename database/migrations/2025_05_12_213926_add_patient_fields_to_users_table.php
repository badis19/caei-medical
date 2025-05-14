<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddPatientFieldsToUsersTable extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->date('date_de_naissance')->nullable()->after('email');
            $table->string('allergies', 1000)->nullable()->after('date_de_naissance');
            $table->string('medical_history', 2000)->nullable()->after('allergies');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['date_de_naissance', 'allergies', 'medical_history']);
        });
    }
}
