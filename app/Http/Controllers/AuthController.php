<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;
use App\Models\User;
use Validator;

class AuthController extends Controller
{
    // 🔴 Registration disabled (all users created by admin)
    // public function register(Request $request) { ... } // Removed

    // ✅ Login endpoint
    public function login(Request $request)
    {
        if (!Auth::attempt($request->only('email', 'password'))) {
            return response()->json(['message' => 'Invalid login details'], 401);
        }
    
        $user = User::where('email', $request->email)->firstOrFail();
    
        // ❌ Deactivated account
        if (!$user->is_active) {
            return response()->json(['message' => 'Votre compte est désactivé. Veuillez contacter l\'administrateur.'], 403);
        }
    
        // ✅ No email verification check anymore
    
        $token = $user->createToken('auth_token')->plainTextToken;
    
        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user,
        ]);
    }
    
}
