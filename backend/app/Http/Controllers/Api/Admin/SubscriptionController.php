<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Clinic;
use App\Models\Subscription;
use App\Models\SubscriptionPayment;
use App\Services\AuditLogger;
use App\Support\BusinessTime;
use App\Support\SubscriptionStatus;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/** Subscriptions: one row per clinic, with the manual payment workflow behind it. */
class SubscriptionController extends Controller
{
    private const HISTORY = 12;

    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function index(Request $request)
    {
        $request->validate(['search' => ['nullable', 'string', 'max:100']]);

        $page = Clinic::query()
            ->where('status', '!=', Clinic::STATUS_PENDING)
            ->when($request->filled('search'), fn ($q) => $q->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($request->search).'%']))
            ->with(['subscription', 'latestPayment'])
            ->orderBy('name')
            ->paginate($this->perPage($request, 20));

        return $this->paginated($page, fn (Clinic $clinic) => $this->row($clinic));
    }

    public function show(Clinic $clinic)
    {
        $clinic->load(['subscription', 'latestPayment.submitter:id,name']);
        $payments = SubscriptionPayment::where('clinic_id', $clinic->id)->latest()->latest('id')->limit(self::HISTORY)->get();
        $latest = $clinic->latestPayment;

        return $this->ok([
            ...$this->row($clinic),
            'payment' => $latest ? [
                'id' => $latest->id,
                'status' => $latest->status,
                'amount' => $latest->amount,
                'method' => config("subscriptions.channels.{$latest->method}.label", $latest->method),
                'reference' => $latest->reference,
                'submitted_by' => $latest->submitter?->name,
                'submitted_at' => BusinessTime::iso($latest->created_at),
                'reviewed_at' => BusinessTime::iso($latest->reviewed_at),
                'review_note' => $latest->review_note,
                'invoice_number' => $latest->invoice_number,
                'proof_mime_type' => $latest->proof_mime_type,
            ] : null,
            'history' => $payments->map(fn (SubscriptionPayment $payment) => [
                'id' => $payment->id,
                'status' => $payment->status,
                'amount' => $payment->amount,
                'method' => config("subscriptions.channels.{$payment->method}.label", $payment->method),
                'submitted_at' => BusinessTime::iso($payment->created_at),
                'invoice_number' => $payment->invoice_number,
            ]),
            'plans' => collect(config('subscriptions.plans'))
                ->reject(fn (array $plan) => $plan['retired'] ?? false)
                ->map(fn (array $plan, string $key) => ['key' => $key, 'name' => $plan['name'], 'price' => $plan['price']])
                ->values(),
        ]);
    }

    /** Takes effect from the clinic's next payment; the current due date does not move. */
    public function changePlan(Request $request, Clinic $clinic)
    {
        $offered = collect(config('subscriptions.plans'))->reject(fn (array $plan) => $plan['retired'] ?? false)->keys()->all();
        $data = $request->validate(['plan' => ['required', Rule::in($offered)]]);

        $subscription = Subscription::firstOrNew(['clinic_id' => $clinic->id]);
        $subscription->clinic_id = $clinic->id;
        $from = SubscriptionStatus::planKey($subscription);
        $subscription->plan = $data['plan'];
        $subscription->status ??= Subscription::STATUS_ACTIVE;
        $subscription->save();

        $this->audit->record('subscription.plan_changed', $clinic, ['from' => $from, 'to' => $data['plan']], $clinic->id);

        return $this->ok($this->row($clinic->load(['subscription', 'latestPayment'])), 'Plan changed');
    }

    private function row(Clinic $clinic): array
    {
        $subscription = $clinic->subscription;
        $latest = $clinic->latestPayment;
        $plan = SubscriptionStatus::plan($subscription);

        return [
            'clinic_id' => $clinic->id,
            'clinic_name' => $clinic->name,
            'plan_key' => $plan['key'],
            'plan' => $plan['name'],
            'amount' => $plan['price'],
            'due_at' => BusinessTime::iso($subscription?->renews_at),
            'status' => SubscriptionStatus::of($subscription, $latest),
            'payment_status' => $latest?->status,
            'payment_id' => $latest?->id,
        ];
    }
}
