import { useId, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import Icon from '../../components/Icon';
import { ConfirmDialog, Field, FormError, Modal } from '../../components/portal/PortalUi';
import { Initials, MetricCard, PageHeader, SegmentedTabs, StatusPill, TableFooter } from '../../components/admin/AdminData';
import { useSensitiveAction } from '../../components/admin/AdminSecurity';
import { QueryState } from '../../components/StatusMessage';
import { ADMIN_CLINICS_HREF, DOCUMENT_STATUS, PRIORITY_LABELS, getAdminApplicationHref } from '../../config/adminNavigation';
import { getPublicClinicHref } from '../../config/navigation';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { exportApplicationsCsv, getAdminClinics, getApplicationSummary, getApplications, reactivateClinic, suspendClinic } from '../../services/adminApi';
import { getErrorMessage } from '../../services/apiErrors';
import { formatShortDate } from '../../utils/dateTime';
import { DOCUMENT_LABELS } from '../clinic/ClinicApplicationPage';
import './AdminDashboardPage.css';
import './AdminClinicsPage.css';

// Verification (admin portal design): registrations with their document
// status and review priority, plus the verified clinics directory where
// clinics are suspended or reactivated. No access to patients or records.
// Suspending, reactivating and exporting need the password re-entered.

const VIEWS = { all: 'All Registrations', attention: 'Needs Attention', clinics: 'Verified Clinics' };

const REGISTRATION_STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under review' },
  { value: 'approved', label: 'Verified' },
  { value: 'rejected', label: 'More info requested' },
];

const CLINIC_STATUSES = [
  { value: '', label: 'All statuses' },
  { value: 'approved', label: 'Verified' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
];

const CLINIC_STATUS = {
  approved: { label: 'Verified', tone: 'success' },
  pending: { label: 'Pending', tone: 'neutral' },
  suspended: { label: 'Suspended', tone: 'danger' },
};

const REVIEW_STEPS = [
  'Start the review so other administrators can see the registration is being handled.',
  'Open every required document. Links expire after 5 minutes, and each view or download is recorded in the audit log.',
  'Check that the clinic name, address and representative match across the registration and the documents, and that permits and licenses are current.',
  'If anything is missing, unreadable or inconsistent, use Request More Info. The applicant can correct the registration and submit it again.',
  'Approve only when everything checks out. Approving creates the clinic and asks for your password again.',
];

const count = (value) => (value == null ? '—' : String(value).padStart(2, '0'));
const clinicCode = (id) => `CLIN-${String(id).padStart(5, '0')}`;

function Metrics({ summary }) {
  const data = summary.data;
  const thisWeek = data?.submitted_this_week ?? 0;
  const hours = data?.average_decision_hours;

  return (
    <div className="admin-metrics" aria-busy={summary.isPending}>
      <MetricCard
        label="Total Pending"
        value={count(data?.pending)}
        note={thisWeek > 0 ? `+${thisWeek} submitted this week (${data.submitted_last_week} last week)` : 'None submitted this week'}
        noteIcon={thisWeek > 0 ? 'trendingUp' : undefined}
        noteTone={thisWeek > 0 ? 'success' : 'muted'}
      />
      <MetricCard
        label="In Review"
        value={count(data?.under_review)}
        note={hours == null ? 'No decisions in the last 30 days' : `Avg. decision time: ${hours} hrs`}
        noteIcon="clock"
      />
      <MetricCard
        label="Critical Action"
        value={count(data?.needs_attention)}
        tone={data?.needs_attention ? 'danger' : 'default'}
        note={`Waiting ${data?.attention_days ?? 3}+ days or missing documents`}
        noteIcon="alertTriangle"
        noteTone={data?.needs_attention ? 'danger' : 'muted'}
      />
      <MetricCard
        label="Verified Today"
        value={count(data?.verified_today)}
        tone="success"
        note={data ? `${data.decisions_last_30_days} ${data.decisions_last_30_days === 1 ? 'decision' : 'decisions'} in 30 days` : ' '}
        noteIcon="checkCircle"
        noteTone="success"
      />
    </div>
  );
}

function Priority({ value }) {
  if (!value) return <span>—</span>;
  if (value === 'high') {
    return (
      <span className="admin-priority-high">
        <Icon name="alertCircle" size={16} />
        {PRIORITY_LABELS.high}
      </span>
    );
  }
  return <span>{PRIORITY_LABELS[value]}</span>;
}

function RegistrationsTable({ items }) {
  if (items.length === 0) return <p className="admin-empty admin-verification-empty">No registrations match these filters.</p>;

  return (
    <div className="admin-table-scroll">
      <table className="admin-table">
        <caption className="visually-hidden">Clinic registrations</caption>
        <thead>
          <tr>
            <th scope="col">Clinic Name</th>
            <th scope="col">Reference</th>
            <th scope="col">Submitted Date</th>
            <th scope="col">Document Status</th>
            <th scope="col">Priority</th>
            <th scope="col" className="is-end">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => {
            const status = DOCUMENT_STATUS[a.document_status] ?? DOCUMENT_STATUS.pending;
            const needsWork = a.document_status === 'missing_info' || a.priority === 'high';
            return (
              <tr key={a.id}>
                <td>
                  <div className="admin-cell-person">
                    <Initials name={a.clinic_name} square tone={status.tone === 'danger' ? 'danger' : 'primary'} />
                    <div>
                      <p className="admin-cell-title">{a.clinic_name}</p>
                      <p className="admin-cell-sub">{[a.city, a.province].filter(Boolean).join(', ') || '—'}</p>
                    </div>
                  </div>
                </td>
                <td>{a.reference}</td>
                <td>{a.submitted_at ? formatShortDate(a.submitted_at) : '—'}</td>
                <td>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                </td>
                <td>
                  <Priority value={a.priority} />
                </td>
                <td className="is-end">
                  <a href={getAdminApplicationHref(a.id)} className="admin-link-button" aria-label={`${needsWork ? 'Resolve issues for' : 'View documents for'} ${a.clinic_name}`}>
                    {needsWork ? 'Resolve Issues' : 'View Documents'}
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ClinicsTable({ items, onSuspend, onReactivate }) {
  if (items.length === 0) return <p className="admin-empty admin-verification-empty">No clinics match these filters.</p>;

  return (
    <div className="admin-table-scroll">
      <table className="admin-table">
        <caption className="visually-hidden">Verified clinics</caption>
        <thead>
          <tr>
            <th scope="col">Clinic Name</th>
            <th scope="col">Clinic ID</th>
            <th scope="col">Status</th>
            <th scope="col">Directory</th>
            <th scope="col">Staff</th>
            <th scope="col">Branches</th>
            <th scope="col" className="is-end">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => {
            const status = CLINIC_STATUS[c.status] ?? CLINIC_STATUS.pending;
            const listed = c.is_published && c.status === 'approved';
            return (
              <tr key={c.id}>
                <td>
                  <div className="admin-cell-person">
                    <Initials name={c.name} square tone={c.status === 'suspended' ? 'danger' : 'primary'} />
                    <div>
                      <p className="admin-cell-title">
                        {listed ? (
                          <a href={getPublicClinicHref(c.id)} target="_blank" rel="noreferrer">
                            {c.name}
                          </a>
                        ) : (
                          c.name
                        )}
                      </p>
                      <p className="admin-cell-sub">{c.city || '—'}</p>
                    </div>
                  </div>
                </td>
                <td>{clinicCode(c.id)}</td>
                <td>
                  <StatusPill tone={status.tone}>{status.label}</StatusPill>
                </td>
                <td>{listed ? 'Listed' : 'Hidden'}</td>
                <td>{c.members_count}</td>
                <td>{c.branches_count}</td>
                <td className="is-end">
                  {c.status === 'suspended' ? (
                    <button type="button" className="admin-link-button" onClick={() => onReactivate(c)} aria-label={`Reactivate ${c.name}`}>
                      Reactivate
                    </button>
                  ) : (
                    <button type="button" className="admin-link-button is-danger" onClick={() => onSuspend(c)} aria-label={`Suspend ${c.name}`}>
                      Suspend
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ChecklistModal({ onClose }) {
  return (
    <Modal title="How to verify a clinic" onClose={onClose} wide>
      <ol className="admin-steps">
        {REVIEW_STEPS.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div className="portal-form-actions">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

function VerificationContent() {
  const queryClient = useQueryClient();
  const runSensitive = useSensitiveAction();
  const filtersId = useId();
  // ?search= (top-bar search, approved registration) opens the clinics directory.
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') ?? '';
  const [view, setView] = useState(VIEWS[searchParams.get('view')] ? searchParams.get('view') : initialSearch ? 'clinics' : 'all');
  const [showFilters, setShowFilters] = useState(Boolean(initialSearch));
  const [filters, setFilters] = useState({ search: initialSearch, status: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [showChecklist, setShowChecklist] = useState(false);
  const [suspending, setSuspending] = useState(null);
  const [reason, setReason] = useState('');
  const [reactivating, setReactivating] = useState(null);
  const search = useDebouncedValue(filters.search.trim());
  const isClinics = view === 'clinics';

  const summary = useQuery({ queryKey: ['admin', 'applications', 'summary'], queryFn: getApplicationSummary });
  const registrationParams = {
    view: view === 'attention' ? 'attention' : undefined,
    status: filters.status || undefined,
    search: search || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  };
  const registrations = useQuery({
    queryKey: ['admin', 'applications', registrationParams, page, perPage],
    queryFn: () => getApplications({ ...registrationParams, page, per_page: perPage }),
    placeholderData: keepPreviousData,
    enabled: !isClinics,
  });
  const clinics = useQuery({
    queryKey: ['admin', 'clinics', filters.status, search, page, perPage],
    queryFn: () => getAdminClinics({ status: filters.status || undefined, search: search || undefined, page, per_page: perPage }),
    placeholderData: keepPreviousData,
    enabled: isClinics,
  });
  const exportCsv = useMutation({ mutationFn: () => runSensitive(() => exportApplicationsCsv(registrationParams)) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });
  const suspend = useMutation({
    mutationFn: () => runSensitive(() => suspendClinic(suspending.id, reason.trim())),
    onSuccess: () => {
      setSuspending(null);
      setReason('');
      refresh();
    },
  });
  const reactivate = useMutation({
    mutationFn: () => runSensitive(() => reactivateClinic(reactivating.id)),
    onSuccess: () => {
      setReactivating(null);
      refresh();
    },
  });

  const changeView = (next) => {
    setView(next);
    setPage(1);
    setFilters((f) => ({ ...f, status: '' }));
  };
  const setFilter = (name) => (e) => {
    setFilters((f) => ({ ...f, [name]: e.target.value }));
    setPage(1);
  };
  const activeQuery = isClinics ? clinics : registrations;
  const oldestId = summary.data?.oldest_open_id;

  return (
    <>
      <PageHeader title="Clinic Verification" lead="Review and validate regulatory documentation for newly registered dental practices before granting full platform access.">
        <button
          type="button"
          className="btn btn-outline"
          aria-expanded={showFilters}
          aria-controls={filtersId}
          onClick={() => setShowFilters((open) => !open)}
        >
          <Icon name="sliders" size={18} />
          Filters
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={isClinics || exportCsv.isPending}
          title={isClinics ? 'Export is available for registrations' : undefined}
          onClick={() => exportCsv.mutate()}
        >
          <Icon name="download" size={18} />
          {exportCsv.isPending ? 'Exporting…' : 'Export CSV'}
        </button>
      </PageHeader>
      {exportCsv.isError && (
        <p className="admin-inline-status is-error" role="alert">
          {getErrorMessage(exportCsv.error)}
        </p>
      )}

      {showFilters && (
        <div id={filtersId} className="admin-filter-bar" role="search" aria-label="Filter verification list">
          <label className="admin-filter">
            <span className="admin-filter-label">Search</span>
            <input type="search" value={filters.search} maxLength={100} placeholder={isClinics ? 'Clinic name' : 'Clinic name or city'} onChange={setFilter('search')} />
          </label>
          <label className="admin-filter">
            <span className="admin-filter-label">Status</span>
            <select value={filters.status} onChange={setFilter('status')}>
              {(isClinics ? CLINIC_STATUSES : REGISTRATION_STATUSES).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {!isClinics && (
            <>
              <label className="admin-filter">
                <span className="admin-filter-label">Submitted from</span>
                <input type="date" value={filters.from} max={filters.to || undefined} onChange={setFilter('from')} />
              </label>
              <label className="admin-filter">
                <span className="admin-filter-label">Submitted to</span>
                <input type="date" value={filters.to} min={filters.from || undefined} onChange={setFilter('to')} />
              </label>
            </>
          )}
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => {
              setFilters({ search: '', status: '', from: '', to: '' });
              setPage(1);
            }}
          >
            Clear Filters
          </button>
        </div>
      )}

      <Metrics summary={summary} />

      <section className="admin-table-card" aria-label={VIEWS[view]}>
        <div className="admin-table-toolbar">
          <SegmentedTabs
            label="Verification lists"
            value={view}
            onChange={changeView}
            tabs={[
              { value: 'all', label: VIEWS.all },
              { value: 'attention', label: VIEWS.attention, count: summary.data?.needs_attention },
              { value: 'clinics', label: VIEWS.clinics },
            ]}
          />
          {activeQuery.isFetching && !activeQuery.isPending && <span className="admin-cell-sub">Updating…</span>}
        </div>
        <QueryState query={activeQuery} loadingLabel={isClinics ? 'Loading clinics…' : 'Loading registrations…'}>
          {({ items, meta }) => (
            <>
              {isClinics ? (
                <ClinicsTable
                  items={items}
                  onSuspend={(c) => {
                    suspend.reset();
                    setReason('');
                    setSuspending(c);
                  }}
                  onReactivate={(c) => {
                    reactivate.reset();
                    setReactivating(c);
                  }}
                />
              ) : (
                <RegistrationsTable items={items} />
              )}
              <TableFooter
                meta={meta}
                perPage={perPage}
                onPerPageChange={(n) => {
                  setPerPage(n);
                  setPage(1);
                }}
                onPageChange={setPage}
                noun={isClinics ? 'clinics' : 'registrations'}
                label={isClinics ? 'Clinic pages' : 'Registration pages'}
              />
            </>
          )}
        </QueryState>
      </section>

      <div className="admin-verification-extras">
        <section className="admin-guidelines" aria-labelledby="admin-guidelines-title">
          <h2 id="admin-guidelines-title" className="admin-guidelines-title">
            Verification Checklist
          </h2>
          <p className="admin-guidelines-text">
            Approve a clinic only when every required document is present, readable, current and issued to the clinic and representative named in the
            registration.
          </p>
          <ul className="admin-guidelines-docs">
            {(summary.data?.required_documents ?? []).map((type) => (
              <li key={type}>
                <Icon name="checkCircle" size={16} />
                {DOCUMENT_LABELS[type] ?? type}
              </li>
            ))}
          </ul>
          <button type="button" className="btn btn-primary" onClick={() => setShowChecklist(true)}>
            Read Documentation
          </button>
        </section>

        <section className="admin-speed-dial" aria-labelledby="admin-speed-dial-title">
          <Icon name="zap" size={32} />
          <h2 id="admin-speed-dial-title" className="admin-speed-dial-title">
            Speed Dial
          </h2>
          <p className="admin-speed-dial-text">Quickly reach the most frequent verification tasks.</p>
          <div className="admin-speed-dial-actions">
            {oldestId ? (
              <a href={getAdminApplicationHref(oldestId)} className="admin-speed-dial-action">
                Review Oldest Registration
                <Icon name="arrowRight" size={18} />
              </a>
            ) : (
              <span className="admin-speed-dial-action is-disabled">No registrations waiting</span>
            )}
            <button type="button" className="admin-speed-dial-action" onClick={() => changeView('attention')}>
              Needs Attention
              <Icon name="arrowRight" size={18} />
            </button>
            <button
              type="button"
              className="admin-speed-dial-action"
              onClick={() => {
                changeView('clinics');
                setFilters((f) => ({ ...f, status: 'suspended' }));
              }}
            >
              Suspended Clinics
              <Icon name="arrowRight" size={18} />
            </button>
          </div>
        </section>
      </div>

      {showChecklist && <ChecklistModal onClose={() => setShowChecklist(false)} />}

      {reactivating && (
        <ConfirmDialog
          title={`Reactivate ${reactivating.name}?`}
          message="The clinic can take bookings again and, if its owner has published it, appears in the directory."
          confirmLabel="Reactivate clinic"
          isBusy={reactivate.isPending}
          error={reactivate.error}
          onConfirm={() => reactivate.mutate()}
          onCancel={() => setReactivating(null)}
        />
      )}

      {suspending && (
        <Modal title={`Suspend ${suspending.name}?`} onClose={() => setSuspending(null)}>
          <p className="portal-confirm-message">The clinic disappears from the directory and cannot take new bookings until it is reactivated.</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              suspend.mutate();
            }}
          >
            <Field label="Reason (recorded in the audit log)" as="textarea" required value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
            <FormError error={suspend.error} />
            <div className="portal-form-actions">
              <button type="button" className="btn btn-outline" onClick={() => setSuspending(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-danger" disabled={!reason.trim() || suspend.isPending}>
                {suspend.isPending ? 'Suspending…' : 'Suspend clinic'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function AdminClinicsPage() {
  return (
    <AdminLayout activeHref={ADMIN_CLINICS_HREF}>
      <VerificationContent />
    </AdminLayout>
  );
}

export default AdminClinicsPage;
