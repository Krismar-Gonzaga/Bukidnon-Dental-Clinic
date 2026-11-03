import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import Icon from '../../components/Icon';
import { Field } from '../../components/portal/PortalUi';
import Pagination from '../../components/Pagination';
import { QueryState } from '../../components/StatusMessage';
import { ADMIN_APPLICATIONS_HREF, APPLICATION_STATUS_LABELS, getAdminApplicationHref } from '../../config/adminNavigation';
import { getApplications } from '../../services/adminApi';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { formatShortDate } from '../../utils/dateTime';
import './AdminDashboardPage.css';

const STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Reviewing' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Returned' },
  { value: '', label: 'All submitted' },
];

function AdminApplicationsPage() {
  // ?status= and ?search= (top-bar search) open the queue filtered.
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState(searchParams.get('status') ?? (searchParams.get('search') ? '' : 'pending'));
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search.trim());
  const query = useQuery({
    queryKey: ['admin', 'applications', status, debounced, page],
    queryFn: () => getApplications({ status: status || undefined, search: debounced || undefined, page }),
    placeholderData: keepPreviousData,
  });
  const reset = (setter) => (e) => {
    setter(e.target.value);
    setPage(1);
  };

  return (
    <AdminLayout title="Registration Queue" activeHref={ADMIN_APPLICATIONS_HREF}>
      <section className="admin-card admin-queue" aria-labelledby="admin-queue-page-title">
        <div className="admin-card-header admin-queue-header">
          <div>
            <h2 id="admin-queue-page-title" className="admin-card-title">
              Clinic registrations
            </h2>
            <p className="admin-empty admin-queue-subtitle">Oldest submissions first. Drafts stay private to the applicant.</p>
          </div>
        </div>
        <div className="portal-toolbar admin-queue-toolbar">
          <Field label="Search" type="search" placeholder="Clinic name or city" maxLength={100} value={search} onChange={reset(setSearch)} />
          <Field label="Status" as="select" options={STATUSES} value={status} onChange={reset(setStatus)} />
        </div>
        <QueryState query={query} loadingLabel="Loading registrations…">
          {({ items, meta }) =>
            items.length === 0 ? (
              <p className="admin-empty admin-queue-empty">No registrations in this list.</p>
            ) : (
              <>
                <div className="admin-table-scroll">
                  <table className="admin-table">
                    <caption className="visually-hidden">Clinic registrations</caption>
                    <thead>
                      <tr>
                        <th scope="col">Clinic Name</th>
                        <th scope="col">Location</th>
                        <th scope="col">Applicant</th>
                        <th scope="col">Date Submitted</th>
                        <th scope="col">Status</th>
                        <th scope="col" className="is-end">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((a) => (
                        <tr key={a.id}>
                          <td className="is-strong">{a.clinic_name}</td>
                          <td>{[a.city, a.province].filter(Boolean).join(', ') || '—'}</td>
                          <td>{a.applicant?.name ?? '—'}</td>
                          <td>{a.submitted_at ? formatShortDate(a.submitted_at) : '—'}</td>
                          <td>
                            <span className={`admin-status-chip is-${a.status}`}>{APPLICATION_STATUS_LABELS[a.status] ?? a.status}</span>
                          </td>
                          <td className="is-end">
                            <a href={getAdminApplicationHref(a.id)} className="admin-icon-link" aria-label={`Review ${a.clinic_name}`}>
                              <Icon name="eye" size={20} />
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="admin-queue-pager">
                  <Pagination currentPage={page} pageCount={meta.last_page ?? 1} onPageChange={setPage} label="Registration pages" />
                </div>
              </>
            )
          }
        </QueryState>
      </section>
    </AdminLayout>
  );
}

export default AdminApplicationsPage;
