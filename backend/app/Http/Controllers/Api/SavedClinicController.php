<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ClinicSummaryResource;
use App\Models\Clinic;
use App\Models\Review;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

/** A patient's bookmarked clinics. Only publicly listed clinics are shown. */
class SavedClinicController extends Controller
{
    public function index(Request $request)
    {
        $clinics = $this->patient($request)->savedClinics()
            ->publiclyListed()
            ->with('specializations')
            ->withCount(['reviews' => fn ($q) => $q->where('status', Review::STATUS_APPROVED)])
            ->orderByPivot('created_at', 'desc')
            ->get();

        return $this->ok($clinics->map(fn ($c) => (new ClinicSummaryResource($c))->resolve()));
    }

    public function store(Request $request, int $clinicId)
    {
        $clinic = Clinic::publiclyListed()->findOrFail($clinicId);
        $this->patient($request)->savedClinics()->syncWithoutDetaching([$clinic->id]);

        return $this->ok(['clinic_id' => $clinic->id, 'saved' => true], 'Clinic saved');
    }

    public function destroy(Request $request, int $clinicId)
    {
        $this->patient($request)->savedClinics()->detach($clinicId);

        return $this->ok(['clinic_id' => $clinicId, 'saved' => false], 'Clinic removed from saved');
    }

    private function patient(Request $request)
    {
        return $request->user()->patient ?? throw new AccessDeniedHttpException('Only patient accounts can save clinics.');
    }
}
