import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { Card } from '../../components/clinic/ClinicAdminUi';
import { InitialsTile, Pill } from '../../components/clinic/ClinicUi';
import { Field, FormError, Modal } from '../../components/portal/PortalUi';
import StarRating from '../../components/StarRating';
import Pagination from '../../components/Pagination';
import { QueryState } from '../../components/StatusMessage';
import { getClinicReviews, replyToReview, reportReview } from '../../services/clinicPortalApi';
import { toReview } from '../../services/adapters';
import '../../components/clinic/ClinicAdminUi.css';

const REPORT_REASONS = ['Spam or fake review', 'Offensive or abusive language', 'Not about this clinic', 'Contains private information', 'Other'].map((value) => ({ value, label: value }));

function OverallRating({ summary }) {
  const count = summary?.count ?? 0;
  const average = summary?.average ?? 0;
  return (
    <Card title="Overall Rating">
      <div className="clinic-rating-top">
        <StarRating rating={Math.round(average)} size={16} />
        <span className="clinic-rating-value">{Number(average).toFixed(1)}</span>
      </div>
      <p className="clinic-rating-count">
        {count} {count === 1 ? 'review' : 'reviews'}
      </p>
      <div className="clinic-rating-bars">
        {[5, 4, 3, 2, 1].map((stars) => {
          const total = summary?.breakdown?.[stars] ?? 0;
          return (
            <div key={stars} className="clinic-rating-bar">
              <span>{stars}</span>
              <Icon name="star" size={14} />
              <span className="clinic-rating-track">
                <span className="clinic-rating-fill" style={{ width: count > 0 ? `${(total / count) * 100}%` : 0 }} />
              </span>
              <span>{total}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ReviewCard({ review, canRespond, onReport }) {
  const { clinicId } = useClinicAccess();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState(null);
  const reply = useMutation({
    mutationFn: () => replyToReview(clinicId, review.id, draft.trim()),
    onSuccess: () => {
      setDraft(null);
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'reviews'] });
    },
  });
  const isPublished = review.status === 'approved';

  return (
    <li>
      <Card>
        <div className="clinic-review-head">
          <InitialsTile name={review.patientName} size="sm" tone="navy" />
          <div className="clinic-review-who">
            <p className="clinic-review-name">{review.patientName}</p>
            <p className="clinic-review-meta">{[review.service, review.dentist].filter(Boolean).join(' · ')}</p>
            <StarRating rating={review.rating} size={14} />
          </div>
          <div className="clinic-review-side">
            <span>{review.date}</span>
            {!isPublished && <Pill tone="neutral">{review.status === 'rejected' ? 'Hidden' : 'Pending'}</Pill>}
            {isPublished && (
              <button type="button" className="clinic-mini-button" onClick={onReport}>
                Report
              </button>
            )}
          </div>
        </div>
        {review.comment && <p className="clinic-review-text">{review.comment}</p>}

        {review.clinicReply && (
          <div className="clinic-review-response">
            <strong>Clinic Response</strong>
            {review.clinicReply}
          </div>
        )}

        {canRespond &&
          isPublished &&
          !review.clinicReply &&
          (draft === null ? (
            <div className="clinic-review-reply">
              <button type="button" className="clinic-link-button" onClick={() => setDraft('')}>
                <Icon name="messageSquare" size={16} />
                Reply to this review
              </button>
            </div>
          ) : (
            <form
              className="clinic-reply-form"
              onSubmit={(event) => {
                event.preventDefault();
                reply.mutate();
              }}
            >
              <label className="visually-hidden" htmlFor={`reply-${review.id}`}>
                Your reply to {review.patientName}
              </label>
              <textarea id={`reply-${review.id}`} placeholder="Write your reply…" maxLength={1000} required value={draft} onChange={(event) => setDraft(event.target.value)} />
              <FormError error={reply.error} />
              <div className="clinic-reply-actions">
                <button type="submit" className="btn btn-primary btn-sm" disabled={!draft.trim() || reply.isPending}>
                  {reply.isPending ? 'Posting…' : 'Post Reply'}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setDraft(null)}>
                  Cancel
                </button>
              </div>
            </form>
          ))}
      </Card>
    </li>
  );
}

// Clinics see all their reviews, can answer them, and can report inappropriate
// ones to the platform moderators; they cannot edit or delete reviews.
function ClinicReviewsPage() {
  const { clinicId, can } = useClinicAccess();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [reporting, setReporting] = useState(null);
  const [reason, setReason] = useState('');
  const query = useQuery({ queryKey: ['clinic', clinicId, 'reviews', page], queryFn: () => getClinicReviews(clinicId, { page }), enabled: can('feedback.view') });
  const report = useMutation({
    mutationFn: () => reportReview(clinicId, reporting.id, reason),
    onSuccess: () => {
      setReporting(null);
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'reviews'] });
    },
  });
  const count = query.data?.meta?.summary?.count;

  return (
    <ClinicLayout
      section="reviews"
      title="Reviews & Feedback"
      subtitle={count == null ? 'Loading reviews…' : `${count} patient ${count === 1 ? 'review' : 'reviews'}`}
      requires={['feedback.view']}
      hideSearch
    >
      <QueryState query={query} loadingLabel="Loading reviews…">
        {({ items, meta }) => (
          <div className="clinic-reviews">
            <OverallRating summary={meta.summary} />
            <div>
              {items.length === 0 ? (
                <Card>
                  <p className="portal-empty">No reviews yet.</p>
                </Card>
              ) : (
                <ul className="clinic-review-list">
                  {items.map(toReview).map((review) => (
                    <ReviewCard key={review.id} review={review} canRespond={can('feedback.respond')} onReport={() => setReporting(review)} />
                  ))}
                </ul>
              )}
              <Pagination currentPage={page} pageCount={meta.last_page ?? 1} onPageChange={setPage} label="Review pages" />
            </div>
          </div>
        )}
      </QueryState>

      {reporting && (
        <Modal title="Report Review" onClose={() => setReporting(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              report.mutate();
            }}
          >
            <p className="portal-confirm-message">Select the reason for reporting this review. Our moderation team will review it.</p>
            <Field label="Reason" as="select" required options={[{ value: '', label: 'Choose…' }, ...REPORT_REASONS]} value={reason} onChange={(event) => setReason(event.target.value)} />
            <FormError error={report.error} />
            <div className="clinic-form-actions">
              <button type="button" className="btn btn-outline" onClick={() => setReporting(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-danger" disabled={!reason || report.isPending}>
                {report.isPending ? 'Sending…' : 'Submit Report'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </ClinicLayout>
  );
}

export default ClinicReviewsPage;
