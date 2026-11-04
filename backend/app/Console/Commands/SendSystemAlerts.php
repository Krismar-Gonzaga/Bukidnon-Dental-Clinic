<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Notifications\PortalNotice;
use App\Services\SystemHealth;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Notification;

/** "System Errors & Alerts": tells administrators when the platform's health gets worse, once. */
class SendSystemAlerts extends Command
{
    protected $signature = 'admin:send-system-alerts';

    protected $description = 'Alert system administrators when a platform health check starts failing';

    private const LAST_STATUS = 'system-alerts:last-status';

    public function handle(SystemHealth $health): int
    {
        $report = $health->report();
        $last = Cache::get(self::LAST_STATUS, 'healthy');
        Cache::forever(self::LAST_STATUS, $report['status']);

        if ($report['status'] === 'healthy' || $report['status'] === $last) {
            $this->line("Platform status: {$report['status']}. Nothing to send.");

            return self::SUCCESS;
        }

        $problems = collect($report['checks'])->where('status', '!=', 'ok')->pluck('label')->implode(', ');
        Notification::send(
            User::where('role', 'system_admin')->where('status', User::STATUS_ACTIVE)->get(),
            new PortalNotice(
                'system_alert',
                $report['status'] === 'down' ? 'A platform service is down' : 'A platform service needs attention',
                "Check System Settings. Affected: {$problems}.",
                'admin_system_alerts',
            ),
        );
        $this->line("Platform status: {$report['status']}. Administrators alerted.");

        return self::SUCCESS;
    }
}
