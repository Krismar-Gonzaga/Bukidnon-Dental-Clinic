<?php

namespace App\Console\Commands;

use App\Models\Clinic;
use App\Models\ClinicMembership;
use App\Models\User;
use App\Notifications\InventoryAlert;
use App\Services\InventoryService;
use App\Support\BusinessTime;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

/**
 * Daily digest of low-stock, near-expiry and expired items for each clinic,
 * sent to members who manage inventory. Sent at most once per clinic per day.
 */
class SendInventoryAlerts extends Command
{
    protected $signature = 'inventory:send-alerts';

    protected $description = 'Notify clinics about low stock and expiring inventory';

    public function handle(InventoryService $inventory): int
    {
        $today = BusinessTime::today()->toDateString();
        $notified = 0;

        Clinic::where('status', Clinic::STATUS_APPROVED)->whereHas('inventoryItems')->each(function (Clinic $clinic) use ($inventory, $today, &$notified) {
            $alerts = $inventory->alerts($clinic);
            $low = count($alerts['low_stock']);
            $near = count($alerts['near_expiry']);
            $expired = count($alerts['expired']);

            if ($low + $near + $expired === 0) {
                return;
            }

            $recipients = User::where('status', User::STATUS_ACTIVE)
                ->whereHas('clinicMemberships', fn ($q) => $q->where('clinic_id', $clinic->id)->active()
                    ->whereIn('role', [ClinicMembership::ROLE_CLINIC_ADMIN, ClinicMembership::ROLE_INVENTORY_STAFF]))
                ->get()
                ->reject(fn (User $user) => $user->notifications()
                    ->where('type', InventoryAlert::class)
                    ->where('data', 'like', '%"clinic_id":'.$clinic->id.',"date":"'.$today.'"%')
                    ->exists());

            if ($recipients->isNotEmpty()) {
                Notification::send($recipients, new InventoryAlert($clinic, $low, $near, $expired, $today));
                $notified += $recipients->count();
            }
        });

        $this->info("Notified {$notified} member(s).");

        return self::SUCCESS;
    }
}
