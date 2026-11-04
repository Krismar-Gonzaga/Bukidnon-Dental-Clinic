<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Http\Resources\ServiceRateResource;
use App\Models\Clinic;
use App\Models\Service;
use App\Models\ServiceRate;
use App\Services\AuditLogger;
use Illuminate\Http\Request;

/** The clinic's priced services. Deactivate instead of deleting, to keep history. */
class ServiceController extends Controller
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function index(Clinic $clinic)
    {
        return $this->ok(ServiceRateResource::collection($clinic->serviceRates()->whereNull('archived_at')->with('service')->orderBy('service_name')->get())->resolve());
    }

    public function store(Request $request, Clinic $clinic)
    {
        $data = $request->validate($this->rules(true));

        $rate = new ServiceRate([...$data, 'service_name' => $data['name'], 'currency' => 'PHP']);
        $rate->clinic_id = $clinic->id;
        $rate->save();

        $this->audit->record('service.created', $rate, ['price' => $rate->price], $clinic->id);

        return $this->ok((new ServiceRateResource($rate->load('service')))->resolve(), 'Service added', 201);
    }

    public function update(Request $request, Clinic $clinic, ServiceRate $serviceRate)
    {
        $data = $request->validate($this->rules(false));
        if (isset($data['name'])) {
            $data['service_name'] = $data['name'];
        }

        $serviceRate->update($data);
        $this->audit->record('service.updated', $serviceRate, ['fields' => array_keys($data)], $clinic->id);

        return $this->ok((new ServiceRateResource($serviceRate->load('service')))->resolve(), 'Service updated');
    }

    /** Past appointments still point at the service, so it is hidden rather than deleted. */
    public function destroy(Clinic $clinic, ServiceRate $serviceRate)
    {
        $serviceRate->forceFill(['is_available' => false, 'archived_at' => now()])->save();
        $this->audit->record('service.removed', $serviceRate, clinicId: $clinic->id);

        return $this->ok(message: 'Service removed');
    }

    private function rules(bool $creating): array
    {
        $need = $creating ? 'required' : 'sometimes';

        return [
            'service_id' => [$need, 'integer', 'exists:'.Service::class.',id'],
            'name' => [$need, 'string', 'max:255'],
            'description' => [$creating ? 'required' : 'sometimes', 'string', 'max:2000'],
            'price' => [$need, 'numeric', 'min:0', 'max:9999999.99', 'decimal:0,2'],
            'duration_minutes' => [$need, 'integer', 'min:5', 'max:480'],
            'price_max' => ['sometimes', 'nullable', 'numeric', 'gte:price', 'max:9999999.99'],
            'duration_max' => ['sometimes', 'nullable', 'integer', 'gte:duration_minutes', 'max:480'],
            'is_available' => ['sometimes', 'boolean'],
        ];
    }
}
