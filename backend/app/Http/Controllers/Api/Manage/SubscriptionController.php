<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\Subscription;
use App\Models\SubscriptionPayment;
use App\Models\User;
use App\Notifications\SubscriptionPaymentSubmitted;
use App\Services\AuditLogger;
use App\Support\BusinessTime;
use App\Support\SubscriptionInvoice;
use App\Support\SubscriptionStatus;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rule;

/**
 * The clinic's plan and manual payments. There is no online payment: the clinic transfers
 * the money, uploads proof, and a system administrator verifies it (see
 * Admin\SubscriptionPaymentController). An expired plan does not lock the clinic out.
 */
class SubscriptionController extends Controller
{
    private const MAX_KILOBYTES = 5120;

    private const HISTORY = 24;

    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function show(Clinic $clinic)
    {
        $subscription = Subscription::firstWhere('clinic_id', $clinic->id);
        $renewsAt = $subscription?->renews_at;
        $payments = SubscriptionPayment::where('clinic_id', $clinic->id)->latest()->latest('id')->limit(self::HISTORY)->get();

        return $this->ok([
            'plan' => SubscriptionStatus::plan($subscription),
            'status' => $this->status($subscription),
            'renews_at' => $renewsAt ? BusinessTime::iso($renewsAt) : null,
            'days_remaining' => $renewsAt ? max(0, (int) ceil(now()->diffInSeconds($renewsAt, false) / 86400)) : null,
            'channels' => collect(config('subscriptions.channels'))->map(fn (array $channel, string $key) => [...$channel, 'key' => $key])->values(),
            'has_pending_payment' => $payments->contains('status', SubscriptionPayment::PENDING),
            'payments' => $payments->map(fn (SubscriptionPayment $payment) => $this->present($payment)),
        ]);
    }

    public function storePayment(Request $request, Clinic $clinic)
    {
        $data = $request->validate([
            'method' => ['required', Rule::in(array_keys(config('subscriptions.channels')))],
            'reference' => ['nullable', 'string', 'max:100'],
            'proof' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'mimetypes:image/jpeg,image/png,application/pdf', 'max:'.self::MAX_KILOBYTES],
        ]);

        if (SubscriptionPayment::where('clinic_id', $clinic->id)->where('status', SubscriptionPayment::PENDING)->exists()) {
            return $this->fail('You already have a payment proof waiting for review.', 409);
        }

        $planKey = SubscriptionStatus::planKey(Subscription::firstWhere('clinic_id', $clinic->id));
        $proof = $request->file('proof');

        $payment = new SubscriptionPayment([
            'plan' => $planKey,
            'amount' => config("subscriptions.plans.{$planKey}.price"),
            'method' => $data['method'],
            'reference' => $data['reference'] ?? null,
            'proof_path' => $proof->store("subscription-proofs/{$clinic->id}", SubscriptionPayment::DISK),
            'proof_mime_type' => $proof->getMimeType(),
        ]);
        $payment->clinic_id = $clinic->id;
        $payment->submitted_by = $request->user()->id;
        $payment->save();

        $this->audit->record('subscription.payment_submitted', $payment, ['method' => $payment->method], $clinic->id);
        Notification::send(User::where('role', 'system_admin')->get(), new SubscriptionPaymentSubmitted($payment->load('clinic')));

        return $this->ok($this->present($payment), 'Payment proof submitted', 201);
    }

    /** Tells the system administrators the clinic wants to renew, before it has paid. */
    public function requestRenewal(Request $request, Clinic $clinic)
    {
        $this->audit->record('subscription.renewal_requested', $clinic, clinicId: $clinic->id);

        return $this->ok(message: 'Renewal requested. Submit your payment proof to complete it.');
    }

    /** A receipt for a verified payment. */
    public function invoice(Clinic $clinic, int $paymentId)
    {
        return SubscriptionInvoice::response($this->verifiedPayment($clinic, $paymentId));
    }

    /** A 5-minute signed link for the mobile app, which opens files in the phone's browser. */
    public function invoiceLink(Clinic $clinic, int $paymentId)
    {
        $payment = $this->verifiedPayment($clinic, $paymentId);

        return $this->ok(['url' => URL::temporarySignedRoute('subscription-invoices.download', now()->addMinutes(5), ['payment' => $payment->id], absolute: false)]);
    }

    private function verifiedPayment(Clinic $clinic, int $paymentId): SubscriptionPayment
    {
        return SubscriptionPayment::where('clinic_id', $clinic->id)
            ->where('status', SubscriptionPayment::VERIFIED)
            ->findOrFail($paymentId);
    }

    private function status(?Subscription $subscription): string
    {
        $status = SubscriptionStatus::of($subscription);

        return $status === SubscriptionStatus::GRACE ? 'expired' : $status;
    }

    private function present(SubscriptionPayment $payment): array
    {
        return [
            'id' => $payment->id,
            'date' => BusinessTime::iso($payment->created_at),
            'description' => config("subscriptions.plans.{$payment->plan}.name", $payment->plan).' – Monthly Renewal',
            'amount' => $payment->amount,
            'method' => $payment->method,
            'reference' => $payment->reference,
            'invoice_number' => $payment->invoice_number,
            'status' => $payment->status,
            'review_note' => $payment->review_note,
        ];
    }
}
