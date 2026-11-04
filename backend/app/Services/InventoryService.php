<?php

namespace App\Services;

use App\Models\Clinic;
use App\Models\InventoryBatch;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Models\User;
use App\Support\BusinessTime;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

/**
 * Every stock change is a movement recorded in the same transaction, with
 * the batch rows locked, so quantities and history always agree.
 *
 * - receipt: creates a batch (lot number, expiry, supplier).
 * - usage: takes from usable batches, earliest expiry first (FEFO);
 *   expired stock is never used. Fails if there is not enough usable stock.
 * - adjustment: corrects one batch up or down (counted stock); reason required.
 * - disposal: removes stock from one batch (e.g. expired); reason required.
 * Stock can never go negative.
 */
class InventoryService
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function receive(InventoryItem $item, int $quantity, array $batchData, User $actor, ?string $reason = null): InventoryBatch
    {
        $this->assertPositive($quantity);

        return DB::transaction(function () use ($item, $quantity, $batchData, $actor, $reason) {
            $batch = new InventoryBatch($batchData);
            $batch->inventory_item_id = $item->id;
            $batch->quantity_on_hand = $quantity;
            $batch->received_at = now();
            $batch->save();

            $this->record($item, $batch, InventoryMovement::RECEIPT, $quantity, $quantity, $reason, $actor);

            return $batch;
        });
    }

    /** @return list<InventoryMovement> */
    public function use(InventoryItem $item, int $quantity, User $actor, ?string $reason = null): array
    {
        $this->assertPositive($quantity);

        return DB::transaction(function () use ($item, $quantity, $actor, $reason) {
            $batches = InventoryBatch::where('inventory_item_id', $item->id)
                ->usable()
                ->orderByRaw('expires_on IS NULL')
                ->orderBy('expires_on')
                ->orderBy('id')
                ->lockForUpdate()
                ->get();

            if ($batches->sum('quantity_on_hand') < $quantity) {
                throw new ConflictHttpException("Not enough usable stock: {$batches->sum('quantity_on_hand')} {$item->unit} available.");
            }

            $movements = [];
            $remaining = $quantity;
            foreach ($batches as $batch) {
                if ($remaining === 0) {
                    break;
                }
                $take = min($remaining, $batch->quantity_on_hand);
                $batch->quantity_on_hand -= $take;
                $batch->save();
                $remaining -= $take;

                $movements[] = $this->record($item, $batch, InventoryMovement::USAGE, -$take, $batch->quantity_on_hand, $reason, $actor);
            }

            return $movements;
        });
    }

    /** Set a batch to a counted quantity (or change it by a signed amount for disposal). */
    public function adjust(InventoryItem $item, InventoryBatch $batch, string $type, int $change, User $actor, string $reason): InventoryMovement
    {
        if ($batch->inventory_item_id !== $item->id) {
            throw new UnprocessableEntityHttpException('That batch does not belong to this item.');
        }
        if ($change === 0) {
            throw new UnprocessableEntityHttpException('Quantity change cannot be zero.');
        }
        if ($type === InventoryMovement::DISPOSAL && $change > 0) {
            throw new UnprocessableEntityHttpException('A disposal must remove stock.');
        }

        return DB::transaction(function () use ($item, $batch, $type, $change, $actor, $reason) {
            /** @var InventoryBatch $locked */
            $locked = InventoryBatch::whereKey($batch->id)->lockForUpdate()->firstOrFail();
            $balance = $locked->quantity_on_hand + $change;

            if ($balance < 0) {
                throw new ConflictHttpException("This batch only has {$locked->quantity_on_hand} {$item->unit}.");
            }

            $locked->quantity_on_hand = $balance;
            $locked->save();

            $movement = $this->record($item, $locked, $type, $change, $balance, $reason, $actor);
            $this->audit->record('inventory.'.$type, $item, ['batch_id' => $locked->id, 'change' => $change, 'reason' => $reason], $item->clinic_id, $actor);

            return $movement;
        });
    }

    /**
     * Items needing attention.
     * @return array{low_stock: list<array>, near_expiry: list<array>, expired: list<array>}
     */
    public function alerts(Clinic $clinic): array
    {
        $today = BusinessTime::today();
        $cutoff = $today->addDays(config('booking.near_expiry_days'));
        $items = $clinic->inventoryItems()->where('is_active', true)->with('batches')->get();

        $lowStock = [];
        $nearExpiry = [];
        $expired = [];

        foreach ($items as $item) {
            $usable = $item->batches->filter(fn ($b) => $b->quantity_on_hand > 0 && ! $b->isExpired());

            if ($usable->sum('quantity_on_hand') <= $item->minimum_stock) {
                $lowStock[] = ['item_id' => $item->id, 'name' => $item->name, 'quantity' => $usable->sum('quantity_on_hand'), 'minimum_stock' => $item->minimum_stock, 'unit' => $item->unit];
            }

            foreach ($item->batches as $batch) {
                if ($batch->quantity_on_hand <= 0 || ! $batch->expires_on) {
                    continue;
                }
                $entry = ['item_id' => $item->id, 'name' => $item->name, 'batch_id' => $batch->id, 'batch_number' => $batch->batch_number,
                    'expires_on' => $batch->expires_on->toDateString(), 'quantity' => $batch->quantity_on_hand, 'unit' => $item->unit];

                if ($batch->isExpired()) {
                    $expired[] = $entry;
                } elseif ($batch->expires_on->lte($cutoff)) {
                    $nearExpiry[] = $entry;
                }
            }
        }

        return ['low_stock' => $lowStock, 'near_expiry' => $nearExpiry, 'expired' => $expired];
    }

    private function record(InventoryItem $item, InventoryBatch $batch, string $type, int $quantity, int $balance, ?string $reason, User $actor): InventoryMovement
    {
        $movement = new InventoryMovement;
        $movement->inventory_item_id = $item->id;
        $movement->inventory_batch_id = $batch->id;
        $movement->type = $type;
        $movement->quantity = $quantity;
        $movement->balance_after = $balance;
        $movement->reason = $reason;
        $movement->performed_by = $actor->id;
        $movement->save();

        return $movement;
    }

    private function assertPositive(int $quantity): void
    {
        if ($quantity < 1) {
            throw new UnprocessableEntityHttpException('Quantity must be at least 1.');
        }
    }
}
