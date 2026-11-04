<?php

namespace App\Support;

use App\Models\Subscription;
use App\Models\SubscriptionPayment;

/**
 * One clinic's subscription as both the clinic and the system administrator see it. There is
 * no online payment and an expired plan does not lock a clinic out: past the due date it stays
 * in its grace period for the configured days, then counts as expired.
 */
class SubscriptionStatus
{
    public const ACTIVE = 'active';
    public const PENDING_PAYMENT = 'pending_payment';
    public const GRACE = 'grace';
    public const EXPIRED = 'expired';
    public const NONE = 'none';

    public static function of(?Subscription $subscription, ?SubscriptionPayment $latestPayment = null): string
    {
        $renewsAt = $subscription?->renews_at;

        if ($renewsAt?->isFuture()) {
            return self::ACTIVE;
        }
        if ($latestPayment?->status === SubscriptionPayment::PENDING) {
            return self::PENDING_PAYMENT;
        }
        if (! $renewsAt) {
            return self::NONE;
        }

        return $renewsAt->copy()->addDays((int) PlatformSettings::get('payment_grace_days'))->isFuture()
            ? self::GRACE
            : self::EXPIRED;
    }

    public static function planKey(?Subscription $subscription): string
    {
        $key = $subscription?->plan;

        return $key && config("subscriptions.plans.{$key}") ? $key : config('subscriptions.default_plan');
    }

    public static function plan(?Subscription $subscription): array
    {
        $key = self::planKey($subscription);

        return [...config("subscriptions.plans.{$key}"), 'key' => $key];
    }
}
