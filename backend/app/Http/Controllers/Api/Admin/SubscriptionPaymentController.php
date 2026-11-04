<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ClinicMembership;
use App\Models\Subscription;
use App\Models\SubscriptionPayment;
use App\Notifications\SubscriptionPaymentReviewed;
use App\Services\AuditLogger;
use App\Support\BusinessTime;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/** System administrators verify the manual payments clinics submit. */
class SubscriptionPaymentController extends Controller
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function index(Request $request)
    {
        $data = $request->validate(['status' => ['nullable', Rule::in([SubscriptionPayment::PENDING, SubscriptionPayment::VERIFIED, SubscriptionPayment::REJECTED])]]);

        $page = SubscriptionPayment::with(['clinic:id,name', 'submitter:id,name'])
            ->when($data['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->latest()->latest('id')
            ->paginate($this->perPage($request, 20));

        return $this->paginated($page, fn (SubscriptionPayment $payment) => [
            'id' => $payment->id,
            'clinic_id' => $payment->clinic_id,
            'clinic_name' => $payment->clinic?->name,
            'submitted_by' => $payment->submitter?->name,
            'submitted_at' => BusinessTime::iso($payment->created_at),
            'amount' => $payment->amount,
            'method' => config("subscriptions.channels.{$payment->method}.label", $payment->method),
            'reference' => $payment->reference,
            'status' => $payment->status,
            'invoice_number' => $payment->invoice_number,
            'review_note' => $payment->review_note,
        ]);
    }

    public function proof(SubscriptionPayment $payment)
    {
        abort_unless(Storage::disk(SubscriptionPayment::DISK)->exists($payment->proof_path), 404);

        return Storage::disk(SubscriptionPayment::DISK)->response($payment->proof_path, headers: [
            'Content-Type' => $payment->proof_mime_type,
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    /** A 5-minute signed link for the mobile app, which opens files in the phone's browser. */
    public function proofLink(SubscriptionPayment $payment)
    {
        $this->audit->record('subscription.proof_opened', $payment, clinicId: $payment->clinic_id);

        return $this->ok(['url' => URL::temporarySignedRoute('subscription-proofs.download', now()->addMinutes(5), ['payment' => $payment->id], absolute: false)]);
    }

    /** Accepts the payment and extends the plan by a month from its end (or from today). */
    public function verify(Request $request, SubscriptionPayment $payment)
    {
        DB::transaction(function () use ($payment, $request) {
            $locked = SubscriptionPayment::whereKey($payment->id)->lockForUpdate()->firstOrFail();
            $this->assertPending($locked);

            $subscription = Subscription::firstOrNew(['clinic_id' => $locked->clinic_id]);
            $subscription->clinic_id = $locked->clinic_id;
            $from = $subscription->renews_at?->isFuture() ? $subscription->renews_at : now();
            // A plan changed since this proof was sent stays changed.
            $subscription->plan ??= $locked->plan;
            $subscription->status = Subscription::STATUS_ACTIVE;
            $subscription->renews_at = $from->copy()->addMonthNoOverflow();
            $subscription->save();

            $locked->status = SubscriptionPayment::VERIFIED;
            $locked->reviewed_by = $request->user()->id;
            $locked->reviewed_at = now();
            $locked->invoice_number = sprintf('INV-%d-%03d', BusinessTime::now()->year, $locked->id);
            $locked->save();
            $payment->setRawAttributes($locked->getAttributes());
        });

        return $this->decided($payment, 'subscription.payment_verified', 'Payment verified');
    }

    public function reject(Request $request, SubscriptionPayment $payment)
    {
        $data = $request->validate(['note' => ['required', 'string', 'max:500']]);

        DB::transaction(function () use ($payment, $request, $data) {
            $locked = SubscriptionPayment::whereKey($payment->id)->lockForUpdate()->firstOrFail();
            $this->assertPending($locked);

            $locked->status = SubscriptionPayment::REJECTED;
            $locked->reviewed_by = $request->user()->id;
            $locked->reviewed_at = now();
            $locked->review_note = $data['note'];
            $locked->save();
            $payment->setRawAttributes($locked->getAttributes());
        });

        return $this->decided($payment, 'subscription.payment_rejected', 'Payment rejected');
    }

    private function assertPending(SubscriptionPayment $payment): void
    {
        if ($payment->status !== SubscriptionPayment::PENDING) {
            throw new ConflictHttpException('This payment has already been reviewed.');
        }
    }

    private function decided(SubscriptionPayment $payment, string $action, string $message)
    {
        $this->audit->record($action, $payment, clinicId: $payment->clinic_id);

        ClinicMembership::where('clinic_id', $payment->clinic_id)
            ->where('role', ClinicMembership::ROLE_CLINIC_ADMIN)
            ->active()
            ->with('user')
            ->get()
            ->each(fn (ClinicMembership $member) => $member->user?->notify(new SubscriptionPaymentReviewed($payment)));

        return $this->ok(['id' => $payment->id, 'status' => $payment->status], $message);
    }
}
