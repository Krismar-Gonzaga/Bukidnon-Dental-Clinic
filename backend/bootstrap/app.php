<?php

use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->throttleApi();

        $middleware->alias([
            'role' => \App\Http\Middleware\RoleMiddleware::class,
            'active' => \App\Http\Middleware\EnsureAccountActive::class,
            'clinic.permission' => \App\Http\Middleware\EnsureClinicPermission::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Every /api response is JSON in the { success, message, errors? }
        // envelope, and never exposes internal exception details.
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson()
        );

        $json = fn (string $message, int $status, ?array $errors = null) => response()->json(
            array_filter(['success' => false, 'message' => $message, 'errors' => $errors], fn ($v) => $v !== null),
            $status
        );

        $exceptions->render(function (Throwable $e, Request $request) use ($json) {
            if (! $request->is('api/*')) {
                return null;
            }

            return match (true) {
                $e instanceof ValidationException => $json($e->getMessage(), 422, $e->errors()),
                $e instanceof AuthenticationException => $json('Unauthenticated.', 401),
                $e instanceof AuthorizationException,
                $e instanceof AccessDeniedHttpException => $json(
                    $e->getMessage() ?: 'You do not have permission to perform this action.',
                    403
                ),
                $e instanceof ModelNotFoundException,
                $e instanceof NotFoundHttpException => $json('Resource not found.', 404),
                $e instanceof ThrottleRequestsException => $json('Too many requests. Please wait and try again.', 429),
                $e instanceof HttpExceptionInterface => $json($e->getMessage() ?: 'Request failed.', $e->getStatusCode()),
                config('app.debug') => null, // Let Laravel show the full error locally.
                default => $json('Something went wrong. Please try again later.', 500),
            };
        });
    })->create();
