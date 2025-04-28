<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\PatientFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Storage;
use App\Notifications\WelcomePasswordSetup;

class SupervisorUserController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query();

        if ($request->has('role') && $request->role) {
            $query->role($request->role);
        }

        if ($request->has('search') && $request->search) {
            $searchTerm = $request->search;
            $query->where(function ($q) use ($searchTerm) {
                $q->where('name', 'like', "%{$searchTerm}%")
                    ->orWhere('last_name', 'like', "%{$searchTerm}%")
                    ->orWhere('email', 'like', "%{$searchTerm}%");
            });
        }

        $users = $query->with('roles:id,name')
                       ->latest()
                       ->paginate(15);

        return response()->json($users);
    }

    public function store(Request $request)
    {
        // Supervisor is NOT allowed to create admin or supervisor users
        $allowedRoles = ['agent', 'confirmateur', 'patient', 'clinique'];

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email',
            'role' => ['required', Rule::in($allowedRoles)],
            'telephone' => 'nullable|string|max:20',
            'adresse' => 'nullable|string',
            'password' => 'nullable|string|min:8',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $user = User::create([
            'name' => $request->name,
            'last_name' => $request->last_name,
            'email' => $request->email,
            'telephone' => $request->telephone,
            'adresse' => $request->adresse,
            'role' => $request->role,
        ]);

        $user->assignRole($request->role);

        if ($request->filled('password')) {
            $user->password = Hash::make($request->password);
            $user->save();
        } else {
            $token = app('auth.password.broker')->createToken($user);
            $user->notify(new WelcomePasswordSetup($token, $user->email));
        }

        return response()->json($user->load('roles:id,name'), 201);
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $allowedRoles = ['agent', 'confirmateur', 'patient', 'clinique'];

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'last_name' => 'sometimes|required|string|max:255',
            'email' => ['sometimes', 'required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'password' => 'sometimes|nullable|string|min:8',
            'role' => ['sometimes', 'required', Rule::in($allowedRoles)],
            'telephone' => 'sometimes|nullable|string|max:20',
            'adresse' => 'sometimes|nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json($validator->errors(), 422);
        }

        $userData = $request->only(['name', 'last_name', 'email', 'telephone', 'adresse', 'role']);
        $user->fill($userData);

        if ($request->filled('password')) {
            $user->password = Hash::make($request->password);
        }

        if ($request->has('role')) {
            $user->role = $request->role;
        }

        $user->save();

        if ($request->has('role')) {
            $user->syncRoles([$request->role]);
        }

        return response()->json($user->load('roles:id,name'));
    }

    public function destroy($id)
    {
        $user = User::findOrFail($id);
        $user->delete();

        return response()->json(['message' => 'User soft-deleted successfully'], 200);
    }

    public function toggleStatus($id)
    {
        $user = User::findOrFail($id);
        $user->is_active = !$user->is_active;
        $user->save();

        return response()->json([
            'message' => $user->is_active ? 'Compte activé' : 'Compte désactivé',
            'status' => $user->is_active
        ]);
    }

    public function listPatientFiles($userId)
    {
        $user = User::findOrFail($userId);

        if (!$user->hasRole('patient')) {
            return response()->json(['message' => 'User is not a patient'], 403);
        }

        $files = $user->patientFiles()->get(['id', 'file_name', 'file_path', 'created_at']);

        return response()->json($files);
    }

    public function downloadPatientFile($fileId)
    {
        $file = PatientFile::findOrFail($fileId);

        if (!Storage::disk('public')->exists($file->file_path)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        return response()->download(storage_path("app/public/{$file->file_path}"), $file->file_name);
    }
}
