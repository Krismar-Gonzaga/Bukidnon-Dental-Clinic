<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Middleware\RequireRecentPassword;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/** Re-enter the password before high-impact administration (see RequireRecentPassword). */
class PasswordConfirmationController extends Controller
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function store(Request $request)
    {
        $request->validate(['password' => ['required', 'string', 'max:255']]);
        $user = $request->user();
        $key = RequireRecentPassword::key($request);

        if (! $key || ! Hash::check($request->input('password'), $user->password)) {
            $this->audit->record('admin.password_confirm_failed', $user);

            throw ValidationException::withMessages(['password' => 'The password is incorrect.']);
        }

        Cache::put($key, true, now()->addMinutes(RequireRecentPassword::TTL_MINUTES));
        $this->audit->record('admin.password_confirmed', $user);

        return $this->ok(['expires_in' => RequireRecentPassword::TTL_MINUTES * 60], 'Password confirmed');
    }
}
