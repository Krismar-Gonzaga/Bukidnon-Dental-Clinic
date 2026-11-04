<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AppointmentResource;
use App\Http\Resources\ReviewResource;
use App\Models\Appointment;
use App\Models\Review;
use App\Services\AuditLogger;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/**
 * A patient may review a clinic once per completed appointment of their own.
 * Reviews are published immediately; reported reviews are moderated by a
 * system administrator.
 */
class PatientReviewController extends Controller
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    /** Completed appointments still waiting for a review. */
    public function eligible(Request $request)
    {
        $patient = $this->patient($request);

        $appointments = Appointment::where('patient_id', $patient->id)
            ->where('status', Appointment::COMPLETED)
            ->whereDoesntHave('review')
            ->with(['clinic', 'dentist.user', 'serviceRate'])
            ->orderByDesc('starts_at')
            ->get();

        return $this->ok($appointments->map(fn ($a) => (new AppointmentResource($a))->resolve()));
    }

    public function index(Request $request)
    {
        $patient = $this->patient($request);

        return $this->ok(
            Review::where('patient_id', $patient->id)->with(['clinic', 'patient.user'])->latest()->get()
                ->map(fn ($r) => (new ReviewResource($r))->resolve())
        );
    }

    public function store(Request $request, int $appointmentId)
    {
        $data = $request->validate([
            'rating' => ['required', 'integer', 'between:1,5'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $patient = $this->patient($request);
        $appointment = Appointment::where('patient_id', $patient->id)->findOrFail($appointmentId);

        if ($appointment->status !== Appointment::COMPLETED) {
            throw new ConflictHttpException('You can review a clinic after your appointment is completed.');
        }

        try {
            $review = DB::transaction(function () use ($appointment, $patient, $data) {
                $review = new Review($data);
                $review->clinic_id = $appointment->clinic_id;
                $review->patient_id = $patient->id;
                $review->appointment_id = $appointment->id;
                $review->is_verified_purchase = true;
                $review->status = Review::STATUS_APPROVED;
                $review->save();

                $appointment->clinic->refreshRating();

                return $review;
            });
        } catch (QueryException) {
            // unique(appointment_id): the appointment was already reviewed.
            throw new ConflictHttpException('You already reviewed this appointment.');
        }

        $this->audit->record('review.created', $review, clinicId: $review->clinic_id);

        return $this->ok((new ReviewResource($review->load(['clinic', 'patient.user'])))->resolve(), 'Thank you for your feedback', 201);
    }

    private function patient(Request $request)
    {
        return $request->user()->patient ?? throw new AccessDeniedHttpException('Only patient accounts can leave reviews.');
    }
}
