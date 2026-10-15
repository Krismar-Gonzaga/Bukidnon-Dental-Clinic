<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\DentistResource;
use App\Models\Clinic;
use App\Models\ClinicMembership;
use App\Models\Dentist;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Public dentist directory: active dentists with an active membership in at
 * least one publicly listed clinic. Filters: search (name), specialization_id,
 * clinic_id, city.
 */
class PublicDentistController extends Controller
{
    public function index(Request $request)
    {
        $data = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'specialization_id' => ['nullable', 'integer'],
            'clinic_id' => ['nullable', 'integer'],
            'city' => ['nullable', 'string', 'max:100'],
        ]);

        $listedClinicIds = Clinic::publiclyListed()
            ->when($data['clinic_id'] ?? null, fn ($q, $id) => $q->whereKey($id))
            ->when($data['city'] ?? null, fn ($q, $city) => $q->where('city', $city))
            ->pluck('id');

        $page = Dentist::query()
            ->where('is_active', true)
            ->whereHas('user', fn (Builder $user) => $user
                ->where('status', User::STATUS_ACTIVE)
                ->when($data['search'] ?? null, fn ($q, $term) => $q->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($term).'%']))
                ->whereHas('clinicMemberships', fn ($m) => $m
                    ->whereIn('clinic_id', $listedClinicIds)
                    ->where('role', ClinicMembership::ROLE_DENTIST)
                    ->where('status', ClinicMembership::STATUS_ACTIVE)))
            ->when($data['specialization_id'] ?? null, fn ($q, $id) => $q->where('specialization_id', $id))
            ->with(['user.clinicMemberships' => fn ($m) => $m
                ->whereIn('clinic_id', $listedClinicIds)
                ->where('role', ClinicMembership::ROLE_DENTIST)
                ->where('status', ClinicMembership::STATUS_ACTIVE)
                ->with('clinic:id,name,city'), 'specialization'])
            ->orderByDesc('years_experience')
            ->paginate($this->perPage($request, 12));

        return $this->paginated($page, fn (Dentist $dentist) => [
            ...(new DentistResource($dentist))->resolve(),
            'clinics' => $dentist->user->clinicMemberships->map(fn ($m) => [
                'id' => $m->clinic->id,
                'name' => $m->clinic->name,
                'city' => $m->clinic->city,
            ])->values(),
        ]);
    }
}
