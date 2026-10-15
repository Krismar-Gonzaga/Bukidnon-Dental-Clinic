<?php

namespace Tests\Feature\Inventory;

use App\Models\ClinicMembership;
use App\Models\InventoryMovement;
use App\Models\User;
use App\Notifications\InventoryAlert;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\ClinicWorld;
use Tests\TestCase;

class InventoryTest extends TestCase
{
    use ClinicWorld, RefreshDatabase;

    private array $world;

    private User $keeper;

    protected function setUp(): void
    {
        parent::setUp();
        $this->freezeClock(); // today = 2026-11-02
        $this->world = $this->makeClinic();
        $this->keeper = User::factory()->role('staff')->memberOf($this->world['clinic'], ClinicMembership::ROLE_INVENTORY_STAFF)->create();
    }

    private function createItem(int $minimum = 10): int
    {
        return $this->asUser($this->keeper)->postJson($this->manage($this->world, '/inventory/items'), [
            'name' => 'Nitrile gloves (M)', 'unit' => 'box', 'minimum_stock' => $minimum,
        ])->assertCreated()->json('data.id');
    }

    private function move(int $itemId, array $body)
    {
        return $this->asUser($this->keeper)->postJson($this->manage($this->world, "/inventory/items/{$itemId}/movements"), $body);
    }

    public function test_receipts_and_usage_follow_first_expiry_first_out(): void
    {
        $item = $this->createItem();
        $this->move($item, ['type' => 'receipt', 'quantity' => 5, 'batch_number' => 'LATE', 'expires_on' => '2027-06-01'])->assertCreated();
        $this->move($item, ['type' => 'receipt', 'quantity' => 5, 'batch_number' => 'EARLY', 'expires_on' => '2026-12-01'])->assertCreated();

        $data = $this->move($item, ['type' => 'usage', 'quantity' => 7, 'reason' => 'Clinic day'])->assertCreated()->json('data');

        $batches = collect($data['batches'])->keyBy('batch_number');
        $this->assertSame(0, $batches['EARLY']['quantity_on_hand']);
        $this->assertSame(3, $batches['LATE']['quantity_on_hand']);
        $this->assertSame(3, $data['quantity_usable']);
        // Two receipts plus usage split across two batches.
        $this->assertSame(4, InventoryMovement::where('inventory_item_id', $item)->count());
    }

    public function test_cannot_use_more_than_usable_stock_and_expired_stock_is_never_used(): void
    {
        $item = $this->createItem();
        $this->move($item, ['type' => 'receipt', 'quantity' => 10, 'batch_number' => 'OLD', 'expires_on' => '2026-10-01'])->assertCreated();
        $this->move($item, ['type' => 'receipt', 'quantity' => 2, 'batch_number' => 'OK', 'expires_on' => '2027-01-01'])->assertCreated();

        $this->move($item, ['type' => 'usage', 'quantity' => 3])->assertStatus(409);
        $this->move($item, ['type' => 'usage', 'quantity' => 2])->assertCreated()
            ->assertJsonPath('data.quantity_usable', 0)
            ->assertJsonPath('data.quantity_expired', 10);
    }

    public function test_adjustments_need_a_reason_and_cannot_go_negative(): void
    {
        $item = $this->createItem();
        $batchId = $this->move($item, ['type' => 'receipt', 'quantity' => 4])->json('data.batches.0.id');

        $this->move($item, ['type' => 'adjustment', 'batch_id' => $batchId, 'quantity' => -1])->assertStatus(422);
        $this->move($item, ['type' => 'adjustment', 'batch_id' => $batchId, 'quantity' => -5, 'reason' => 'Count'])->assertStatus(409);
        $this->move($item, ['type' => 'disposal', 'batch_id' => $batchId, 'quantity' => 1, 'reason' => 'Damaged box'])->assertCreated()
            ->assertJsonPath('data.quantity_usable', 3);

        $movement = InventoryMovement::where('type', 'disposal')->first();
        $this->assertSame(-1, $movement->quantity);
        $this->assertSame($this->keeper->id, $movement->performed_by);
        $this->assertSame('Damaged box', $movement->reason);
    }

    public function test_alerts_flag_low_stock_near_expiry_and_expired(): void
    {
        $item = $this->createItem(minimum: 10);
        $this->move($item, ['type' => 'receipt', 'quantity' => 3, 'expires_on' => '2026-11-20'])->assertCreated();
        $this->move($item, ['type' => 'receipt', 'quantity' => 1, 'expires_on' => '2026-10-15'])->assertCreated();

        $alerts = $this->asUser($this->keeper)->getJson($this->manage($this->world, '/inventory/alerts'))->assertOk()->json('data');

        $this->assertCount(1, $alerts['low_stock']);
        $this->assertCount(1, $alerts['near_expiry']);
        $this->assertCount(1, $alerts['expired']);
    }

    public function test_daily_alert_notification_is_sent_once_per_day(): void
    {
        $item = $this->createItem(minimum: 10);
        $this->move($item, ['type' => 'receipt', 'quantity' => 1])->assertCreated();

        $this->artisan('inventory:send-alerts')->assertSuccessful();
        $this->artisan('inventory:send-alerts')->assertSuccessful();

        $count = fn (User $user) => $user->notifications()->where('type', InventoryAlert::class)->count();
        $this->assertSame(1, $count($this->keeper));
        $this->assertSame(1, $count($this->world['admin']));
        $this->assertSame(0, $count($this->world['dentistUser']));

        $this->travel(1)->days();
        $this->artisan('inventory:send-alerts')->assertSuccessful();
        $this->assertSame(2, $count($this->keeper));
    }

    public function test_inventory_is_isolated_per_clinic_and_by_permission(): void
    {
        $item = $this->createItem();
        $other = $this->makeClinic();
        $otherAdmin = $other['admin'];

        // Another clinic's admin, using their own clinic id, cannot reach this item.
        $this->asUser($otherAdmin)->postJson($this->manage($other, "/inventory/items/{$item}/movements"), ['type' => 'usage', 'quantity' => 1])->assertNotFound();
        // ...nor this clinic's inventory at all.
        $this->asUser($otherAdmin)->getJson($this->manage($this->world, '/inventory/items'))->assertNotFound();
        // A dentist here has no inventory permission.
        $this->asUser($this->world['dentistUser'])->getJson($this->manage($this->world, '/inventory/items'))->assertForbidden();
        // An inventory keeper cannot touch appointments or records.
        $this->asUser($this->keeper)->getJson($this->manage($this->world, '/appointments'))->assertForbidden();
    }
}
