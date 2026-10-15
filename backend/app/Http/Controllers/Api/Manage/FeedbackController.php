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
            ->with('patient.user')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->status))
            ->latest()
            ->paginate($this->perPage($request, 20));

        return $this->paginated($page, fn ($r) => (new ReviewResource($r))->resolve());
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
