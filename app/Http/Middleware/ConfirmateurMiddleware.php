<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth; // Import Auth facade
use Symfony\Component\HttpFoundation\Response; // Import Response for type hinting

class ConfirmateurMiddleware // Changed class name
{
    /**
     * Handle an incoming request.
     * Check if the user is authenticated and has the 'confirmateur' role. // Updated comment
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @return \Symfony\Component\HttpFoundation\Response
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Get the authenticated user
        $user = Auth::user(); // Or $request->user()

        // Check if user is authenticated AND has the 'confirmateur' role using Spatie // Updated check
        // Assumes the User model uses the HasRoles trait
        if (!$user || !$user->hasRole('confirmateur')) { // <-- CHANGED ROLE HERE
            // Return a JSON response with 403 Forbidden status
            return response()->json(['message' => 'Unauthorized. Confirmateur access required.'], 403); // Updated message
        }

        // User is authenticated and has the confirmateur role, proceed
        return $next($request);
    }
}