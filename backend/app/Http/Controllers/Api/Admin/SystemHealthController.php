<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\VerificationDocument;
use App\Support\BusinessTime;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

/**
 * Live checks of the services the platform depends on, plus configuration
 * that weakens security in production. Never returns secrets, connection
 * strings or exception messages; failures are reported to the log instead.
 */
class SystemHealthController extends Controller
{
    public function __invoke()
    {
        $checks = [
            $this->database(),
            $this->cache(),
            $this->storage(),
            $this->queue(),
            ...$this->configuration(),
        ];

        $statuses = array_column($checks, 'status');
        $status = in_array('fail', $statuses, true) ? 'down' : (in_array('warn', $statuses, true) ? 'degraded' : 'healthy');

        return $this->ok([
            'status' => $status,
            'environment' => app()->environment(),
            'checked_at' => BusinessTime::iso(now()),
            'checks' => $checks,
        ]);
    }

    private function check(string $key, string $label, string $status, string $detail): array
    {
        return compact('key', 'label', 'status', 'detail');
    }

    private function database(): array
    {
        try {
            $start = microtime(true);
            DB::select('select 1');
            $ms = (int) round((microtime(true) - $start) * 1000);

            return $this->check('database', 'Database', $ms > 1000 ? 'warn' : 'ok', "Responding in {$ms} ms");
        } catch (Throwable $e) {
            report($e);

            return $this->check('database', 'Database', 'fail', 'The database could not be reached.');
        }
    }

    private function cache(): array
    {
        try {
            $key = 'health-check:'.Str::random(8);
            Cache::put($key, 'ok', 10);
            $works = Cache::get($key) === 'ok';
            Cache::forget($key);

            return $works
                ? $this->check('cache', 'Cache', 'ok', 'Reading and writing')
                : $this->check('cache', 'Cache', 'fail', 'Values written to the cache could not be read back.');
        } catch (Throwable $e) {
            report($e);

            return $this->check('cache', 'Cache', 'fail', 'The cache could not be used.');
        }
    }

    private function storage(): array
    {
        try {
            $disk = Storage::disk(VerificationDocument::DISK);
            $path = 'health-check/'.Str::random(12).'.txt';
            $disk->put($path, 'ok');
            $works = $disk->get($path) === 'ok';
            $disk->delete($path);

            return $works
                ? $this->check('storage', 'Document storage', 'ok', 'Private storage is writable')
                : $this->check('storage', 'Document storage', 'fail', 'Files written to storage could not be read back.');
        } catch (Throwable $e) {
            report($e);

            return $this->check('storage', 'Document storage', 'fail', 'Private storage is not writable.');
        }
    }

    private function queue(): array
    {
        try {
            $pending = Schema::hasTable('jobs') ? DB::table('jobs')->count() : 0;
            $failed = Schema::hasTable('failed_jobs') ? DB::table('failed_jobs')->count() : 0;
            $detail = "{$pending} waiting, {$failed} failed";

            return $this->check('queue', 'Background jobs (emails, reminders)', $failed > 0 || $pending > 100 ? 'warn' : 'ok', $detail);
        } catch (Throwable $e) {
            report($e);

            return $this->check('queue', 'Background jobs (emails, reminders)', 'fail', 'The job queue could not be read.');
        }
    }

    /** Settings that are fine on a developer machine but unsafe in production. */
    private function configuration(): array
    {
        $production = app()->environment('production');
        $warnIf = fn (bool $problem) => $problem && $production ? 'warn' : 'ok';

        return [
            $this->check(
                'debug',
                'Debug mode',
                $warnIf((bool) config('app.debug')),
                config('app.debug') ? 'On: error pages show internal details. Turn APP_DEBUG off in production.' : 'Off',
            ),
            $this->check(
                'https',
                'HTTPS',
                $warnIf(! str_starts_with((string) config('app.url'), 'https://')),
                str_starts_with((string) config('app.url'), 'https://') ? 'The app URL uses HTTPS' : 'The app URL is not HTTPS.',
            ),
            $this->check(
                'session_cookie',
                'Secure session cookie',
                $warnIf(! config('session.secure')),
                config('session.secure') ? 'Sent over HTTPS only' : 'Also sent over plain HTTP (set SESSION_SECURE_COOKIE=true in production).',
            ),
            $this->check(
                'mail',
                'Email delivery',
                $warnIf(config('mail.default') === 'log'),
                config('mail.default') === 'log' ? 'Written to the log, not delivered' : 'Delivering through '.config('mail.default'),
            ),
        ];
    }
}
