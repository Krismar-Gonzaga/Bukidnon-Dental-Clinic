<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ClinicSummaryResource;
use App\Models\Clinic;
use App\Services\AuditLogger;
use Illuminate\Http\Request;

/**
 * Platform oversight of clinics. Deliberately no access to a clinic's
 * patients, appointments or records from here.
 */
class ClinicController extends Controller
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function index(Request $request)
    {
        $request->validate(['status' => ['nullable', 'in:pending,approved,suspended'], 'search' => ['nullable', 'string', 'max:100']]);

        $page = Clinic::query()
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->when($request->filled('search'), fn ($q) => $q->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($request->search).'%']))
            ->withCount(['memberships', 'branches'])
            ->orderBy('name')
            ->paginate($this->perPage($request, 20));

        return $this->paginated($page, fn (Clinic $c) => [
            ...(new ClinicSummaryResource($c))->resolve(),
            'status' => $c->status,
            'is_published' => $c->is_published,
            'members_count' => $c->memberships_count,
            'branches_count' => $c->branches_count,
            'suspension_reason' => $c->suspension_reason,
        ]);
    }

    /** Hides the clinic from the directory and blocks new bookings. */
    public function suspend(Request $request, Clinic $clinic)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);

        $clinic->forceFill([
            'status' => Clinic::STATUS_SUSPENDED,
            'suspension_reason' => $data['reason'],
            'suspended_at' => now(),
        ])->save();

        $this->audit->record('clinic.suspended', $clinic, ['reason' => $data['reason']], $clinic->id);

        return $this->ok(['status' => $clinic->status], 'Clinic suspended');
    }

    public function reactivate(Clinic $clinic)
    {
        if ($clinic->status !== Clinic::STATUS_SUSPENDED) {
            return $this->fail('Only suspended clinics can be reactivated.', 409);
        }

        $clinic->forceFill(['status' => Clinic::STATUS_APPROVED, 'suspension_reason' => null, 'suspended_at' => null])->save();
        $this->audit->record('clinic.reactivated', $clinic, clinicId: $clinic->id);

        return $this->ok(['status' => $clinic->status], 'Clinic reactivated');
    }
}
