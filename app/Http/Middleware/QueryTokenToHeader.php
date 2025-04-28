<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class QueryTokenToHeader
{
    public function handle(Request $request, Closure $next)
    {
        // If ?token=... exists, convert it into an Authorization header
        if ($request->has('token')) {
            $request->headers->set('Authorization', 'Bearer ' . $request->query('token'));
        }

        return $next($request);
    }
}
