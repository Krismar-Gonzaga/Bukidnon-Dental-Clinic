<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AppointmentResource;
use App\Models\Appointment;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;

class PatientDashboardController extends Controller
{
    public function __invoke(Request $request)
    {
        $user = $request->user();
        $patient = $user->patient ?? throw new AccessDeniedHttpException('Only patient accounts have a patient dashboard.');
        $mine = fn () => Appointment::where('patient_id', $patient->id);

        return $this->ok([
            'name' => $user->name,
            'upcoming' => $mine()->active()->where('starts_at', '>=', now())
                ->with(['clinic', 'branch', 'dentist.user', 'serviceRate'])
                ->orderBy('starts_at')->limit(3)->get()
                ->map(fn ($a) => (new AppointmentResource($a))->resolve()),
            'counts' => [
                'upcoming' => $mine()->active()->where('starts_at', '>=', now())->count(),
                'pending' => $mine()->whereIn('status', [Appointment::PENDING, Appointment::RESCHEDULE_REQUESTED])->count(),
                'completed' => $mine()->where('status', Appointment::COMPLETED)->count(),
                'awaiting_review' => $mine()->where('status', Appointment::COMPLETED)->whereDoesntHave('review')->count(),
            ],
            'unread_notifications' => $user->unreadNotifications()->count(),
        ]);
    }
}
