import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import { Badge, Checkbox, Field, FormError, Modal, Section } from '../../components/portal/PortalUi';
import StarRating from '../../components/StarRating';
import Pagination from '../../components/Pagination';
import { QueryState } from '../../components/StatusMessage';
import { ADMIN_REVIEWS_HREF } from '../../config/adminNavigation';
import { getModerationQueue, moderateReview } from '../../services/adminApi';

// Moderation keeps the review and its reports; it only publishes or hides it.
function AdminReviewsPage() {
  const queryClient = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(1);
  const [moderating, setModerating] = useState(null);
  const [note, setNote] = useState('');
  const query = useQuery({
    queryKey: ['admin', 'reviews', showAll, page],
    queryFn: () => getModerationQueue({ all: showAll ? 1 : undefined, page }),
  });
  const decide = useMutation({
    mutationFn: (status) => moderateReview(moderating.id, status, note.trim()),
    onSuccess: () => {
      setModerating(null);
      setNote('');
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });

  return (
    <AdminLayout title="Review Moderation" activeHref={ADMIN_REVIEWS_HREF}>
      <Section
        title={showAll ? 'All reviews' : 'Reported reviews'}
        actions={<Checkbox label="Show all reviews" checked={showAll} onChange={(e) => { setShowAll(e.target.checked); setPage(1); }} />}
      >
        <QueryState query={query} loadingLabel="Loading reviews…">
          {({ items, meta }) => (
            <>
              {items.length === 0 ? (
                <p className="portal-empty">{showAll ? 'No reviews.' : 'No open reports.'}</p>
              ) : (
                <ul className="portal-list">
                  {items.map((review) => (
                    <li key={review.id} className="portal-list-item">
                      <div className="portal-section-header">
                        <div>
                          <StarRating rating={review.rating} size={14} /> <strong>{review.clinic_name}</strong>{' '}
                          <Badge status={review.status}>{review.status === 'approved' ? 'published' : review.status === 'rejected' ? 'hidden' : review.status}</Badge>
                          {review.open_reports > 0 && <> <Badge tone="warning">{review.open_reports} open report(s)</Badge></>}
                          <p className="portal-list-item-meta">{review.patient_name} · {review.date}</p>
                        </div>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setModerating(review)}>Moderate</button>
                      </div>
                      {review.comment && <p>{review.comment}</p>}
                      {review.reports?.length > 0 && (
                        <ul className="portal-list-item-meta">
                          {review.reports.map((r) => <li key={r.id}>Reported: {r.reason}</li>)}
                        </ul>
                      )}
                      {review.moderation_note && <p className="portal-list-item-meta">Moderator note: {review.moderation_note}</p>}
                    </li>
                  ))}
                </ul>
              )}
              <Pagination currentPage={page} pageCount={meta.last_page ?? 1} onPageChange={setPage} label="Review pages" />
            </>
          )}
        </QueryState>
      </Section>

      {moderating && (
        <Modal title="Moderate review" onClose={() => setModerating(null)}>
          <p>{moderating.comment || 'No comment.'}</p>
          <Field label="Moderator note (recorded)" as="textarea" required className="portal-spaced-top" value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
          <FormError error={decide.error} />
          <div className="portal-form-actions">
            <button type="button" className="btn btn-outline" disabled={!note.trim() || decide.isPending} onClick={() => decide.mutate('rejected')}>Hide review</button>
            <button type="button" className="btn btn-primary" disabled={!note.trim() || decide.isPending} onClick={() => decide.mutate('approved')}>Keep published</button>
          </div>
        </Modal>
      )}
    </AdminLayout>
  );
}

export default AdminReviewsPage;
