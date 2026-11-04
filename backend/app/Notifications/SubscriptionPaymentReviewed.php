<?php

namespace App\Notifications;

use App\Models\SubscriptionPayment;

/** Tells the clinic's administrators how their payment proof was decided. */
class SubscriptionPaymentReviewed extends AppNotification
{
    public function __construct(public SubscriptionPayment $payment)
    {
        $this->afterCommit();
    }

    protected function kind(): string
    {
        return 'subscription';
    }

    protected function category(): ?string
    {
        return 'subscription_renewal';
    }

    protected function title(): string
    {
        return $this->payment->status === SubscriptionPayment::VERIFIED ? 'Subscription renewed' : 'Payment proof not accepted';
    }

    protected function message(): string
    {
        return $this->payment->status === SubscriptionPayment::VERIFIED
            ? 'Your payment was verified and your subscription has been renewed.'
            : 'Your payment proof could not be verified. Please check it and submit it again.';
    }

    protected function resource(): ?array
    {
        return ['type' => 'subscription', 'clinic_id' => $this->payment->clinic_id];
    }
}
