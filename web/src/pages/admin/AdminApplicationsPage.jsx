import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import Icon from '../../components/Icon';
import { TableFooter } from '../../components/admin/AdminData';
import { ActionDialog, StatusTag } from '../../components/admin/AdminUi';
import { useSensitiveAction } from '../../components/admin/AdminSecurity';
import { QueryState } from '../../components/StatusMessage';
import { ADMIN_APPLICATIONS_HREF, CLINIC_STATUS, VERIFICATION_DOCUMENT_LABELS, getAdminApplicationHref } from '../../config/adminNavigation';
import { approveApplication, getApplications, rejectApplication } from '../../services/adminApi';
import { formatShortDate } from '../../utils/dateTime';

const OPEN = ['pending', 'under_review'];
const PER_PAGE = 20;

const noteOf = (application) => {
  if (application.status === 'rejected') return application.review_notes;
  if (application.status === 'approved') return 'All documents verified.';
  if (application.missing_documents.length > 0) {
    return `${application.missing_documents.map((type) => VERIFICATION_DOCUMENT_LABELS[type] ?? type).join(', ')} missing.`;
  }
  return null;
};

const statusOf = (application) =>
  application.document_status === 'documents_requested' ? { label: 'More Documents Requested', tone: 'warning' } : CLINIC_STATUS[application.status] ?? CLINIC_STATUS.pending;

function VerificationRow({ application, onDecide }) {
  const status = statusOf(application);
  const note = noteOf(application);
  const href = getAdminApplicationHref(application.id);
  const isOpen = OPEN.includes(application.status);
  const missing = application.missing_documents.length > 0;

  return (
    <li className="admin-row">
      <span className="admin-row-icon" aria-hidden="true">
        <Icon name="shield" size={20} />
      </span>
      <div className="admin-row-body">
        <p className="admin-row-title">
          <a href={href}>{application.clinic_name}</a>
          <StatusTag tone={status.tone}>{status.label}</StatusTag>
        </p>
        <p className="admin-row-meta">
          {[
            `Admin: ${application.representative_name || application.applicant?.name || '—'}`,
            application.submitted_at && `Submitted: ${formatShortDate(application.submitted_at)}`,
            `Docs: ${application.documents_submitted}/${application.documents_required}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {note && <p className="admin-row-note">{note}</p>}
      </div>
      {isOpen && (
        <div className="admin-row-actions">
          <button
            type="button"
            className="admin-soft-button is-success"
            aria-label={`Approve ${application.clinic_name}`}
            disabled={missing}
            title={missing ? 'Required documents are missing' : undefined}
            onClick={() => onDecide('approve', application)}
          >
            Approve
          </button>
          <button type="button" className="admin-soft-button is-danger" aria-label={`Reject ${application.clinic_name}`} onClick={() => onDecide('reject', application)}>
            Reject
          </button>
        </div>
      )}
      <a href={href} className="admin-row-chevron" aria-label={`Review ${application.clinic_name}`}>
        <Icon name="chevronRight" size={18} />
      </a>
    </li>
  );
}

function VerificationList({ query, onPageChange }) {
  const queryClient = useQueryClient();
  const runSensitive = useSensitiveAction();
  const [deciding, setDeciding] = useState(null); // { kind, application }
  const decide = useMutation({
    mutationFn: (notes) =>
      runSensitive(() => (deciding.kind === 'approve' ? approveApplication(deciding.application.id) : rejectApplication(deciding.application.id, notes))),
    onSuccess: () => {
      setDeciding(null);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
  const isApprove = deciding?.kind === 'approve';

  return (
    <>
      <QueryState query={query} loadingLabel="Loading verification requests…">
        {({ items, meta }) => (
          <>
            {items.length === 0 ? (
              <p className="admin-empty-card">No verification requests yet.</p>
            ) : (
              <ul className="admin-rows is-roomy">
                {items.map((application) => (
                  <VerificationRow
                    key={application.id}
                    application={application}
                    onDecide={(kind, next) => {
                      decide.reset();
                      setDeciding({ kind, application: next });
                    }}
                  />
                ))}
              </ul>
            )}
            {(meta.last_page ?? 1) > 1 && <TableFooter meta={meta} perPage={PER_PAGE} onPageChange={onPageChange} noun="requests" label="Verification pages" />}
          </>
        )}
      </QueryState>

      {deciding && (
        <ActionDialog
          title={isApprove ? 'Approve Clinic' : 'Reject Clinic'}
          message={
            <>
              Are you sure you want to <strong>{isApprove ? 'approve' : 'reject'}</strong> {deciding.application.clinic_name}?
              {isApprove ? ' Their clinic and clinic admin access will be created.' : ' They can correct it and submit again.'}
            </>
          }
          reasonLabel={isApprove ? undefined : 'Reason (sent to the applicant)'}
          isBusy={decide.isPending}
          error={decide.error}
          onConfirm={(notes) => decide.mutate(notes)}
          onCancel={() => setDeciding(null)}
        />
      )}
    </>
  );
}

function AdminApplicationsPage() {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['admin', 'applications', page],
    queryFn: () => getApplications({ page, per_page: PER_PAGE }),
    placeholderData: keepPreviousData,
  });
  const total = query.data?.meta.total;

  return (
    <AdminLayout
      title="Clinic Verification"
      subtitle={total == null ? undefined : `${total} verification ${total === 1 ? 'request' : 'requests'}`}
      activeHref={ADMIN_APPLICATIONS_HREF}
    >
      <VerificationList query={query} onPageChange={setPage} />
    </AdminLayout>
  );
}

export default AdminApplicationsPage;
