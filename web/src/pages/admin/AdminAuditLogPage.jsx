import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import Icon from '../../components/Icon';
import { Modal } from '../../components/portal/PortalUi';
import { Initials, MetricCard, PageHeader, TableFooter } from '../../components/admin/AdminData';
import { useSensitiveAction } from '../../components/admin/AdminSecurity';
import { QueryState } from '../../components/StatusMessage';
import { ADMIN_AUDIT_HREF, AUDIT_CATEGORIES, AUDIT_OUTCOMES, AUDIT_RANGES, USER_ROLE_LABELS } from '../../config/adminNavigation';
import { checkAuditIntegrity, exportAuditCsv, getAuditLogs, getAuditSummary } from '../../services/adminApi';
import { getErrorMessage } from '../../services/apiErrors';
import { formatDateTime, formatShortDate, formatTimeWithSeconds } from '../../utils/dateTime';
import './AdminDashboardPage.css';
import './AdminAuditLogPage.css';

// Read-only, append-only audit trail with a tamper-evident hash chain
// (App\Services\AuditChain). Exporting needs the password re-entered.

const ROLE_OPTIONS = [...Object.entries(USER_ROLE_LABELS).map(([value, label]) => ({ value, label })), { value: 'none', label: 'Not signed in' }];
const RANGE_NAMES = { '24h': '24 hours', '7d': '7 days', '30d': '30 days' };
const EMPTY_FILTERS = { range: '24h', from: '', to: '', role: '', category: '', action: '' };

const ACTION_TONES = { failed: 'is-danger', blocked: 'is-danger' };

/** API parameters for the current filters. */
function toParams(filters) {
  const custom = filters.range === 'custom';
  return {
    range: custom || filters.range === 'all' ? undefined : filters.range,
    from: custom ? filters.from || undefined : undefined,
    to: custom ? filters.to || undefined : undefined,
    role: filters.role || undefined,
    category: filters.category || undefined,
    action: filters.action || undefined,
  };
}

function trendNote(summary, range) {
  const { total_events: total, previous_total: previous } = summary;
  const window = RANGE_NAMES[range] ? `previous ${RANGE_NAMES[range]}` : 'previous period';
  if (previous == null) return { note: 'All recorded events', icon: 'history', tone: 'muted' };
  if (previous === 0) return { note: total > 0 ? `None in the ${window}` : 'No events yet', icon: 'history', tone: 'muted' };
  const change = Math.round(((total - previous) / previous) * 100);
  return { note: `${change >= 0 ? '+' : ''}${change}% from ${window}`, icon: change >= 0 ? 'trendingUp' : 'trendingDown', tone: 'success' };
}

const INTEGRITY = {
  verified: { value: 'Verified', tone: 'success' },
  failed: { value: 'Problems Found', tone: 'danger' },
};

function Metrics({ summary, range }) {
  const data = summary.data;
  if (!data) {
    return (
      <div className="admin-metrics" aria-busy="true">
        {['Total Events', 'Failed Logins', 'Critical Actions', 'Log Integrity'].map((label) => (
          <MetricCard key={label} label={label} value="—" />
        ))}
      </div>
    );
  }
  const trend = trendNote(data, range);
  const report = data.integrity.last_report;
  const integrity = report ? INTEGRITY[report.status] : null;

  return (
    <div className="admin-metrics">
      <MetricCard label="Total Events" value={data.total_events.toLocaleString()} tone="primary" note={trend.note} noteIcon={trend.icon} noteTone={trend.tone} />
      <MetricCard
        label="Failed Logins"
        value={data.failed_logins.toLocaleString()}
        tone={data.failed_logins ? 'danger' : 'default'}
        note={`${data.blocked_logins} blocked · from ${data.failed_login_ips} ${data.failed_login_ips === 1 ? 'IP' : 'IPs'}`}
        noteIcon="shield"
      />
      <MetricCard
        label="Critical Actions"
        value={data.critical_actions.toLocaleString()}
        note="Approvals, suspensions, role changes, exports"
        noteIcon="info"
      />
      <MetricCard
        label="Log Integrity"
        value={integrity?.value ?? 'Not checked'}
        tone={integrity?.tone ?? 'default'}
        note={
          report
            ? `Checked ${formatShortDate(report.checked_at)} · ${data.integrity.unsealed} awaiting seal`
            : `${data.integrity.unsealed} entries awaiting seal`
        }
        noteIcon={report?.status === 'failed' ? 'alertTriangle' : 'shieldCheck'}
        noteTone={integrity?.tone ?? 'muted'}
      />
    </div>
  );
}

function LogTable({ items, onDetails }) {
  if (items.length === 0) return <p className="admin-empty admin-audit-empty">No events match these filters.</p>;

  return (
    <div className="admin-table-scroll">
      <table className="admin-table admin-audit-table">
        <caption className="visually-hidden">Audit log</caption>
        <thead>
          <tr>
            <th scope="col">Timestamp</th>
            <th scope="col">User</th>
            <th scope="col">Action</th>
            <th scope="col">IP Address</th>
            <th scope="col">Status</th>
            <th scope="col" className="is-end">
              <span className="visually-hidden">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((log) => {
            const outcome = AUDIT_OUTCOMES[log.outcome] ?? AUDIT_OUTCOMES.success;
            const who = log.user_name ?? (log.user_id ? `User #${log.user_id}` : 'Not signed in');
            return (
              <tr key={log.id}>
                <td>
                  <span className="admin-audit-date">{formatShortDate(log.created_at)}</span>
                  <span className="admin-cell-sub">{formatTimeWithSeconds(log.created_at)}</span>
                </td>
                <td>
                  <div className="admin-cell-person">
                    <Initials name={log.user_id ? who : '?'} tone={log.user_id ? (log.user_role === 'system_admin' ? 'neutral' : 'primary') : 'danger'} />
                    <div>
                      <p className="admin-audit-user">{who}</p>
                      <p className="admin-cell-sub">{USER_ROLE_LABELS[log.user_role] ?? (log.user_id ? 'Account' : 'Anonymous')}</p>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`admin-audit-action ${ACTION_TONES[log.outcome] ?? (log.category === 'verification' ? 'is-success' : '')}`}>{log.label}</span>
                  {(log.subject_label || log.detail) && (
                    <p className={`admin-audit-detail${log.outcome === 'success' ? '' : ' is-danger'}`}>
                      {[log.subject_label, log.detail].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </td>
                <td className="admin-mono">{log.ip_address ?? '—'}</td>
                <td>
                  <span className={`admin-audit-outcome is-${outcome.tone}`}>
                    <span className="admin-pill-dot" aria-hidden="true" />
                    {outcome.label}
                  </span>
                </td>
                <td className="is-end">
                  <button type="button" className="admin-icon-button" aria-label={`Details of event ${log.id}`} onClick={() => onDetails(log)}>
                    <Icon name="moreVertical" size={18} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EventDetails({ log, onClose }) {
  const rows = [
    ['Event ID', log.id],
    ['When', formatDateTime(log.created_at)],
    ['Action', `${log.label} (${log.action})`],
    ['Category', AUDIT_CATEGORIES.find((c) => c.value === log.category)?.label ?? '—'],
    ['Outcome', AUDIT_OUTCOMES[log.outcome]?.label ?? log.outcome],
    ['User', log.user_name ? `${log.user_name} (#${log.user_id})` : log.user_id ? `User #${log.user_id}` : 'Not signed in'],
    ['Subject', log.subject_label ?? '—'],
    ['Clinic ID', log.clinic_id ?? '—'],
    ['IP address', log.ip_address ?? '—'],
    ['Device', log.user_agent || '—'],
    ['Integrity', log.sealed ? 'Sealed in the hash chain' : 'Waiting to be sealed (within 5 minutes)'],
  ];

  return (
    <Modal title="Event details" onClose={onClose} wide>
      <dl className="admin-event-details">
        {rows.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {log.metadata && (
        <>
          <h3 className="admin-event-subtitle">Recorded details</h3>
          <pre className="admin-event-metadata">{JSON.stringify(log.metadata, null, 2)}</pre>
        </>
      )}
      <div className="portal-form-actions">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

function IntegrityReport({ report, onClose }) {
  const ok = report.status === 'verified';
  return (
    <Modal title="Integrity report" onClose={onClose} wide>
      <p className={`admin-integrity-result ${ok ? 'is-success' : 'is-danger'}`} role="status">
        <Icon name={ok ? 'shieldCheck' : 'alertTriangle'} size={20} />
        {ok ? 'No alterations detected.' : 'The audit log has been altered outside the application.'}
      </p>
      <ul className="admin-integrity-facts">
        <li>{report.checked.toLocaleString()} sealed entries re-checked</li>
        <li>{report.pending.toLocaleString()} newer entries waiting to be sealed</li>
        <li>Checked {formatDateTime(report.checked_at)}</li>
      </ul>
      {report.problems.length > 0 && (
        <>
          <h3 className="admin-event-subtitle">Problems found</h3>
          <ul className="admin-integrity-problems">
            {report.problems.map((p) => (
              <li key={`${p.type}-${p.id}`}>
                <strong>Event #{p.id}:</strong> {p.message}
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="portal-form-actions">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  );
}

function AuditLogContent() {
  const queryClient = useQueryClient();
  const runSensitive = useSensitiveAction();
  // ?action= comes from the dashboard and the top-bar search.
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, action: searchParams.get('action') ?? '' });
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [details, setDetails] = useState(null);
  const [report, setReport] = useState(null);
  const params = toParams(filters);

  const logs = useQuery({
    queryKey: ['admin', 'audit', params, page, perPage],
    queryFn: () => getAuditLogs({ ...params, page, per_page: perPage }),
    placeholderData: keepPreviousData,
  });
  const summary = useQuery({ queryKey: ['admin', 'audit', 'summary', params], queryFn: () => getAuditSummary(params), placeholderData: keepPreviousData });
  const exportCsv = useMutation({ mutationFn: () => runSensitive(() => exportAuditCsv(params)) });
  const integrity = useMutation({
    mutationFn: checkAuditIntegrity,
    onSuccess: (result) => {
      setReport(result);
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
    },
  });

  const setFilter = (name) => (e) => {
    setFilters((f) => ({ ...f, [name]: e.target.value }));
    setPage(1);
  };
  const refreshing = logs.isFetching || summary.isFetching;

  return (
    <>
      <PageHeader title="System Audit Logs" lead="Comprehensive chronological record of all administrative actions and security events.">
        <button type="button" className="btn btn-outline" disabled={exportCsv.isPending} onClick={() => exportCsv.mutate()}>
          <Icon name="download" size={18} />
          {exportCsv.isPending ? 'Exporting…' : 'Export CSV'}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={refreshing}
          onClick={() => queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] })}
        >
          <Icon name="refresh" size={18} />
          {refreshing ? 'Refreshing…' : 'Refresh Logs'}
        </button>
      </PageHeader>
      {exportCsv.isError && (
        <p className="admin-inline-status is-error" role="alert">
          {getErrorMessage(exportCsv.error)}
        </p>
      )}

      <div className="admin-filter-bar" role="search" aria-label="Filter audit log">
        <label className="admin-filter">
          <span className="admin-filter-label">Date Range</span>
          <select value={filters.range} onChange={setFilter('range')}>
            {AUDIT_RANGES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        {filters.range === 'custom' && (
          <div className="admin-filter admin-filter-dates">
            <label className="admin-filter">
              <span className="admin-filter-label">From</span>
              <input type="date" value={filters.from} max={filters.to || undefined} onChange={setFilter('from')} />
            </label>
            <label className="admin-filter">
              <span className="admin-filter-label">To</span>
              <input type="date" value={filters.to} min={filters.from || undefined} onChange={setFilter('to')} />
            </label>
          </div>
        )}
        <label className="admin-filter">
          <span className="admin-filter-label">User Role</span>
          <select value={filters.role} onChange={setFilter('role')}>
            <option value="">All Roles</option>
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-filter">
          <span className="admin-filter-label">Action Type</span>
          <select value={filters.category} onChange={setFilter('category')}>
            <option value="">All Actions</option>
            {AUDIT_CATEGORIES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn-outline admin-clear-filters"
          onClick={() => {
            setFilters(EMPTY_FILTERS);
            setPage(1);
          }}
        >
          <Icon name="sliders" size={16} />
          Clear Filters
        </button>
        {filters.action && (
          <span className="admin-chip">
            Action: {filters.action}
            <button type="button" aria-label="Remove action filter" onClick={() => setFilters((f) => ({ ...f, action: '' }))}>
              <Icon name="close" size={14} />
            </button>
          </span>
        )}
      </div>

      <Metrics summary={summary} range={filters.range} />

      <section className="admin-table-card" aria-label="Audit events">
        <QueryState query={logs} loadingLabel="Loading audit log…">
          {({ items, meta }) => (
            <>
              <LogTable items={items} onDetails={setDetails} />
              <TableFooter
                meta={meta}
                perPage={perPage}
                onPerPageChange={(n) => {
                  setPerPage(n);
                  setPage(1);
                }}
                onPageChange={setPage}
                noun="events"
                label="Audit log pages"
              />
            </>
          )}
        </QueryState>
      </section>

      <section className="admin-integrity-notice" aria-labelledby="admin-integrity-title">
        <Icon name="shieldCheck" size={24} />
        <div>
          <h2 id="admin-integrity-title" className="admin-integrity-title">
            Tamper-Evident Audit Integrity
          </h2>
          <p className="admin-integrity-text">
            Entries cannot be edited or deleted by the application or the database. New entries are sealed into a hash chain every five minutes and
            before each check: each one carries a keyed SHA-256 hash of its contents and of the entry before it, so changing or removing a sealed entry
            is detected by the integrity check.
          </p>
          <button type="button" className="admin-integrity-button" disabled={integrity.isPending} onClick={() => integrity.mutate()}>
            {integrity.isPending ? 'Checking every entry…' : 'Run Integrity Check'}
            <Icon name="arrowRight" size={14} />
          </button>
          {integrity.isError && (
            <p className="admin-inline-status is-error" role="alert">
              {getErrorMessage(integrity.error)}
            </p>
          )}
        </div>
      </section>

      {details && <EventDetails log={details} onClose={() => setDetails(null)} />}
      {report && <IntegrityReport report={report} onClose={() => setReport(null)} />}
    </>
  );
}

function AdminAuditLogPage() {
  return (
    <AdminLayout activeHref={ADMIN_AUDIT_HREF}>
      <AuditLogContent />
    </AdminLayout>
  );
}

export default AdminAuditLogPage;
