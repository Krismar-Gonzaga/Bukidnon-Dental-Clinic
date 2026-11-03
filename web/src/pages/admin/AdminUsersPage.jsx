import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import { Badge, DataTable, Field, FormError, Modal, Section } from '../../components/portal/PortalUi';
import { useSensitiveAction } from '../../components/admin/AdminSecurity';
import Pagination from '../../components/Pagination';
import { QueryState } from '../../components/StatusMessage';
import { ADMIN_USERS_HREF, USER_ROLE_LABELS } from '../../config/adminNavigation';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useAuth } from '../../auth/AuthContext';
import { getUsers, updateUser } from '../../services/adminApi';
import { formatDate } from '../../utils/dateTime';

const ROLE_OPTIONS = Object.entries(USER_ROLE_LABELS).map(([value, label]) => ({ value, label }));

/** Plain-language summary of a change, shown before it is saved. */
export function describeChange(user, form) {
  const changes = [];
  if (form.role !== user.role) {
    changes.push(`Change account type from ${USER_ROLE_LABELS[user.role] ?? user.role} to ${USER_ROLE_LABELS[form.role] ?? form.role}.`);
    if (form.role === 'system_admin') changes.push('They will be able to approve clinics, suspend accounts and read the audit log.');
  }
  if (form.status !== user.status) {
    changes.push(form.status === 'suspended' ? 'Suspend the account and sign them out on every device.' : 'Reactivate the account so they can sign in again.');
  }
  return changes;
}

// Account management. Suspending signs the user out everywhere. Clinic
// access itself is managed by each clinic (Staff page), not here. Saving
// asks for confirmation, then for the password (useSensitiveAction).
function UsersDirectory() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const runSensitive = useSensitiveAction();
  // ?search= and ?status= come from the top-bar search and the dashboard.
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({ search: searchParams.get('search') ?? '', role: '', status: searchParams.get('status') ?? '' });
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [form, setForm] = useState({ role: '', status: '', reason: '' });
  const search = useDebouncedValue(filters.search);

  const query = useQuery({
    queryKey: ['admin', 'users', search, filters.role, filters.status, page],
    queryFn: () => getUsers({ search: search || undefined, role: filters.role || undefined, status: filters.status || undefined, page }),
    placeholderData: keepPreviousData,
  });
  const save = useMutation({
    mutationFn: () => {
      const body = {};
      if (form.role !== editing.role) body.role = form.role;
      if (form.status !== editing.status) {
        body.status = form.status;
        body.reason = form.reason.trim() || undefined;
      }
      return runSensitive(() => updateUser(editing.id, body));
    },
    onSuccess: () => {
      setEditing(null);
      setReviewing(false);
      queryClient.invalidateQueries({ queryKey: ['admin'] });
    },
  });
  const setFilter = (name) => (e) => {
    setFilters((f) => ({ ...f, [name]: e.target.value }));
    setPage(1);
  };

  return (
    <>
      <Section title="Accounts">
        <div className="portal-toolbar">
          <Field label="Search" type="search" placeholder="Name or email" value={filters.search} onChange={setFilter('search')} />
          <Field label="Account type" as="select" options={[{ value: '', label: 'All' }, ...ROLE_OPTIONS]} value={filters.role} onChange={setFilter('role')} />
          <Field label="Status" as="select" options={[{ value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]} value={filters.status} onChange={setFilter('status')} />
        </div>
        <QueryState query={query} loadingLabel="Loading users…">
          {({ items, meta }) => (
            <>
              <DataTable
                caption="Users"
                rows={items}
                columns={[
                  { key: 'name', label: 'Name' },
                  { key: 'email', label: 'Email' },
                  { key: 'role', label: 'Account type', render: (u) => USER_ROLE_LABELS[u.role] ?? u.role },
                  { key: 'clinic_memberships', label: 'Clinics' },
                  { key: 'status', label: 'Status', render: (u) => <Badge status={u.status} /> },
                  { key: 'created_at', label: 'Joined', render: (u) => formatDate(u.created_at) },
                  {
                    key: 'edit',
                    label: '',
                    render: (u) =>
                      u.id !== me?.id && (
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setEditing(u);
                            setForm({ role: u.role, status: u.status, reason: '' });
                            setReviewing(false);
                            save.reset();
                          }}
                        >
                          Manage
                        </button>
                      ),
                  },
                ]}
              />
              <Pagination currentPage={page} pageCount={meta.last_page ?? 1} onPageChange={setPage} label="User pages" />
            </>
          )}
        </QueryState>
      </Section>

      {editing && (
        <Modal title={`Manage ${editing.name}`} onClose={() => setEditing(null)}>
          <form onSubmit={(e) => { e.preventDefault(); if (reviewing) save.mutate(); else setReviewing(true); }}>
            <fieldset className="portal-record-fields" disabled={reviewing}>
            <div className="portal-form-grid">
              <Field
                label="Account type"
                as="select"
                options={ROLE_OPTIONS}
                hint="Changing to System Admin grants platform administration."
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
              />
              <Field
                label="Status"
                as="select"
                options={[{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]}
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              />
              {form.status === 'suspended' && editing.status !== 'suspended' && (
                <Field label="Reason (recorded in the audit log)" as="textarea" required maxLength={500} className="is-wide" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
              )}
            </div>
            </fieldset>
            {reviewing && (
              <div className="portal-confirm-box" role="alert">
                <p className="portal-confirm-message">Please confirm:</p>
                <ul className="portal-confirm-message">
                  {describeChange(editing, form).map((line) => <li key={line}>{line}</li>)}
                </ul>
              </div>
            )}
            <FormError error={save.error} />
            <div className="portal-form-actions">
              <button type="button" className="btn btn-outline" onClick={() => (reviewing ? setReviewing(false) : setEditing(null))} disabled={save.isPending}>
                {reviewing ? 'Back' : 'Cancel'}
              </button>
              <button
                type="submit"
                className={`btn ${reviewing && form.status === 'suspended' ? 'btn-danger' : 'btn-primary'}`}
                disabled={save.isPending || (form.role === editing.role && form.status === editing.status)}
              >
                {save.isPending ? 'Saving…' : reviewing ? 'Confirm change' : 'Save'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}

function AdminUsersPage() {
  return (
    <AdminLayout title="Users" activeHref={ADMIN_USERS_HREF}>
      <UsersDirectory />
    </AdminLayout>
  );
}

export default AdminUsersPage;
