import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import { Badge, DataTable, Field, FormError, Modal, Section } from '../../components/portal/PortalUi';
import Pagination from '../../components/Pagination';
import { QueryState } from '../../components/StatusMessage';
import { ADMIN_CLINICS_HREF } from '../../config/adminNavigation';
import { getPublicClinicHref } from '../../config/navigation';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { getAdminClinics, reactivateClinic, suspendClinic } from '../../services/adminApi';

// Platform oversight of clinics; deliberately no access to their patients or records.
function AdminClinicsPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [suspending, setSuspending] = useState(null);
  const [reason, setReason] = useState('');
  const debounced = useDebouncedValue(search);
  const query = useQuery({
    queryKey: ['admin', 'clinics', status, debounced, page],
    queryFn: () => getAdminClinics({ status: status || undefined, search: debounced || undefined, page }),
    placeholderData: keepPreviousData,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin'] });
  const suspend = useMutation({
    mutationFn: () => suspendClinic(suspending.id, reason.trim()),
    onSuccess: () => {
      setSuspending(null);
      setReason('');
      refresh();
    },
  });
  const reactivate = useMutation({ mutationFn: (id) => reactivateClinic(id), onSuccess: refresh });

  return (
    <AdminLayout title="Clinics" activeHref={ADMIN_CLINICS_HREF}>
      <Section title="All clinics" subtitle="Suspending hides a clinic from the directory and stops new bookings.">
        <div className="portal-toolbar">
          <Field label="Search" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <Field
            label="Status"
            as="select"
            options={[{ value: '', label: 'All' }, 'approved', 'pending', 'suspended'].map((o) => (typeof o === 'string' ? { value: o, label: o } : o))}
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          />
        </div>
        <QueryState query={query} loadingLabel="Loading clinics…">
          {({ items, meta }) => (
            <>
              <DataTable
                caption="Clinics"
                rows={items}
                columns={[
                  { key: 'name', label: 'Clinic', render: (c) => (c.is_published && c.status === 'approved' ? <a href={getPublicClinicHref(c.id)} target="_blank" rel="noreferrer">{c.name}</a> : c.name) },
                  { key: 'city', label: 'City' },
                  { key: 'status', label: 'Status', render: (c) => <Badge status={c.status} /> },
                  { key: 'is_published', label: 'Listed', render: (c) => (c.is_published ? 'Yes' : 'No') },
                  { key: 'members_count', label: 'Staff' },
                  { key: 'branches_count', label: 'Branches' },
                  {
                    key: 'actions',
                    label: '',
                    render: (c) =>
                      c.status === 'suspended' ? (
                        <button type="button" className="btn btn-outline btn-sm" disabled={reactivate.isPending} onClick={() => reactivate.mutate(c.id)}>Reactivate</button>
                      ) : (
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => setSuspending(c)}>Suspend</button>
                      ),
                  },
                ]}
              />
              <Pagination currentPage={page} pageCount={meta.last_page ?? 1} onPageChange={setPage} label="Clinic pages" />
            </>
          )}
        </QueryState>
        <FormError error={reactivate.error} />
      </Section>

      {suspending && (
        <Modal title={`Suspend ${suspending.name}?`} onClose={() => setSuspending(null)}>
          <form onSubmit={(e) => { e.preventDefault(); suspend.mutate(); }}>
            <Field label="Reason (recorded in the audit log)" as="textarea" required value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
            <FormError error={suspend.error} />
            <div className="portal-form-actions">
              <button type="button" className="btn btn-outline" onClick={() => setSuspending(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={!reason.trim() || suspend.isPending}>Suspend clinic</button>
            </div>
          </form>
        </Modal>
      )}
    </AdminLayout>
  );
}

export default AdminClinicsPage;
