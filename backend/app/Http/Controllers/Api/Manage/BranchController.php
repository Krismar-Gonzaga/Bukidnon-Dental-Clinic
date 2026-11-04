<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Http\Resources\BranchResource;
use App\Models\Clinic;
use App\Models\ClinicBranch;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BranchController extends Controller
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function index(Clinic $clinic)
    {
        return $this->ok(BranchResource::collection($clinic->branches()->with('operatingHours')->orderByDesc('is_main')->orderBy('name')->get())->resolve());
    }

    public function store(Request $request, Clinic $clinic)
    {
        $branch = new ClinicBranch($request->validate($this->rules(true)));
        $branch->clinic_id = $clinic->id;
        $branch->is_main = ! $clinic->branches()->exists();
        $branch->save();

        $this->audit->record('branch.created', $branch, clinicId: $clinic->id);

        return $this->ok((new BranchResource($branch->load('operatingHours')))->resolve(), 'Branch added', 201);
    }

    public function update(Request $request, Clinic $clinic, ClinicBranch $branch)
    {
        $branch->update($request->validate($this->rules(false)));
        $this->audit->record('branch.updated', $branch, clinicId: $clinic->id);

        return $this->ok((new BranchResource($branch->load('operatingHours')))->resolve(), 'Branch updated');
    }

    /**
     * Replace the weekly hours. Days not listed are closed.
     * Body: { hours: [{ day_of_week: 1, opens_at: "08:00", closes_at: "17:00" }, ...] }
     */
    /** Past appointments still point at the branch, so it is closed rather than deleted. */
    public function destroy(Clinic $clinic, ClinicBranch $branch)
    {
        if ($branch->is_main) {
            return $this->fail('The main branch cannot be removed.', 409);
        }
        if ($clinic->appointments()->where('branch_id', $branch->id)->active()->where('starts_at', '>=', now())->exists()) {
            return $this->fail('This branch still has upcoming appointments. Move or cancel them first.', 409);
        }

        $branch->forceFill(['is_active' => false])->save();
        $this->audit->record('branch.removed', $branch, clinicId: $clinic->id);

        return $this->ok(message: 'Branch removed');
    }

    public function updateHours(Request $request, Clinic $clinic, ClinicBranch $branch)
    {
        $data = $request->validate([
            'hours' => ['present', 'array', 'max:7'],
            'hours.*.day_of_week' => ['required', 'integer', 'between:0,6', 'distinct'],
            'hours.*.opens_at' => ['required', 'date_format:H:i'],
            'hours.*.closes_at' => ['required', 'date_format:H:i', 'after:hours.*.opens_at'],
        ]);

        DB::transaction(function () use ($branch, $data) {
            $branch->operatingHours()->delete();
            foreach ($data['hours'] as $day) {
                $branch->operatingHours()->create($day);
            }
        });

        $this->audit->record('branch.hours_updated', $branch, clinicId: $clinic->id);

        return $this->ok((new BranchResource($branch->load('operatingHours')))->resolve(), 'Operating hours saved');
    }

    private function rules(bool $creating): array
    {
        $need = $creating ? 'required' : 'sometimes';

        return [
            'name' => [$need, 'string', 'max:255'],
            'address' => [$need, 'string', 'max:255'],
            'city' => [$need, 'string', 'max:100'],
            'province' => ['sometimes', 'string', 'max:100'],
            'contact_number' => ['sometimes', 'nullable', 'string', 'max:30'],
            'latitude' => ['sometimes', 'nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'nullable', 'numeric', 'between:-180,180'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
