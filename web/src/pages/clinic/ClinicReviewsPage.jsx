import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinic } from '../../layouts/ClinicLayout';
import { Badge, Field, FormError, Modal, Section } from '../../components/portal/PortalUi';
import StarRating from '../../components/StarRating';
import Pagination from '../../components/Pagination';
import { QueryState } from '../../components/StatusMessage';
import { getClinicReviews, reportReview } from '../../services/clinicPortalApi';
import { toReview } from '../../services/adapters';

// Clinics see all their reviews and can report inappropriate ones to the
// platform moderators; they cannot edit or delete reviews.
function Reviews() {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [reporting, setReporting] = useState(null);
  const [reason, setReason] = useState('');
  const query = useQuery({ queryKey: ['clinic', clinicId, 'reviews', page], queryFn: () => getClinicReviews(clinicId, { page }) });
  const report = useMutation({
    mutationFn: () => reportReview(clinicId, reporting.id, reason.trim()),
    onSuccess: () => {
      setReporting(null);
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'reviews'] });
    },
  });

  return (
    <Section title="Patient reviews" subtitle="Published reviews appear on your clinic page.">
      <QueryState query={query} loadingLabel="Loading reviews…">
        {({ items, meta }) => (
          <>
            {items.length === 0 ? (
              <p className="portal-empty">No reviews yet.</p>
            ) : (
              <ul className="portal-list">
                {items.map(toReview).map((review) => (
                  <li key={review.id} className="portal-list-item">
                    <div className="portal-section-header">
                      <div>
                        <StarRating rating={review.rating} size={14} /> <Badge status={review.status}>{review.status === 'approved' ? 'published' : review.status === 'rejected' ? 'hidden' : review.status}</Badge>
                        <p className="portal-list-item-meta">
                          {review.patientName} · {review.date}
                        </p>
                      </div>
                      {review.status === 'approved' && (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setReporting(review)}>
                          Report
                        </button>
                      )}
                    </div>
                    {review.comment && <p>{review.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
            <Pagination currentPage={page} pageCount={meta.last_page ?? 1} onPageChange={setPage} label="Review pages" />
          </>
        )}
      </QueryState>

      {reporting && (
        <Modal title="Report review" onClose={() => setReporting(null)}>
          <form onSubmit={(e) => { e.preventDefault(); report.mutate(); }}>
            <Field label="Why should a moderator look at this?" as="textarea" required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
            <FormError error={report.error} />
            <div className="portal-form-actions">
              <button type="button" className="btn btn-outline" onClick={() => setReporting(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={!reason.trim() || report.isPending}>Send report</button>
            </div>
          </form>
        </Modal>
      )}
    </Section>
  );
}

function ClinicReviewsPage() {
  return (
    <ClinicLayout section="reviews" title="Reviews" requires={['feedback.view']}>
      <Reviews />
    </ClinicLayout>
  );
}

export default ClinicReviewsPage;
