<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Register route middleware aliases
        $middleware->alias([
            'admin' => App\Http\Middleware\AdminMiddleware::class,
            'superviseur' => App\Http\Middleware\SupervisorMiddleware::class,
            'agent' => App\Http\Middleware\AgentMiddleware::class,
            'confirmateur' => App\Http\Middleware\ConfirmateurMiddleware::class,
            'patient' => App\Http\Middleware\PatientMiddleware::class,
            'clinique' => App\Http\Middleware\CliniqueMiddleware::class,
            'queryTokenToHeader' => App\Http\Middleware\QueryTokenToHeader::class,
            

        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Custom exception handling configuration can be added here if needed.
    })
    ->create();
