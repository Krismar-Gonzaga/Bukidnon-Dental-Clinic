import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import AdminLayout from '../../layouts/AdminLayout';
import Icon from '../../components/Icon';
import { Field, FormError, Modal } from '../../components/portal/PortalUi';
import { useSensitiveAction } from '../../components/admin/AdminSecurity';
import { QueryState } from '../../components/StatusMessage';
import { ADMIN_APPLICATIONS_HREF, ADMIN_CLINICS_HREF, APPLICATION_STATUS_LABELS } from '../../config/adminNavigation';
import {
  addApplicationNote,
  approveApplication,
  getApplication,
  openApplicationDocument,
  rejectApplication,
  startApplicationReview,
} from '../../services/adminApi';
import { getErrorMessage } from '../../services/apiErrors';
import { formatDate, formatDateTime } from '../../utils/dateTime';
import { DOCUMENT_LABELS } from '../clinic/ClinicApplicationPage';
import './AdminApplicationDetailPage.css';

const OPEN = ['pending', 'under_review'];

const fileSize = (bytes) => {
  if (!bytes) return '';
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const HISTORY = {
  'clinic_application.submitted': { label: 'Submission received', icon: 'send', tone: 'neutral' },
  'clinic_application.document_uploaded': { label: 'Document uploaded', icon: 'clipboardList', tone: 'neutral' },
  'clinic_application.review_started': { label: 'Manual review started', icon: 'eye', tone: 'primary' },
  'clinic_application.document_accessed': { label: 'Document opened', icon: 'lock', tone: 'neutral' },
  'clinic_application.note_added': { label: 'Internal note added', icon: 'pencil', tone: 'neutral' },
  'clinic_application.approved': { label: 'Clinic approved', icon: 'check', tone: 'success' },
  'clinic_application.rejected': { label: 'Returned to the applicant', icon: 'alertCircle', tone: 'warning' },
};

function ApprovedPanel({ app }) {
  return (
    <section className="admin-approved" aria-labelledby="admin-approved-title" role="status">
      <span className="admin-approved-icon" aria-hidden="true">
        <Icon name="checkCircle" size={32} />
      </span>
      <div className="admin-approved-body">
        <h2 id="admin-approved-title" className="admin-approved-title">
          Clinic approval confirmed
        </h2>
        <p>
          <strong>{app.clinic_name}</strong> is a verified clinic{app.reviewed_at ? ` since ${formatDateTime(app.reviewed_at)}` : ''}.
        </p>
        <ul className="admin-approved-steps">
          <li>The clinic, its main branch and the owner&apos;s clinic-admin access were created.</li>
          <li>The applicant was notified. The clinic stays hidden from patients until the owner publishes it.</li>
        </ul>
        <div className="admin-approved-actions">
          <a href={ADMIN_APPLICATIONS_HREF} className="btn btn-outline btn-sm">
            Back to Registration Queue
          </a>
          <a href={`${ADMIN_CLINICS_HREF}?search=${encodeURIComponent(app.clinic_name)}`} className="btn btn-primary btn-sm">
            View in Verification
          </a>
        </div>
      </div>
    </section>
  );
}

function Documents({ app }) {
  const [error, setError] = useState('');
  const open = (doc, download) =>
    openApplicationDocument('admin', app.id, doc.id, { download }).catch((e) => setError(getErrorMessage(e)));

  return (
    <section className="admin-card admin-detail-card" aria-labelledby="admin-docs-title">
      <div className="admin-card-header admin-detail-header">
        <h3 id="admin-docs-title" className="admin-card-title">
          <Icon name="clipboardList" size={22} className="admin-title-icon" />
          Verification Documents
        </h3>
        <span className="admin-overline">
          {app.documents.length} {app.documents.length === 1 ? 'File' : 'Files'} Uploaded
        </span>
      </div>
      <p className="admin-detail-note">Links last 5 minutes and every view or download is recorded in the audit log.</p>
      {app.documents.length === 0 ? (
        <p className="admin-detail-note">No documents uploaded.</p>
      ) : (
        <ul className="admin-docs">
          {app.documents.map((doc) => {
            const label = DOCUMENT_LABELS[doc.document_type] ?? doc.document_type;
            return (
              <li key={doc.id} className="admin-doc">
                <div className="admin-doc-head">
                  <span className="admin-doc-icon" aria-hidden="true">
                    <Icon name="shieldCheck" size={22} />
                  </span>
                  <div className="admin-doc-text">
                    <p className="admin-doc-name">{label}</p>
                    <p className="admin-doc-file">
                      {doc.original_name}
                      {doc.size ? ` • ${fileSize(doc.size)}` : ''}
                    </p>
                  </div>
                </div>
                <div className="admin-doc-actions">
                  <button type="button" onClick={() => open(doc, false)} aria-label={`View ${label}`}>
                    View
                  </button>
                  <button type="button" onClick={() => open(doc, true)} aria-label={`Download ${label}`}>
                    Download
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p className="portal-inline-error" role="alert">
          {error}
        </p>
      )}
      {app.missing_documents.length > 0 && (
        <p className="portal-inline-error">Missing: {app.missing_documents.map((d) => DOCUMENT_LABELS[d] ?? d).join(', ')}</p>
      )}
    </section>
  );
}

function InternalNotes({ app, queryKey }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const notes = app.history.filter((h) => h.action === 'clinic_application.note_added').reverse();
  const save = useMutation({
    mutationFn: () => addApplicationNote(app.id, note.trim()),
    onSuccess: (response) => {
      setNote('');
      queryClient.setQueryData(queryKey, (current) => (current ? { ...current, history: response.data ?? current.history } : current));
    },
  });

  return (
    <section className="admin-card admin-detail-card" aria-labelledby="admin-notes-title">
      <h3 id="admin-notes-title" className="admin-card-title admin-detail-heading">
        Internal Notes
      </h3>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (note.trim()) save.mutate();
        }}
      >
        <Field
          label="New note"
          as="textarea"
          className="admin-note-field"
          placeholder="Leave a note about this clinic's verification process…"
          hint="Only administrators see these notes. They are kept in the audit log and cannot be edited or deleted."
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <FormError error={save.error} />
        <div className="admin-note-actions">
          {save.isSuccess && !note && (
            <span className="admin-note-saved" role="status">
              Note saved
            </span>
          )}
          <button type="submit" className="btn btn-primary btn-sm" disabled={!note.trim() || save.isPending}>
            {save.isPending ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </form>
      {notes.length > 0 && (
        <ul className="admin-notes">
          {notes.map((n) => (
            <li key={n.id}>
              <p className="admin-note-text">{n.note}</p>
              <p className="admin-note-meta">
                {n.actor ?? 'Administrator'} · {formatDateTime(n.at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Snapshot({ app }) {
  const rows = [
    { icon: 'mapPin', label: 'Location', value: [app.address, app.city, app.province].filter(Boolean).join(', ') },
    { icon: 'mail', label: 'Contact Email', value: app.email },
    { icon: 'phone', label: 'Phone', value: app.contact_number },
    { icon: 'stethoscope', label: 'Representative', value: [app.representative_name, app.representative_position].filter(Boolean).join(', ') },
    { icon: 'user', label: 'Applicant Account', value: app.applicant ? `${app.applicant.name} (${app.applicant.email})` : '' },
  ];

  return (
    <section className="admin-card admin-detail-card admin-snapshot" aria-labelledby="admin-snapshot-title">
      <h3 id="admin-snapshot-title" className="admin-card-title admin-detail-heading">
        Clinic Snapshot
      </h3>
      <dl className="admin-snapshot-list">
        {rows.map((row) => (
          <div key={row.label} className="admin-snapshot-row">
            <Icon name={row.icon} size={20} className="admin-snapshot-icon" />
            <div>
              <dt className="admin-overline">{row.label}</dt>
              <dd>{row.value || '—'}</dd>
            </div>
          </div>
        ))}
      </dl>
      {app.description && <p className="admin-detail-note admin-snapshot-description">{app.description}</p>}
    </section>
  );
}

function ReviewHistory({ app }) {
  const events = app.history.slice().reverse();
  return (
    <section className="admin-card admin-detail-card" aria-labelledby="admin-history-title">
      <h3 id="admin-history-title" className="admin-card-title admin-detail-heading">
        Review History
      </h3>
      {events.length === 0 ? (
        <p className="admin-detail-note">No recorded events yet.</p>
      ) : (
        <ol className="admin-history">
          {events.map((event) => {
            const meta = HISTORY[event.action] ?? { label: event.action, icon: 'info', tone: 'neutral' };
            const detail =
              event.action === 'clinic_application.document_uploaded'
                ? DOCUMENT_LABELS[event.document_type] ?? event.document_type
                : event.action === 'clinic_application.rejected' && app.status === 'rejected'
                  ? app.review_notes
                  : null;
            return (
              <li key={event.id} className="admin-history-item">
                <span className={`admin-history-dot is-${meta.tone}`} aria-hidden="true">
                  <Icon name={meta.icon} size={12} />
                </span>
                <p className="admin-history-label">{meta.label}</p>
                <p className="admin-history-meta">
                  {formatDateTime(event.at)}
                  {event.actor ? ` · ${event.actor}` : ''}
                </p>
                {detail && <p className="admin-history-detail">{detail}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function DecisionModal({ kind, app, onClose, onDone }) {
  const runSensitive = useSensitiveAction();
  const [notes, setNotes] = useState('');
  const isApprove = kind === 'approve';
  const decide = useMutation({
    mutationFn: () =>
      runSensitive(() => (isApprove ? approveApplication(app.id, notes.trim() || undefined) : rejectApplication(app.id, notes.trim()))),
    onSuccess: onDone,
  });

  return (
    <Modal title={isApprove ? `Approve ${app.clinic_name}?` : 'Request more information'} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          decide.mutate();
        }}
      >
        <p className="portal-confirm-message">
          {isApprove
            ? 'Approving creates the clinic and its main branch, gives the applicant clinic-admin access and notifies them. The clinic stays hidden until the owner publishes it. This cannot be undone here; a clinic can later be suspended.'
            : 'The application goes back to the applicant with your message so they can fix it and submit again.'}
        </p>
        <Field
          label={isApprove ? 'Message to the applicant (optional)' : 'What the applicant needs to fix'}
          as="textarea"
          required={!isApprove}
          className="portal-spaced-top"
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          hint="Sent to the applicant."
        />
        <FormError error={decide.error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={decide.isPending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={decide.isPending || (!isApprove && !notes.trim())}>
            {decide.isPending ? 'Saving…' : isApprove ? 'Approve clinic' : 'Send request'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ApplicationDetail({ applicationId }) {
  const queryClient = useQueryClient();
  const queryKey = ['admin', 'application', applicationId];
  const query = useQuery({ queryKey, queryFn: () => getApplication(applicationId) });
  const [decision, setDecision] = useState(null); // 'approve' | 'request'
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });
  const startReview = useMutation({ mutationFn: () => startApplicationReview(applicationId), onSuccess: refresh });

  return (
    <QueryState query={query} loadingLabel="Loading application…">
      {(app) => {
        const isOpen = OPEN.includes(app.status);
        const missing = app.missing_documents.length > 0;
        const history = app.history ?? [];
        const withHistory = { ...app, history };
        return (
          <div className="admin-detail">
            <header className="admin-detail-top">
              <div>
                <a href={ADMIN_APPLICATIONS_HREF} className="admin-back-link">
                  <Icon name="arrowLeft" size={16} />
                  Back to Registration Queue
                </a>
                <h2 className="admin-detail-title">{app.clinic_name}</h2>
                <div className="admin-detail-meta">
                  <span className={`admin-status-pill is-${app.status}`}>
                    <Icon name={app.status === 'approved' ? 'checkCircle' : 'eye'} size={16} />
                    {APPLICATION_STATUS_LABELS[app.status] ?? app.status}
                  </span>
                  <span>{app.submitted_at ? `Submitted on ${formatDate(app.submitted_at)}` : 'Not submitted'}</span>
                </div>
              </div>
              {isOpen && (
                <div className="admin-detail-actions">
                  {app.status === 'pending' && (
                    <button type="button" className="btn btn-outline" disabled={startReview.isPending} onClick={() => startReview.mutate()}>
                      {startReview.isPending ? 'Starting…' : 'Start Review'}
                    </button>
                  )}
                  <button type="button" className="btn btn-outline" onClick={() => setDecision('request')}>
                    Request More Info
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={missing}
                    title={missing ? 'Required documents are missing' : undefined}
                    onClick={() => setDecision('approve')}
                  >
                    Approve Clinic
                  </button>
                </div>
              )}
            </header>
            <FormError error={startReview.error} />

            {app.status === 'approved' && <ApprovedPanel app={app} />}
            {app.status === 'rejected' && (
              <p className="admin-returned" role="status">
                Returned to the applicant{app.reviewed_at ? ` on ${formatDateTime(app.reviewed_at)}` : ''}. Waiting for them to correct and
                resubmit.
              </p>
            )}

            <div className="admin-detail-grid">
              <div className="admin-detail-main">
                <Documents app={app} />
                <InternalNotes app={withHistory} queryKey={queryKey} />
              </div>
              <div className="admin-detail-side">
                <Snapshot app={app} />
                <ReviewHistory app={withHistory} />
              </div>
            </div>

            {decision && (
              <DecisionModal
                kind={decision}
                app={app}
                onClose={() => setDecision(null)}
                onDone={() => {
                  setDecision(null);
                  refresh();
                }}
              />
            )}
          </div>
        );
      }}
    </QueryState>
  );
}

function AdminApplicationDetailPage() {
  const { applicationId } = useParams();
  return (
    <AdminLayout title="Clinic Verification" activeHref={ADMIN_APPLICATIONS_HREF}>
      <ApplicationDetail applicationId={applicationId} />
    </AdminLayout>
  );
}

export default AdminApplicationDetailPage;
