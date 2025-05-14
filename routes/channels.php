<?php

use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| Here you may register all of the event broadcasting channels that your
| application supports. The given channel authorization callbacks are
| used to check if an authenticated user can listen to the channel.
|
*/

// ✅ Users accessing their own private channels
Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// ✅ Admins
Broadcast::channel('role.admin', function ($user) {
    return $user->hasRole('administrateur');
});

// ✅ Superviseurs
Broadcast::channel('role.superviseur', function ($user) {
    return $user->hasRole('superviseur');
});

// ✅ Agents
Broadcast::channel('role.agent.{id}', function ($user, $id) {
    return $user->hasRole('agent') && $user->id === (int) $id;
});

// ✅ Confirmateurs
Broadcast::channel('role.confirmateur', function ($user) {
    return $user->hasRole('confirmateur');
});

// ✅ Cliniques
Broadcast::channel('clinique.{id}', function ($user, $id) {
    \Log::info('🔐 Checking access to channel clinique.' . $id, [
        'user_id' => $user->id,
        'user_roles' => $user->roles->pluck('name'),
    ]);
    return $user->hasRole('clinique') && $user->id === (int) $id;
});

// ✅ Patients
Broadcast::channel('role.patient.{id}', function ($user, $id) {
    return $user->hasRole('patient') && $user->id === (int) $id;
});
