import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import Icon from '../../components/Icon';
import { BackLink, Card } from '../../components/clinic/ClinicAdminUi';
import { ActionDialog, StatusTag, WorkflowSteps } from '../../components/admin/AdminUi';
import { useSensitiveAction } from '../../components/admin/AdminSecurity';
import { Field, FormError } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { ADMIN_APPLICATIONS_HREF, CLINIC_STATUS, VERIFICATION_DOCUMENT_LABELS, getAdminClinicHref } from '../../config/adminNavigation';
import {
  addApplicationNote,
  approveApplication,
  getApplication,
  openApplicationDocument,
  rejectApplication,
  requestApplicationDocuments,
  startApplicationReview,
} from '../../services/adminApi';
import { getErrorMessage } from '../../services/apiErrors';
import { formatDateTime, formatShortDate } from '../../utils/dateTime';

const OPEN = ['pending', 'under_review'];

const HISTORY_LABELS = {
  'clinic_application.submitted': 'Submission received',
  'clinic_application.document_uploaded': 'Document uploaded',
  'clinic_application.review_started': 'Review started',
  'clinic_application.document_accessed': 'Document opened',
  'clinic_application.note_added': 'Internal note added',
  'clinic_application.approved': 'Clinic approved',
  'clinic_application.rejected': 'Rejected',
  'clinic_application.documents_requested': 'More documents requested',
};

const DECISIONS = {
  approve: {
    title: 'Approve Clinic',
    verb: 'approve',
    detail: ' The clinic, its main branch and clinic admin access will be created. It stays hidden until the owner publishes it.',
    label: 'Message to the applicant (optional)',
    optional: true,
    run: approveApplication,
  },
  reject: {
    title: 'Reject Clinic',
    verb: 'reject',
    detail: ' They can correct it and submit again.',
    label: 'Reason (sent to the applicant)',
    optional: false,
    run: rejectApplication,
  },
  request: {
    title: 'Request More Documents',
    verb: 'request more documents from',
    detail: ' The registration goes back to them to add what is missing.',
    label: 'What the applicant needs to send',
    optional: false,
    run: requestApplicationDocuments,
  },
};

function SubmittedDocuments({ app }) {
  const [error, setError] = useState('');
  const open = (doc, download) => {
    setError('');
    openApplicationDocument('admin', app.id, doc.id, { download }).catch((e) => setError(getErrorMessage(e)));
  };

  return (
    <>
      <h3 className="admin-subheading">Submitted Documents</h3>
      <p className="admin-muted admin-small">Links last 5 minutes. Every view and download is recorded in the audit log.</p>
      <ul className="admin-documents">
        {app.documents.map((doc) => {
          const label = VERIFICATION_DOCUMENT_LABELS[doc.document_type] ?? doc.document_type;
          return (
            <li key={doc.id} className="admin-document is-submitted">
              <Icon name="checkCircle" size={18} />
              <span className="admin-document-name">
                {label}
                <span className="admin-document-file">{doc.original_name}</span>
              </span>
              <button type="button" className="admin-document-action" aria-label={`View ${label}`} onClick={() => open(doc, false)}>
                View
              </button>
              <button type="button" className="admin-document-action" aria-label={`Download ${label}`} onClick={() => open(doc, true)}>
                Download
              </button>
              <span className="admin-document-state">Submitted</span>
            </li>
          );
        })}
        {app.missing_documents.map((type) => (
          <li key={type} className="admin-document is-missing">
            <Icon name="close" size={18} />
            <span className="admin-document-name">{VERIFICATION_DOCUMENT_LABELS[type] ?? type}</span>
            <span className="admin-document-state">Missing</span>
          </li>
        ))}
      </ul>
      {error && (
        <p className="portal-inline-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

function ClinicDetails({ app }) {
  const rows = [
    ['Location', [app.address, app.city, app.province].filter(Boolean).join(', ')],
    ['Contact Email', app.email],
    ['Phone', app.contact_number],
    ['Representative', [app.representative_name, app.representative_position].filter(Boolean).join(', ')],
    ['Applicant Account', app.applicant ? `${app.applicant.name} (${app.applicant.email})` : ''],
  ];

  return (
    <Card title="Clinic Details">
      <dl className="admin-info-list">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value || '—'}</dd>
          </div>
        ))}
      </dl>
      {app.description && <p className="admin-muted admin-spaced-top">{app.description}</p>}
    </Card>
  );
}

// Only administrators see these; they stay in the audit log and cannot be edited.
function NotesAndHistory({ app, queryKey }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const history = (app.history ?? []).slice().reverse();
  const save = useMutation({
    mutationFn: () => addApplicationNote(app.id, note.trim()),
    onSuccess: (response) => {
      setNote('');
      queryClient.setQueryData(queryKey, (current) => (current ? { ...current, history: response.data ?? current.history } : current));
    },
  });

  return (
    <Card title="Internal Notes & History">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (note.trim()) save.mutate();
        }}
      >
        <Field
          label="New note"
          as="textarea"
          hint="Only administrators see notes. They are kept in the audit log and cannot be edited or deleted."
          maxLength={2000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <FormError error={save.error} />
        <div className="admin-note-actions">
          {save.isSuccess && !note && (
            <span className="admin-success-text" role="status">
              Note saved
            </span>
          )}
          <button type="submit" className="btn btn-outline btn-sm" disabled={!note.trim() || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </form>
      {history.length > 0 && (
        <ol className="admin-history">
          {history.map((event) => (
            <li key={event.id}>
              <p className="admin-history-label">{HISTORY_LABELS[event.action] ?? event.action}</p>
              {event.note && <p className="admin-history-note">{event.note}</p>}
              {event.document_type && <p className="admin-history-note">{VERIFICATION_DOCUMENT_LABELS[event.document_type] ?? event.document_type}</p>}
              <p className="admin-history-meta">{[formatDateTime(event.at), event.actor].filter(Boolean).join(' · ')}</p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function VerificationActions({ app, onChanged }) {
  const runSensitive = useSensitiveAction();
  const [kind, setKind] = useState(null);
  const decision = kind ? DECISIONS[kind] : null;
  const missing = app.missing_documents.length > 0;
  const decide = useMutation({
    mutationFn: (notes) => runSensitive(() => decision.run(app.id, notes || undefined)),
    onSuccess: () => {
      setKind(null);
      onChanged();
    },
  });
  const ask = (next) => {
    decide.reset();
    setKind(next);
  };

  return (
    <Card title="Verification Actions">
      {OPEN.includes(app.status) ? (
        <div className="admin-action-stack">
          <button
            type="button"
            className="admin-action-button is-solid-success"
            disabled={missing}
            title={missing ? 'Required documents are missing' : undefined}
            onClick={() => ask('approve')}
          >
            <Icon name="check" size={18} />
            Approve Clinic
          </button>
          <button type="button" className="admin-action-button is-danger" onClick={() => ask('reject')}>
            <Icon name="close" size={18} />
            Reject
          </button>
          <button type="button" className="admin-action-button is-warning" onClick={() => ask('request')}>
            <Icon name="upload" size={18} />
            Request More Documents
          </button>
        </div>
      ) : (
        <>
          <p className={`admin-result-note ${app.status === 'approved' ? 'is-success' : 'is-warning'}`} role="status">
            <Icon name={app.status === 'approved' ? 'checkCircle' : 'info'} size={18} />
            {app.status === 'approved'
              ? `Clinic verified${app.reviewed_at ? ` on ${formatShortDate(app.reviewed_at)}` : ''}.`
              : 'Waiting for the applicant to correct it and submit again.'}
          </p>
          {app.review_notes && <p className="admin-muted admin-spaced-top">{app.review_notes}</p>}
          {app.clinic_id && (
            <a href={getAdminClinicHref(app.clinic_id)} className="admin-action-button admin-spaced-top">
              <Icon name="building" size={18} />
              View Clinic
            </a>
          )}
        </>
      )}

      {decision && (
        <ActionDialog
          title={decision.title}
          message={
            <>
              Are you sure you want to <strong>{decision.verb}</strong> {app.clinic_name}?{decision.detail}
            </>
          }
          reasonLabel={decision.label}
          reasonOptional={decision.optional}
          isBusy={decide.isPending}
          error={decide.error}
          onConfirm={(notes) => decide.mutate(notes)}
          onCancel={() => setKind(null)}
        />
      )}
    </Card>
  );
}

function WorkflowCard({ app, onChanged }) {
  const start = useMutation({ mutationFn: () => startApplicationReview(app.id), onSuccess: onChanged });
  const decided = ['approved', 'rejected'].includes(app.status);

  return (
    <Card title="Workflow Status">
      <WorkflowSteps
        label="Verification progress"
        steps={[
          { label: 'Clinic registered', done: true },
          { label: 'Documents submitted', done: Boolean(app.submitted_at) },
          { label: 'Under review', done: app.status === 'under_review' || decided },
          { label: 'Verified', done: app.status === 'approved' },
        ]}
      />
      {app.status === 'pending' && (
        <button type="button" className="btn btn-outline btn-sm admin-spaced-top" disabled={start.isPending} onClick={() => start.mutate()}>
          {start.isPending ? 'Starting…' : 'Start Review'}
        </button>
      )}
      <FormError error={start.error} />
    </Card>
  );
}

function AdminApplicationDetailPage() {
  const { applicationId } = useParams();
  const queryClient = useQueryClient();
  const queryKey = ['admin', 'application', applicationId];
  const query = useQuery({ queryKey, queryFn: () => getApplication(applicationId) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });

  return (
    <AdminLayout title="Verification Review" activeHref={ADMIN_APPLICATIONS_HREF}>
      <BackLink href={ADMIN_APPLICATIONS_HREF}>Back to Verifications</BackLink>
      <QueryState query={query} loadingLabel="Loading registration…">
        {(app) => {
          const status = app.documents_requested ? { label: 'More Documents Requested', tone: 'warning' } : CLINIC_STATUS[app.status] ?? CLINIC_STATUS.pending;
          const admin = app.representative_name || app.applicant?.name;
          return (
            <div className="admin-detail-columns">
              <div className="admin-stack">
                <Card className="admin-detail-card">
                  <div className="admin-detail-head">
                    <div>
                      <h2 className="admin-detail-name">{app.clinic_name}</h2>
                      <p className="admin-detail-sub">
                        {[admin && `Admin: ${admin}`, app.submitted_at && `Submitted: ${formatShortDate(app.submitted_at)}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <StatusTag tone={status.tone}>{status.label}</StatusTag>
                  </div>
                  <SubmittedDocuments app={app} />
                </Card>
                <ClinicDetails app={app} />
                <NotesAndHistory app={app} queryKey={queryKey} />
              </div>
              <div className="admin-stack">
                <VerificationActions app={app} onChanged={refresh} />
                <WorkflowCard app={app} onChanged={refresh} />
              </div>
            </div>
          );
        }}
      </QueryState>
    </AdminLayout>
  );
}

export default AdminApplicationDetailPage;
