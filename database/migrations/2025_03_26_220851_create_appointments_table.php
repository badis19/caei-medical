<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateAppointmentsTable extends Migration
{
    public function up()
    {
        Schema::create('appointments', function (Blueprint $table) {
            $table->id();
            $table->string('nom_du_prospect');
            $table->string('prenom_du_prospect');
            $table->string('telephone', 20);
            $table->string('email');
            $table->string('service');
            $table->dateTime('date_du_rdv');
            $table->text('commentaire_agent')->nullable();
            $table->string('qualification')->nullable();
            $table->text('commentaire_1')->nullable();
            $table->text('commentaire_2')->nullable();
            $table->boolean('whatsapp')->default(false);
            $table->string('type_de_soins')->nullable();
            $table->string('intervention')->nullable();
            $table->string('prise_en_charge')->nullable();
            $table->decimal('budget', 10, 2)->nullable();
            $table->dateTime('date_intervention')->nullable();
            $table->text('objectif')->nullable();
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('appointments');
    }
}