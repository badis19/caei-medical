<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth; // Import Auth facade
use Symfony\Component\HttpFoundation\Response; // Import Response for type hinting

class SupervisorMiddleware
{
    /**
     * Handle an incoming request.
     * Check if the user is authenticated and has the 'superviseur' role.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @return \Symfony\Component\HttpFoundation\Response
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Check if user is authenticated AND has the required 'superviseur' role using Spatie
        // Assumes the User model uses the HasRoles trait
        if (!Auth::check() || !$request->user()->hasRole('superviseur')) {
             // Return a JSON response with 403 Forbidden status
            return response()->json(['message' => 'Unauthorized. Supervisor access required.'], 403);
        }

        // User is authenticated and has the supervisor role, proceed
        return $next($request);
    }
}
