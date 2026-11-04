<?php

namespace App\Notifications;

use App\Models\SubscriptionPayment;

/** Tells system administrators that a payment proof is waiting for review. */
class SubscriptionPaymentSubmitted extends AppNotification
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
        return 'admin_payment_submissions';
    }

    protected function title(): string
    {
        return 'Payment proof to review';
    }

    protected function message(): string
    {
        return "{$this->payment->clinic?->name} submitted a payment proof for review.";
    }

    protected function resource(): ?array
    {
        return ['type' => 'subscription_payment', 'id' => $this->payment->id, 'clinic_id' => $this->payment->clinic_id];
    }
}
