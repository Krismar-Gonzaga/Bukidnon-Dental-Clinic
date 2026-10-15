<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\ReviewResource;
use App\Models\Review;
use App\Models\ReviewReport;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Moderation keeps the review (and the reports) — it only changes whether
 * the review is published, with a note and the moderator recorded.
 */
class ReviewModerationController extends Controller
{
    public function __construct(private readonly AuditLogger $audit)
    {
    }

    /** Reviews with open reports first. */
    public function index(Request $request)
    {
        $page = Review::query()
            ->when(! $request->boolean('all'), fn ($q) => $q->whereHas('reports', fn ($r) => $r->where('status', ReviewReport::STATUS_OPEN)))
            ->with(['clinic', 'patient.user', 'reports' => fn ($q) => $q->where('status', ReviewReport::STATUS_OPEN)])
            ->latest()
            ->paginate($this->perPage($request, 20));

        return $this->paginated($page, fn (Review $r) => [
            ...(new ReviewResource($r))->moderatorView()->resolve(),
            'reports' => $r->reports->map(fn ($rep) => ['id' => $rep->id, 'reason' => $rep->reason]),
        ]);
    }

    public function moderate(Request $request, Review $review)
    {
        $data = $request->validate([
            'status' => ['required', 'in:approved,rejected'],
            'note' => ['required', 'string', 'max:1000'],
        ]);

        DB::transaction(function () use ($review, $data, $request) {
            $review->status = $data['status'];
            $review->moderation_note = $data['note'];
            $review->moderated_by = $request->user()->id;
            $review->moderated_at = now();
            $review->save();

            $review->reports()->where('status', ReviewReport::STATUS_OPEN)->update([
                'status' => ReviewReport::STATUS_RESOLVED,
                'resolved_by' => $request->user()->id,
                'resolved_at' => now(),
            ]);

            $review->clinic->refreshRating();
        });

        $this->audit->record('review.moderated', $review, ['status' => $data['status']], $review->clinic_id);

        return $this->ok((new ReviewResource($review->load(['clinic', 'patient.user'])))->moderatorView()->resolve(), 'Review moderated');
    }
}
