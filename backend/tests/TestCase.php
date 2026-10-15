<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Tests refresh the database. Refuse to run against anything but the
        // in-memory SQLite database from phpunit.xml, so a cached config or a
        // stray env var can never point them at the shared Supabase database.
        $connection = config('database.default');
        $database = config("database.connections.{$connection}.database");

        if ($connection !== 'sqlite' || $database !== ':memory:') {
            throw new RuntimeException(
                "Tests must use in-memory SQLite, got [{$connection}] [{$database}]. "
                .'Run `php artisan config:clear` and check phpunit.xml.'
            );
        }
    }
}
