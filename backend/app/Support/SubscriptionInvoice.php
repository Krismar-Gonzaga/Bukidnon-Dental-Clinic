<?php

namespace App\Support;

use App\Models\Clinic;
use App\Models\SubscriptionPayment;
use Symfony\Component\HttpFoundation\Response;

/** The PDF invoice of a verified subscription payment. */
class SubscriptionInvoice
{
    public static function response(SubscriptionPayment $payment): Response
    {
        $clinic = Clinic::findOrFail($payment->clinic_id);
        $plan = config("subscriptions.plans.{$payment->plan}.name", $payment->plan);

        $pdf = SimplePdf::render([
            [config('app.name'), true],
            'Invoice '.$payment->invoice_number,
            '',
            'Clinic: '.$clinic->name,
            'Description: '.$plan.' - Monthly Renewal',
            'Amount: PHP '.number_format($payment->amount, 2),
            'Paid through: '.config("subscriptions.channels.{$payment->method}.label", $payment->method),
            'Reference: '.($payment->reference ?: '-'),
            'Verified on: '.BusinessTime::local($payment->reviewed_at)->format('F j, Y'),
        ]);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$payment->invoice_number.'.pdf"',
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
