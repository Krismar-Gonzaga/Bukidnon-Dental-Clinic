<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\ClinicWorld;
use Tests\TestCase;

/**
 * Requests from the web app's origin use an HttpOnly session cookie and
 * never receive an API token; other clients (mobile) get a token.
 */
class WebSessionAuthTest extends TestCase
{
    use ClinicWorld, RefreshDatabase;

    private const WEB = ['Origin' => 'http://localhost:3000', 'Referer' => 'http://localhost:3000/login'];

    public function test_web_login_uses_a_session_cookie_and_returns_no_token(): void
    {
        $user = User::factory()->role('patient')->create(['email' => 'juan@example.com']);

        $response = $this->withHeaders(self::WEB)
            ->postJson('/api/login', ['email' => 'juan@example.com', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('data.role', 'patient')
            ->assertJsonMissingPath('data.token');

        $cookie = collect($response->headers->getCookies())->first(fn ($c) => $c->getName() === config('session.cookie'));
        $this->assertNotNull($cookie, 'session cookie set');
        $this->assertTrue($cookie->isHttpOnly());
        $this->assertAuthenticatedAs($user, 'web');
        $this->assertSame(0, $user->tokens()->count());
    }

    public function test_session_user_can_call_protected_endpoints_and_log_out(): void
    {
        $user = User::factory()->role('patient')->create();

        $this->actingAs($user, 'web')->withHeaders(self::WEB)->getJson('/api/user')->assertOk()->assertJsonPath('data.id', $user->id);
        $this->actingAs($user, 'web')->withHeaders(self::WEB)->postJson('/api/logout')->assertOk();
        $this->assertGuest('web');
    }

    public function test_session_check_answers_200_for_guests_and_returns_the_signed_in_user(): void
    {
        // Guest: 200 with no data (no failed request in the browser console).
        $this->withHeaders(self::WEB)->getJson('/api/session')
            ->assertOk()
            ->assertJsonMissingPath('data');

        // Web session (cookie).
        $user = User::factory()->role('patient')->create();
        $this->actingAs($user, 'web')->withHeaders(self::WEB)->getJson('/api/session')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id);
        $this->app['auth']->forgetGuards();

        // Bearer token (mobile style).
        $this->asUser($user)->getJson('/api/session')->assertOk()->assertJsonPath('data.id', $user->id);
        $this->app['auth']->forgetGuards();

        // Suspended accounts count as signed out.
        $user->forceFill(['status' => User::STATUS_SUSPENDED])->save();
        $this->asUser($user)->getJson('/api/session')->assertOk()->assertJsonMissingPath('data');
    }

    public function test_mobile_style_login_still_gets_a_token(): void
    {
        User::factory()->create(['email' => 'juan@example.com']);

        $this->postJson('/api/login', ['email' => 'juan@example.com', 'password' => 'password'])
            ->assertOk()
            ->assertJsonStructure(['data' => ['token']]);
    }

    public function test_cors_allows_credentials_only_for_known_origins(): void
    {
        // Independent of the developer's local CORS_ALLOWED_ORIGINS.
        config(['cors.allowed_origins' => ['http://localhost:3000', 'http://127.0.0.1:3000']]);

        $this->withHeaders(['Origin' => 'http://localhost:3000', 'Access-Control-Request-Method' => 'POST'])
            ->options('/api/login')
            ->assertHeader('Access-Control-Allow-Origin', 'http://localhost:3000')
            ->assertHeader('Access-Control-Allow-Credentials', 'true');

        // An unknown origin is never echoed back, so browsers block it. (With a
        // single configured origin the library always sends that origin.)
        $response = $this->withHeaders(['Origin' => 'https://evil.example', 'Access-Control-Request-Method' => 'POST'])
            ->options('/api/login');
        $this->assertNotSame('https://evil.example', $response->headers->get('Access-Control-Allow-Origin'));
        $this->assertNotSame('*', $response->headers->get('Access-Control-Allow-Origin'));
    }

    public function test_saved_clinics_and_public_dentists(): void
    {
        $this->freezeClock();
        $world = $this->makeClinic(['city' => 'Valencia City']);
        $hidden = $this->makeClinic(['is_published' => false]);
        $patient = $this->makePatient();

        $this->asUser($patient)->putJson("/api/patient/saved-clinics/{$world['clinic']->id}")->assertOk();
        $this->asUser($patient)->putJson("/api/patient/saved-clinics/{$world['clinic']->id}")->assertOk(); // idempotent
        $this->asUser($patient)->putJson("/api/patient/saved-clinics/{$hidden['clinic']->id}")->assertNotFound();
        $this->asUser($patient)->getJson('/api/patient/saved-clinics')->assertOk()->assertJsonCount(1, 'data');
        $this->asUser($patient)->deleteJson("/api/patient/saved-clinics/{$world['clinic']->id}")->assertOk();
        $this->asUser($patient)->getJson('/api/patient/saved-clinics')->assertJsonCount(0, 'data');

        $dentists = $this->getJson('/api/dentists?city=Valencia%20City')->assertOk()->json('data');
        $this->assertCount(1, $dentists);
        $this->assertSame($world['clinic']->id, $dentists[0]['clinics'][0]['id']);
        $this->assertArrayNotHasKey('email', $dentists[0]);
        // The unpublished clinic's dentist is not listed.
        $this->assertCount(1, $this->getJson('/api/dentists')->json('data'));
    }
}
