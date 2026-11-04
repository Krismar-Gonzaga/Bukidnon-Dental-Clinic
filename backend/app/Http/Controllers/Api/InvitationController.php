<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClinicMembership;
use App\Services\AuditLogger;
use Illuminate\Http\Request;

/** Clinic invitations addressed to the signed-in user. */
class InvitationController extends Controller
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function index(Request $request)
    {
        $invitations = $request->user()->clinicMemberships()
            ->where('status', ClinicMembership::STATUS_INVITED)
            ->with('clinic:id,name,city')
            ->get()
            ->map(fn ($m) => [
                'id' => $m->id,
                'clinic' => ['id' => $m->clinic->id, 'name' => $m->clinic->name, 'city' => $m->clinic->city],
                'role' => $m->role,
            ]);

        return $this->ok($invitations);
    }

    public function accept(Request $request, int $id)
    {
        $membership = $this->invitation($request, $id);
        $membership->update(['status' => ClinicMembership::STATUS_ACTIVE]);
        $this->audit->record('membership.accepted', $membership, clinicId: $membership->clinic_id);

        return $this->ok(message: 'Invitation accepted');
    }

    public function decline(Request $request, int $id)
    {
        $membership = $this->invitation($request, $id);
        $this->audit->record('membership.declined', $membership, clinicId: $membership->clinic_id);
        $membership->delete();

        return $this->ok(message: 'Invitation declined');
    }

    private function invitation(Request $request, int $id): ClinicMembership
    {
        return $request->user()->clinicMemberships()
            ->where('status', ClinicMembership::STATUS_INVITED)
            ->findOrFail($id);
    }
}
