import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import { Badge, DataTable, Field, Section } from '../../components/portal/PortalUi';
import Pagination from '../../components/Pagination';
import { QueryState } from '../../components/StatusMessage';
import { ADMIN_APPLICATIONS_HREF, getAdminApplicationHref } from '../../config/adminNavigation';
import { getApplications } from '../../services/adminApi';
import { formatDate } from '../../utils/dateTime';

const STATUSES = [
  { value: '', label: 'All submitted' },
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

function AdminApplicationsPage() {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['admin', 'applications', status, page],
    queryFn: () => getApplications({ status: status || undefined, page }),
    placeholderData: keepPreviousData,
  });

  return (
    <AdminLayout title="Clinic Verification" activeHref={ADMIN_APPLICATIONS_HREF}>
      <Section title="Applications" subtitle="Oldest submissions first.">
        <div className="portal-toolbar">
          <Field label="Status" as="select" options={STATUSES} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} />
        </div>
        <QueryState query={query} loadingLabel="Loading applications…">
          {({ items, meta }) => (
            <>
              <DataTable
                caption="Clinic applications"
                rows={items}
                emptyText="No applications in this list."
                columns={[
                  { key: 'clinic_name', label: 'Clinic' },
                  { key: 'city', label: 'City', render: (a) => a.city ?? '—' },
                  { key: 'applicant', label: 'Applicant', render: (a) => a.applicant?.name },
                  { key: 'submitted_at', label: 'Submitted', render: (a) => (a.submitted_at ? formatDate(a.submitted_at) : '—') },
                  { key: 'status', label: 'Status', render: (a) => <Badge status={a.status} /> },
                  { key: 'open', label: '', render: (a) => <a href={getAdminApplicationHref(a.id)}>Review</a> },
                ]}
              />
              <Pagination currentPage={page} pageCount={meta.last_page ?? 1} onPageChange={setPage} label="Application pages" />
            </>
          )}
        </QueryState>
      </Section>
    </AdminLayout>
  );
}

export default AdminApplicationsPage;
