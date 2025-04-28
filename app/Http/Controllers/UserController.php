<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Validator;

class UserController extends Controller
{
    // List all users (accessible by an administrator)
    public function index()
    {
         $users = User::all();
         return response()->json($users);
    }

    // Create a new user
    public function store(Request $request)
    {
         $validator = Validator::make($request->all(), [
              'name'      => 'required|string|max:255',
              'last_name' => 'required|string|max:255',
              'email'     => 'required|string|email|max:255|unique:users',
              'password'  => 'required|string|min:6',
              'role'      => 'required|in:administrateur,superviseur,agent,confirmateur,patient,clinique'
         ]);

         if ($validator->fails()) {
              return response()->json($validator->errors(), 422);
         }

         $user = User::create([
              'name'      => $request->name,
              'last_name' => $request->last_name,
              'email'     => $request->email,
              'password'  => Hash::make($request->password),
              'role'      => $request->role,
         ]);

         return response()->json($user, 201);
    }

    // Display a single user
    public function show($id)
    {
         $user = User::find($id);
         if (!$user) {
              return response()->json(['message' => 'User not found'], 404);
         }
         return response()->json($user);
    }

    // Update an existing user (and optionally change the role)
    public function update(Request $request, $id)
    {
         $user = User::find($id);
         if (!$user) {
              return response()->json(['message' => 'User not found'], 404);
         }

         $validator = Validator::make($request->all(), [
              'name'      => 'sometimes|string|max:255',
              'last_name' => 'sometimes|string|max:255',
              'email'     => 'sometimes|string|email|max:255|unique:users,email,'.$id,
              'password'  => 'sometimes|string|min:6',
              'role'      => 'sometimes|in:administrateur,superviseur,agent,confirmateur,patient,clinique'
         ]);

         if ($validator->fails()) {
              return response()->json($validator->errors(), 422);
         }

         if ($request->has('name')) {
             $user->name = $request->name;
         }
         if ($request->has('last_name')) {
             $user->last_name = $request->last_name;
         }
         if ($request->has('email')) {
             $user->email = $request->email;
         }
         if ($request->has('password')) {
             $user->password = Hash::make($request->password);
         }
         if ($request->has('role')) {
             $user->role = $request->role;
         }
         $user->save();

         return response()->json($user);
    }

    // Delete a user
    public function destroy($id)
    {
         $user = User::find($id);
         if (!$user) {
              return response()->json(['message' => 'User not found'], 404);
         }
         $user->delete();
         return response()->json(['message' => 'User deleted successfully']);
    }
}
