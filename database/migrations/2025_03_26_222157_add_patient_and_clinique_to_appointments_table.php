<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class AddPatientAndCliniqueToAppointmentsTable extends Migration
{
    public function up()
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->unsignedBigInteger('patient_id')->nullable()->after('id');
            $table->unsignedBigInteger('clinique_id')->nullable()->after('patient_id');
            $table->foreign('patient_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('clinique_id')->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down()
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropForeign(['patient_id']);
            $table->dropForeign(['clinique_id']);
            $table->dropColumn('patient_id');
            $table->dropColumn('clinique_id');
        });
    }
}