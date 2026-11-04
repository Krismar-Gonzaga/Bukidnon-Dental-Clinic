<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Review;
use App\Models\ReviewReport;
use App\Services\AuditLogger;
use Illuminate\Http\Request;

/** Any signed-in user can flag a published review for moderation. */
class ReviewReportController extends Controller
{
    public function __invoke(Request $request, int $reviewId, AuditLogger $audit)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:500']]);
        $review = Review::where('status', Review::STATUS_APPROVED)->findOrFail($reviewId);

        $report = ReviewReport::firstOrNew(['review_id' => $review->id, 'reported_by' => $request->user()->id]);
        $report->review_id = $review->id;
        $report->reported_by = $request->user()->id;
        $report->reason = $data['reason'];
        $report->status = ReviewReport::STATUS_OPEN;
        $report->save();

        $audit->record('review.reported', $review, clinicId: $review->clinic_id);

        return $this->ok(message: 'Thanks — a moderator will review this.', status: 201);
    }
}
