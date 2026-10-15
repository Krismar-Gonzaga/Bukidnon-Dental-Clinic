<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Http\Resources\InventoryItemResource;
use App\Models\Clinic;
use App\Models\InventoryItem;
use App\Models\InventoryMovement;
use App\Services\AuditLogger;
use App\Services\InventoryService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InventoryController extends Controller
{
    public function __construct(
        private readonly InventoryService $inventory,
        private readonly AuditLogger $audit,
    ) {
    }

    public function index(Request $request, Clinic $clinic)
    {
        $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'category_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'in:low_stock,active,inactive'],
        ]);

        $items = $clinic->inventoryItems()
            ->with(['category'])
            ->when($request->filled('search'), fn ($q) => $q->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($request->search).'%']))
            ->when($request->filled('category_id'), fn ($q) => $q->where('category_id', $request->category_id))
            ->when($request->status === 'inactive', fn ($q) => $q->where('is_active', false), fn ($q) => $q->where('is_active', true))
            ->orderBy('name')
            ->get()
            ->map(fn ($item) => (new InventoryItemResource($item))->resolve());

        if ($request->status === 'low_stock') {
            $items = $items->where('is_low_stock', true)->values();
        }

        return $this->ok($items);
    }

    public function show(Clinic $clinic, InventoryItem $inventoryItem)
    {
        $inventoryItem->load(['category', 'batches.supplier', 'movements' => fn ($q) => $q->limit(100)->with('performedBy:id,name')]);

        return $this->ok((new InventoryItemResource($inventoryItem))->resolve());
    }

    public function store(Request $request, Clinic $clinic)
    {
        $item = new InventoryItem($request->validate($this->itemRules($clinic, true)));
        $item->clinic_id = $clinic->id;
        $item->save();

        $this->audit->record('inventory.item_created', $item, clinicId: $clinic->id);

        return $this->ok((new InventoryItemResource($item->load('category')))->resolve(), 'Item added', 201);
    }

    public function update(Request $request, Clinic $clinic, InventoryItem $inventoryItem)
    {
        $data = $request->validate($this->itemRules($clinic, false));
        $inventoryItem->update($data);
        $this->audit->record('inventory.item_updated', $inventoryItem, ['fields' => array_keys($data)], $clinic->id);

        return $this->ok((new InventoryItemResource($inventoryItem->load('category')))->resolve(), 'Item updated');
    }

    /**
     * Record a stock movement.
     * receipt:    { type, quantity, batch_number?, expires_on?, supplier_id?, reason? }
     * usage:      { type, quantity, reason? }                (FEFO across batches)
     * adjustment: { type, batch_id, quantity (signed), reason }
     * disposal:   { type, batch_id, quantity (positive amount removed), reason }
     */
    public function storeMovement(Request $request, Clinic $clinic, InventoryItem $inventoryItem)
    {
        $type = $request->input('type');

        $data = $request->validate([
            'type' => ['required', Rule::in([InventoryMovement::RECEIPT, InventoryMovement::USAGE, InventoryMovement::ADJUSTMENT, InventoryMovement::DISPOSAL])],
            'quantity' => ['required', 'integer', $type === InventoryMovement::ADJUSTMENT ? 'not_in:0' : 'min:1', 'between:-100000,100000'],
            'reason' => [in_array($type, [InventoryMovement::ADJUSTMENT, InventoryMovement::DISPOSAL], true) ? 'required' : 'nullable', 'string', 'max:255'],
            'batch_id' => [in_array($type, [InventoryMovement::ADJUSTMENT, InventoryMovement::DISPOSAL], true) ? 'required' : 'prohibited', 'integer'],
            'batch_number' => ['nullable', 'string', 'max:100'],
            'expires_on' => ['nullable', 'date_format:Y-m-d'],
            'supplier_id' => ['nullable', 'integer', Rule::exists('suppliers', 'id')->where('clinic_id', $clinic->id)],
        ]);

        $actor = $request->user();

        match ($data['type']) {
            InventoryMovement::RECEIPT => $this->inventory->receive(
                $inventoryItem,
                $data['quantity'],
                array_filter([
                    'batch_number' => $data['batch_number'] ?? null,
                    'expires_on' => $data['expires_on'] ?? null,
                    'supplier_id' => $data['supplier_id'] ?? null,
                ]),
                $actor,
                $data['reason'] ?? null
            ),
            InventoryMovement::USAGE => $this->inventory->use($inventoryItem, $data['quantity'], $actor, $data['reason'] ?? null),
            default => $this->inventory->adjust(
                $inventoryItem,
                $inventoryItem->batches()->findOrFail($data['batch_id']),
                $data['type'],
                $data['type'] === InventoryMovement::DISPOSAL ? -abs($data['quantity']) : $data['quantity'],
                $actor,
                $data['reason']
            ),
        };

        return $this->show($clinic, $inventoryItem->fresh())->setStatusCode(201);
    }

    public function alerts(Clinic $clinic)
    {
        return $this->ok($this->inventory->alerts($clinic));
    }

    public function categories(Clinic $clinic)
    {
        return $this->ok($clinic->inventoryCategories()->orderBy('name')->get(['id', 'name']));
    }

    public function storeCategory(Request $request, Clinic $clinic)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100', Rule::unique('inventory_categories')->where('clinic_id', $clinic->id)],
        ]);

        return $this->ok($clinic->inventoryCategories()->create($data)->only(['id', 'name']), 'Category added', 201);
    }

    public function suppliers(Clinic $clinic)
    {
        return $this->ok($clinic->suppliers()->orderBy('name')->get(['id', 'name', 'contact_person', 'phone', 'email']));
    }

    public function storeSupplier(Request $request, Clinic $clinic)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('suppliers')->where('clinic_id', $clinic->id)],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
        ]);

        return $this->ok($clinic->suppliers()->create($data)->only(['id', 'name', 'contact_person', 'phone', 'email']), 'Supplier added', 201);
    }

    private function itemRules(Clinic $clinic, bool $creating): array
    {
        $need = $creating ? 'required' : 'sometimes';

        return [
            'name' => [$need, 'string', 'max:255'],
            'description' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'unit' => [$need, 'string', 'max:30'],
            'minimum_stock' => ['sometimes', 'integer', 'min:0', 'max:1000000'],
            'category_id' => ['sometimes', 'nullable', 'integer', Rule::exists('inventory_categories', 'id')->where('clinic_id', $clinic->id)],
            'branch_id' => ['sometimes', 'nullable', 'integer', Rule::exists('clinic_branches', 'id')->where('clinic_id', $clinic->id)],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
