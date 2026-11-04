<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\DentistResource;
use App\Models\Clinic;
use App\Models\ClinicMembership;
use App\Models\Dentist;
use App\Models\User;
use App\Support\DentistRatings;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

/**
 * Public dentist directory: active dentists with an active membership in at
 * least one publicly listed clinic. Filters: search (name), specialization_id,
 * clinic_id, city. A dentist is available when they have weekly hours (without
 * them patients cannot book).
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

        $page = $this->listed($listedClinicIds, $data['search'] ?? null)
            ->when($data['specialization_id'] ?? null, fn ($q, $id) => $q->where('specialization_id', $id))
            ->withCount('schedules')
            ->orderByDesc('years_experience')
            ->paginate($this->perPage($request, 12));

        $ratings = DentistRatings::for(collect($page->items())->pluck('id'));

        return $this->paginated($page, fn (Dentist $dentist) => [
            ...(new DentistResource($dentist))->resolve(),
            ...DentistRatings::fields($ratings, $dentist->id),
            'is_available' => $dentist->schedules_count > 0,
            'clinics' => $this->clinicsOf($dentist),
        ]);
    }

    /** One dentist's public profile, or 404 if they are not publicly listed. */
    public function show(int $id)
    {
        $listedClinicIds = Clinic::publiclyListed()->pluck('id');
        $dentist = $this->listed($listedClinicIds)
            ->with(['schedules' => fn ($q) => $q->whereHas('branch', fn ($b) => $b->whereIn('clinic_id', $listedClinicIds))])
            ->findOrFail($id);
        $ratings = DentistRatings::for(collect([$dentist->id]));

        return $this->ok([
            ...(new DentistResource($dentist))->resolve(),
            ...DentistRatings::fields($ratings, $dentist->id),
            'is_available' => $dentist->schedules->isNotEmpty(),
            'clinics' => $this->clinicsOf($dentist),
        ]);
    }

    private function listed(Collection $listedClinicIds, ?string $search = null): Builder
    {
        return Dentist::query()
            ->where('is_active', true)
            ->whereHas('user', fn (Builder $user) => $user
                ->where('status', User::STATUS_ACTIVE)
                ->when($search, fn ($q, $term) => $q->whereRaw('LOWER(name) LIKE ?', ['%'.mb_strtolower($term).'%']))
                ->whereHas('clinicMemberships', fn ($m) => $m
                    ->whereIn('clinic_id', $listedClinicIds)
                    ->where('role', ClinicMembership::ROLE_DENTIST)
                    ->where('status', ClinicMembership::STATUS_ACTIVE)))
            ->with(['user.clinicMemberships' => fn ($m) => $m
                ->whereIn('clinic_id', $listedClinicIds)
                ->where('role', ClinicMembership::ROLE_DENTIST)
                ->where('status', ClinicMembership::STATUS_ACTIVE)
                ->with('clinic:id,name,address,city,province'), 'specialization']);
    }

    private function clinicsOf(Dentist $dentist): Collection
    {
        return $dentist->user->clinicMemberships->map(fn ($m) => [
            'id' => $m->clinic->id,
            'name' => $m->clinic->name,
            'city' => $m->clinic->city,
            'address' => $m->clinic->full_address,
        ])->values();
    }
}
