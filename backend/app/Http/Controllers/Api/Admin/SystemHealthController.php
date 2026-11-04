<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\SystemHealth;

/** Live checks of the services the platform depends on. */
class SystemHealthController extends Controller
{
    public function __invoke(SystemHealth $health)
    {
        return $this->ok($health->report());
    }
}
