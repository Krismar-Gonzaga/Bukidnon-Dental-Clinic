<?php

namespace App\Http\Controllers\Api\Manage;

use App\Http\Controllers\Controller;
use App\Http\Resources\ReviewResource;
use App\Models\Clinic;
use App\Models\Review;
use App\Models\ReviewReport;
use App\Services\AuditLogger;
use Illuminate\Http\Request;

/** Reviews of this clinic. The clinic can report, not edit or delete, a review. */
class FeedbackController extends Controller
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    public function index(Request $request, Clinic $clinic)
    {
        $page = $clinic->reviews()
            ->with(['patient.user', 'appointment.serviceRate', 'appointment.dentist.user'])
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->latest()
            ->paginate($this->perPage($request, 20));

        $counts = $clinic->reviews()->toBase()->selectRaw('rating, COUNT(*) AS total')->groupBy('rating')->pluck('total', 'rating');
        $total = (int) $counts->sum();

        return $this->ok(
            collect($page->items())->map(fn ($r) => (new ReviewResource($r))->clinicView()->resolve()),
            meta: [
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'per_page' => $page->perPage(),
                'total' => $page->total(),
                'summary' => [
                    'count' => $total,
                    'average' => $total ? round($counts->map(fn ($n, $rating) => $n * $rating)->sum() / $total, 1) : null,
                    'breakdown' => collect([5, 4, 3, 2, 1])->mapWithKeys(fn ($rating) => [$rating => (int) ($counts[$rating] ?? 0)]),
                ],
            ],
        );
    }

    /** The clinic's public answer to a review. A new reply replaces the earlier one. */
    public function reply(Request $request, Clinic $clinic, Review $review)
    {
        $data = $request->validate(['reply' => ['required', 'string', 'max:1000']]);

        $review->forceFill([
            'clinic_reply' => $data['reply'],
            'clinic_replied_at' => now(),
            'clinic_replied_by' => $request->user()->id,
        ])->save();
        $this->audit->record('review.replied', $review, clinicId: $clinic->id);

        return $this->ok((new ReviewResource($review->load(['patient.user', 'appointment.serviceRate', 'appointment.dentist.user'])))->clinicView()->resolve(), 'Reply posted');
    }

    public function report(Request $request, Clinic $clinic, Review $review)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);

        $report = ReviewReport::firstOrNew(['review_id' => $review->id, 'reported_by' => $request->user()->id]);
        $report->review_id = $review->id;
        $report->reported_by = $request->user()->id;
        $report->reason = $data['reason'];
        $report->status = ReviewReport::STATUS_OPEN;
        $report->save();

        $this->audit->record('review.reported', $review, clinicId: $clinic->id);

        return $this->ok(message: 'Review reported for moderation', status: 201);
    }
}
