import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import Icon from '../../components/Icon';
import { TableFooter } from '../../components/admin/AdminData';
import { StatusTag, TopbarSearch, TopbarSelect, useSearchText } from '../../components/admin/AdminUi';
import { useSensitiveAction } from '../../components/admin/AdminSecurity';
import { Modal } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { ADMIN_AUDIT_HREF, AUDIT_CATEGORIES, AUDIT_OUTCOMES, USER_ROLE_LABELS } from '../../config/adminNavigation';
import { checkAuditIntegrity, exportAuditCsv, getAuditLogs } from '../../services/adminApi';
import { getErrorMessage } from '../../services/apiErrors';
import { formatDate, formatDateTime, formatTime } from '../../utils/dateTime';

// Read-only, append-only audit trail with a tamper-evident hash chain
// (App\Services\AuditChain). Exporting needs the password re-entered.

const PER_PAGE = 25;
const whoOf = (log) => log.user_name ?? (log.user_id ? `User #${log.user_id}` : 'Not signed in');
const roleOf = (log) => USER_ROLE_LABELS[log.user_role] ?? (log.user_id ? 'Account' : 'Anonymous');
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function LogDetails({ log, onClose }) {
  const outcome = AUDIT_OUTCOMES[log.outcome] ?? AUDIT_OUTCOMES.success;
  const rows = [
    ['Date & Time', formatDateTime(log.created_at)],
    ['User', whoOf(log)],
    ['Role', roleOf(log)],
    ['Action', log.label],
    ['Module', log.module ?? '—'],
    ['Record', log.subject_label ?? '—'],
    ['Status', capitalize(outcome.label)],
    log.detail && ['Details', log.detail],
    ['IP Address', log.ip_address ?? '—'],
    ['Device', log.user_agent || '—'],
    ['Integrity', log.sealed ? 'Sealed in the hash chain' : 'Waiting to be sealed (within 5 minutes)'],
  ].filter(Boolean);

  return (
    <Modal title="Log Details" onClose={onClose}>
      <dl className="admin-info-list is-lined">
        {rows.map(([term, value]) => (
          <div key={term}>
            <dt>{term}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </Modal>
  );
}

function IntegrityReport({ report, onClose }) {
  const ok = report.status === 'verified';
  return (
    <Modal title="Integrity Report" onClose={onClose}>
      <p className={`admin-result-note ${ok ? 'is-success' : 'is-danger'}`} role="status">
        <Icon name={ok ? 'shieldCheck' : 'alertTriangle'} size={18} />
        {ok ? 'No alterations detected.' : 'The audit log has been altered outside the application.'}
      </p>
      <p className="admin-muted admin-spaced-top">
        {report.checked.toLocaleString()} sealed entries re-checked. {report.pending.toLocaleString()} newer entries are waiting to be sealed. Checked{' '}
        {formatDateTime(report.checked_at)}.
      </p>
      {report.problems.length > 0 && (
        <ul className="admin-integrity-problems">
          {report.problems.map((problem) => (
            <li key={`${problem.type}-${problem.id}`}>
              <strong>Event #{problem.id}:</strong> {problem.message}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function AuditTable({ query, onPageChange, exportError }) {
  const queryClient = useQueryClient();
  const [details, setDetails] = useState(null);
  const [report, setReport] = useState(null);
  const integrity = useMutation({
    mutationFn: checkAuditIntegrity,
    onSuccess: (result) => {
      setReport(result);
      queryClient.invalidateQueries({ queryKey: ['admin', 'audit'] });
    },
  });

  return (
    <>
      {exportError && (
        <p className="portal-inline-error" role="alert">
          {exportError}
        </p>
      )}
      <QueryState query={query} loadingLabel="Loading audit log…">
        {({ items, meta }) => (
          <section className="admin-table-panel" aria-label="Audit log">
            <div className="admin-table-scroll">
              <table className="admin-grid">
                <caption className="visually-hidden">Audit log</caption>
                <thead>
                  <tr>
                    <th scope="col">Date &amp; Time</th>
                    <th scope="col">User</th>
                    <th scope="col">Role</th>
                    <th scope="col">Action</th>
                    <th scope="col">Module</th>
                    <th scope="col">Record</th>
                    <th scope="col">Status</th>
                    <th scope="col">
                      <span className="visually-hidden">Details</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={8} className="admin-grid-empty">
                        No log entries match these filters.
                      </td>
                    </tr>
                  )}
                  {items.map((log) => {
                    const outcome = AUDIT_OUTCOMES[log.outcome] ?? AUDIT_OUTCOMES.success;
                    return (
                      <tr key={log.id}>
                        <td className="admin-grid-muted admin-grid-nowrap">
                          {formatDate(log.created_at)} {formatTime(log.created_at)}
                        </td>
                        <td className="admin-grid-strong">{whoOf(log)}</td>
                        <td>
                          <StatusTag tone={log.user_role === 'system_admin' ? 'primary' : 'info'}>{roleOf(log)}</StatusTag>
                        </td>
                        <td>{log.label}</td>
                        <td className="admin-grid-muted">{log.module ?? '—'}</td>
                        <td>{log.subject_label ?? '—'}</td>
                        <td className={`admin-grid-outcome is-${outcome.tone}`}>{outcome.label}</td>
                        <td>
                          <button type="button" className="admin-text-button" aria-label={`View log entry ${log.id}`} onClick={() => setDetails(log)}>
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {(meta.last_page ?? 1) > 1 && <TableFooter meta={meta} perPage={PER_PAGE} onPageChange={onPageChange} noun="entries" label="Audit log pages" />}
          </section>
        )}
      </QueryState>

      <p className="admin-integrity-line">
        <Icon name="shieldCheck" size={16} />
        Entries cannot be edited or deleted, and a hash chain detects changes made outside the application.
        <button type="button" className="admin-text-button" disabled={integrity.isPending} onClick={() => integrity.mutate()}>
          {integrity.isPending ? 'Checking every entry…' : 'Run Integrity Check'}
        </button>
      </p>
      {integrity.isError && (
        <p className="portal-inline-error" role="alert">
          {getErrorMessage(integrity.error)}
        </p>
      )}

      {details && <LogDetails log={details} onClose={() => setDetails(null)} />}
      {report && <IntegrityReport report={report} onClose={() => setReport(null)} />}
    </>
  );
}

function ExportButton({ params, onError }) {
  const runSensitive = useSensitiveAction();
  const exportCsv = useMutation({
    mutationFn: () => runSensitive(() => exportAuditCsv(params)),
    onMutate: () => onError(''),
    onError: (error) => onError(getErrorMessage(error)),
  });

  return (
    <button type="button" className="btn btn-outline" disabled={exportCsv.isPending} onClick={() => exportCsv.mutate()}>
      <Icon name="download" size={18} />
      {exportCsv.isPending ? 'Exporting…' : 'Export'}
    </button>
  );
}

function AdminAuditLogPage() {
  const [searchParams] = useSearchParams();
  const { text, setText, search } = useSearchText(searchParams.get('search') ?? '');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [exportError, setExportError] = useState('');
  const params = { search: search || undefined, category: category || undefined };

  const query = useQuery({
    queryKey: ['admin', 'audit', params, page],
    queryFn: () => getAuditLogs({ ...params, page, per_page: PER_PAGE }),
    placeholderData: keepPreviousData,
  });
  const total = query.data?.meta.total;

  return (
    <AdminLayout
      title="Audit Logs"
      subtitle={total == null ? undefined : `${total.toLocaleString()} log ${total === 1 ? 'entry' : 'entries'}`}
      activeHref={ADMIN_AUDIT_HREF}
      headerActions={
        <>
          <TopbarSearch
            label="Search logs"
            placeholder="Search logs..."
            value={text}
            onChange={(value) => {
              setText(value);
              setPage(1);
            }}
          />
          <TopbarSelect
            label="Filter by module"
            value={category}
            options={[{ value: '', label: 'All' }, ...AUDIT_CATEGORIES]}
            onChange={(value) => {
              setCategory(value);
              setPage(1);
            }}
          />
          <ExportButton params={params} onError={setExportError} />
        </>
      }
    >
      <AuditTable query={query} onPageChange={setPage} exportError={exportError} />
    </AdminLayout>
  );
}

export default AdminAuditLogPage;
