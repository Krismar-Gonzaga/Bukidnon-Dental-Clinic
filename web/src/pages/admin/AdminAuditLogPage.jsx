import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import { DataTable, Field, Section } from '../../components/portal/PortalUi';
import Pagination from '../../components/Pagination';
import { QueryState } from '../../components/StatusMessage';
import { ADMIN_AUDIT_HREF } from '../../config/adminNavigation';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { getAuditLogs } from '../../services/adminApi';
import { formatDateTime } from '../../utils/dateTime';

// Read-only, append-only audit trail.
function AdminAuditLogPage() {
  const [filters, setFilters] = useState({ action: '', clinic_id: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const action = useDebouncedValue(filters.action);
  const query = useQuery({
    queryKey: ['admin', 'audit', action, filters.clinic_id, filters.from, filters.to, page],
    queryFn: () =>
      getAuditLogs({
        action: action || undefined,
        clinic_id: filters.clinic_id || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        page,
      }),
    placeholderData: keepPreviousData,
  });
  const setFilter = (name) => (e) => {
    setFilters((f) => ({ ...f, [name]: e.target.value }));
    setPage(1);
  };

  return (
    <AdminLayout title="Audit Log" activeHref={ADMIN_AUDIT_HREF}>
      <Section title="Security and administrative events" subtitle="Entries cannot be edited or deleted.">
        <div className="portal-toolbar">
          <Field label="Action starts with" placeholder="e.g. auth., records., clinic." value={filters.action} onChange={setFilter('action')} />
          <Field label="Clinic ID" type="number" min="1" value={filters.clinic_id} onChange={setFilter('clinic_id')} />
          <Field label="From" type="date" value={filters.from} onChange={setFilter('from')} />
          <Field label="To" type="date" value={filters.to} onChange={setFilter('to')} />
        </div>
        <QueryState query={query} loadingLabel="Loading audit log…">
          {({ items, meta }) => (
            <>
              <DataTable
                caption="Audit log"
                rows={items}
                columns={[
                  { key: 'created_at', label: 'When', render: (l) => formatDateTime(l.created_at) },
                  { key: 'action', label: 'Action' },
                  { key: 'user', label: 'By', render: (l) => l.user_name ?? (l.user_id ? `User #${l.user_id}` : 'Anonymous') },
                  { key: 'clinic_id', label: 'Clinic', render: (l) => l.clinic_id ?? '—' },
                  { key: 'subject', label: 'Subject', render: (l) => (l.subject_type ? `${l.subject_type} #${l.subject_id}` : '—') },
                  { key: 'metadata', label: 'Details', render: (l) => (l.metadata ? <code>{JSON.stringify(l.metadata)}</code> : '—') },
                  { key: 'ip_address', label: 'IP', render: (l) => l.ip_address ?? '—' },
                ]}
              />
              <Pagination currentPage={page} pageCount={meta.last_page ?? 1} onPageChange={setPage} label="Audit log pages" />
            </>
          )}
        </QueryState>
      </Section>
    </AdminLayout>
  );
}

export default AdminAuditLogPage;
