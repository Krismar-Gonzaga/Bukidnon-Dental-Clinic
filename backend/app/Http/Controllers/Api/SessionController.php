<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AuditLogger;
use App\Support\UserSessions;
use Illuminate\Http\Request;

/** The devices signed in to this account, for any role. */
class SessionController extends Controller
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function index(Request $request)
    {
        return $this->ok(UserSessions::list($request->user(), $request));
    }

    public function destroy(Request $request, string $session)
    {
        $user = $request->user();

        if ($session === UserSessions::currentId($user, $request)) {
            return $this->fail('Use Log Out to end the session you are using.', 422);
        }
        abort_unless(UserSessions::revoke($user, $session), 404);

        $this->audit->record('auth.session_revoked', $user);

        return $this->ok(message: 'Signed out of that device');
    }

    /** Asks for the password again: someone at an unlocked screen should not lock the owner out. */
    public function destroyOthers(Request $request)
    {
        $request->validate(['password' => ['required', 'current_password:sanctum']]);
        $user = $request->user();

        UserSessions::revokeOthers($user, $request);
        $this->audit->record('auth.other_sessions_revoked', $user);

        return $this->ok(message: 'Signed out of all other devices');
    }
}
