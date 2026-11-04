import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import Icon from '../../components/Icon';
import { TableFooter } from '../../components/admin/AdminData';
import { ActionDialog, StatusTag, TopbarSearch, TopbarSelect, useSearchText } from '../../components/admin/AdminUi';
import { useSensitiveAction } from '../../components/admin/AdminSecurity';
import { QueryState } from '../../components/StatusMessage';
import { ADMIN_CLINICS_HREF, CLINIC_STATUS, CLINIC_STATUS_FILTERS, getAdminApplicationHref, getAdminClinicHref } from '../../config/adminNavigation';
import { approveApplication, getClinicDirectory } from '../../services/adminApi';

const OPEN = ['pending', 'under_review'];
const PER_PAGE = 25;

function ClinicRow({ row, onApprove }) {
  const status = CLINIC_STATUS[row.status] ?? CLINIC_STATUS.pending;
  const href = row.kind === 'clinic' ? getAdminClinicHref(row.id) : getAdminApplicationHref(row.id);
  const meta = [row.city, row.admin && `Admin: ${row.admin}`, row.plan && `Plan: ${row.plan}`].filter(Boolean).join(' · ');
  const canApprove = row.kind === 'application' && OPEN.includes(row.status);

  return (
    <li className="admin-row">
      <span className="admin-row-icon" aria-hidden="true">
        <Icon name="building" size={20} />
      </span>
      <div className="admin-row-body">
        <p className="admin-row-title">
          <a href={href}>{row.name}</a>
          <StatusTag tone={status.tone}>{status.label}</StatusTag>
        </p>
        <p className="admin-row-meta">{meta}</p>
      </div>
      {canApprove && (
        <button
          type="button"
          className="admin-soft-button is-success"
          aria-label={`Approve ${row.name}`}
          disabled={row.missing_documents > 0}
          title={row.missing_documents > 0 ? 'Required documents are missing' : undefined}
          onClick={() => onApprove(row)}
        >
          Approve
        </button>
      )}
      <a href={href} className="admin-row-chevron" aria-label={`Open ${row.name}`}>
        <Icon name="chevronRight" size={18} />
      </a>
    </li>
  );
}

// Every clinic, plus the registrations still on their way to becoming one.
function AdminClinicsPage() {
  const queryClient = useQueryClient();
  const { text, setText, search } = useSearchText();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['admin', 'clinic-directory', search, status, page],
    queryFn: () => getClinicDirectory({ search: search || undefined, status: status || undefined, page, per_page: PER_PAGE }),
    placeholderData: keepPreviousData,
  });
  const total = query.data?.meta.total;

  return (
    <AdminLayout
      title="Clinic Management"
      subtitle={total == null ? undefined : `${total} registered ${total === 1 ? 'clinic' : 'clinics'}`}
      activeHref={ADMIN_CLINICS_HREF}
      headerActions={
        <>
          <TopbarSearch
            label="Search clinics"
            placeholder="Search clinics..."
            value={text}
            onChange={(value) => {
              setText(value);
              setPage(1);
            }}
          />
          <TopbarSelect
            label="Filter by status"
            value={status}
            options={CLINIC_STATUS_FILTERS}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
        </>
      }
    >
      <ClinicList query={query} onPageChange={setPage} onChanged={() => queryClient.invalidateQueries({ queryKey: ['admin'] })} />
    </AdminLayout>
  );
}

function ClinicList({ query, onPageChange, onChanged }) {
  const runSensitive = useSensitiveAction();
  const [approving, setApproving] = useState(null);
  const approve = useMutation({
    mutationFn: () => runSensitive(() => approveApplication(approving.id)),
    onSuccess: () => {
      setApproving(null);
      onChanged();
    },
  });

  return (
    <>
      <QueryState query={query} loadingLabel="Loading clinics…">
        {({ items, meta }) => (
          <>
            {items.length === 0 ? (
              <p className="admin-empty-card">No clinics match these filters.</p>
            ) : (
              <ul className="admin-rows">
                {items.map((row) => (
                  <ClinicRow
                    key={`${row.kind}-${row.id}`}
                    row={row}
                    onApprove={(next) => {
                      approve.reset();
                      setApproving(next);
                    }}
                  />
                ))}
              </ul>
            )}
            {(meta.last_page ?? 1) > 1 && <TableFooter meta={meta} perPage={PER_PAGE} onPageChange={onPageChange} noun="clinics" label="Clinic pages" />}
          </>
        )}
      </QueryState>

      {approving && (
        <ActionDialog
          title="Approve Clinic"
          message={
            <>
              Are you sure you want to <strong>approve</strong> {approving.name}? Their clinic and clinic admin access will be created.
            </>
          }
          isBusy={approve.isPending}
          error={approve.error}
          onConfirm={() => approve.mutate()}
          onCancel={() => setApproving(null)}
        />
      )}
    </>
  );
}

export default AdminClinicsPage;
