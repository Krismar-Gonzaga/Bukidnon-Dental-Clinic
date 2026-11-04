<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    /**
     * Tests refresh the database. Refuse to run against anything but the in-memory SQLite
     * database from phpunit.xml, so a cached config or a stray env var can never point them
     * at the shared Supabase database.
     *
     * This has to run here and not in setUp(): RefreshDatabase wipes the database during
     * parent::setUp(), so a check after that call would only report the damage.
     */
    public function createApplication()
    {
        $app = parent::createApplication();

        $connection = $app['config']->get('database.default');
        $settings = $app['config']->get("database.connections.{$connection}", []);
        $database = $settings['database'] ?? null;

        // A URL takes priority over the other settings, so it could still lead elsewhere.
        if ($connection !== 'sqlite' || $database !== ':memory:' || ! empty($settings['url'])) {
            throw new RuntimeException(
                "Tests must use in-memory SQLite, got [{$connection}] [{$database}]. "
                .'Run `php artisan config:clear` and check phpunit.xml.'
            );
        }

        return $app;
    }
}
