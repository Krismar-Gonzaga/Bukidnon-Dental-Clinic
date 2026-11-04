import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import { Initials, TableFooter } from '../../components/admin/AdminData';
import { ActionDialog, StatusTag, TopbarSearch, TopbarSelect, formatMonthYear, useSearchText } from '../../components/admin/AdminUi';
import { useSensitiveAction } from '../../components/admin/AdminSecurity';
import { Field, FormError, Modal } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { ADMIN_USERS_HREF, USER_ROLE_LABELS, USER_ROLE_TONES } from '../../config/adminNavigation';
import { useAuth } from '../../auth/AuthContext';
import { getUsers, updateUser } from '../../services/adminApi';

const ROLE_OPTIONS = Object.entries(USER_ROLE_LABELS).map(([value, label]) => ({ value, label }));
const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
];
const PER_PAGE = 25;

/** Account type change: opened from a person's name, as the design has no column for it. */
function RoleModal({ user, onClose, onSaved }) {
  const runSensitive = useSensitiveAction();
  const [role, setRole] = useState(user.role);
  const save = useMutation({ mutationFn: () => runSensitive(() => updateUser(user.id, { role })), onSuccess: onSaved });

  return (
    <Modal title={`Change account type: ${user.name}`} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <Field
          label="Account type"
          as="select"
          options={ROLE_OPTIONS}
          hint={role === 'system_admin' ? 'They will be able to approve clinics, suspend accounts and read the audit log.' : undefined}
          value={role}
          onChange={(event) => setRole(event.target.value)}
        />
        <FormError error={save.error} />
        <div className="admin-dialog-actions">
          <button type="submit" className="btn btn-primary" disabled={save.isPending || role === user.role}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={save.isPending}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}

function UsersTable({ query, me, onPageChange, onChanged }) {
  const runSensitive = useSensitiveAction();
  const [acting, setActing] = useState(null);
  const [changingRole, setChangingRole] = useState(null);
  const isSuspended = acting?.status === 'suspended';
  const change = useMutation({
    mutationFn: (reason) =>
      runSensitive(() => updateUser(acting.id, isSuspended ? { status: 'active' } : { status: 'suspended', reason })),
    onSuccess: () => {
      setActing(null);
      onChanged();
    },
  });

  return (
    <>
      <QueryState query={query} loadingLabel="Loading users…">
        {({ items, meta }) => (
          <section className="admin-table-panel" aria-label="Users">
            <div className="admin-table-scroll">
              <table className="admin-grid">
                <caption className="visually-hidden">Users on the platform</caption>
                <thead>
                  <tr>
                    <th scope="col">User</th>
                    <th scope="col">Role</th>
                    <th scope="col">Clinic</th>
                    <th scope="col">Joined</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="admin-grid-empty">
                        No users match these filters.
                      </td>
                    </tr>
                  )}
                  {items.map((user) => {
                    const suspended = user.status === 'suspended';
                    const isMe = user.id === me?.id;
                    return (
                      <tr key={user.id}>
                        <td>
                          <div className="admin-grid-person">
                            <Initials name={user.name} square tone="primary" />
                            <div>
                              {isMe ? (
                                <p className="admin-grid-name">{user.name}</p>
                              ) : (
                                <button type="button" className="admin-grid-name is-button" aria-label={`Change account type of ${user.name}`} onClick={() => setChangingRole(user)}>
                                  {user.name}
                                </button>
                              )}
                              <p className="admin-grid-sub">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <StatusTag tone={USER_ROLE_TONES[user.role]}>{USER_ROLE_LABELS[user.role] ?? user.role}</StatusTag>
                        </td>
                        <td>{user.clinic_name ?? '—'}</td>
                        <td>{formatMonthYear(user.created_at)}</td>
                        <td>
                          <StatusTag tone={suspended ? 'warning' : 'success'}>{suspended ? 'Suspended' : 'Active'}</StatusTag>
                        </td>
                        <td>
                          {!isMe && (
                            <button
                              type="button"
                              className={`admin-soft-button ${suspended ? 'is-success' : 'is-danger'}`}
                              aria-label={`${suspended ? 'Reactivate' : 'Suspend'} ${user.name}`}
                              onClick={() => {
                                change.reset();
                                setActing(user);
                              }}
                            >
                              {suspended ? 'Reactivate' : 'Suspend'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {(meta.last_page ?? 1) > 1 && <TableFooter meta={meta} perPage={PER_PAGE} onPageChange={onPageChange} noun="users" label="User pages" />}
          </section>
        )}
      </QueryState>

      {acting && (
        <ActionDialog
          title={isSuspended ? 'Reactivate User' : 'Suspend User'}
          message={
            <>
              Are you sure you want to <strong>{isSuspended ? 'reactivate' : 'suspend'}</strong> this user account?
            </>
          }
          reasonLabel={isSuspended ? undefined : 'Reason (recorded in the audit log)'}
          isBusy={change.isPending}
          error={change.error}
          onConfirm={(reason) => change.mutate(reason)}
          onCancel={() => setActing(null)}
        />
      )}
      {changingRole && (
        <RoleModal
          user={changingRole}
          onClose={() => setChangingRole(null)}
          onSaved={() => {
            setChangingRole(null);
            onChanged();
          }}
        />
      )}
    </>
  );
}

// Suspending signs the person out everywhere and asks for the password again.
function AdminUsersPage() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { text, setText, search } = useSearchText(searchParams.get('search') ?? '');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ['admin', 'users', search, role, status, page],
    queryFn: () => getUsers({ search: search || undefined, role: role || undefined, status: status || undefined, page, per_page: PER_PAGE }),
    placeholderData: keepPreviousData,
  });
  const total = query.data?.meta.total;

  return (
    <AdminLayout
      title="User Management"
      subtitle={total == null ? undefined : `${total} ${total === 1 ? 'user' : 'users'} on the platform`}
      activeHref={ADMIN_USERS_HREF}
      headerActions={
        <>
          <TopbarSearch
            label="Search users"
            placeholder="Search users..."
            value={text}
            onChange={(value) => {
              setText(value);
              setPage(1);
            }}
          />
          <TopbarSelect
            label="Filter by role"
            value={role}
            options={[{ value: '', label: 'All' }, ...ROLE_OPTIONS]}
            onChange={(value) => {
              setRole(value);
              setPage(1);
            }}
          />
          <TopbarSelect
            label="Filter by status"
            value={status}
            options={STATUS_OPTIONS}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
          />
        </>
      }
    >
      <UsersTable query={query} me={me} onPageChange={setPage} onChanged={() => queryClient.invalidateQueries({ queryKey: ['admin'] })} />
    </AdminLayout>
  );
}

export default AdminUsersPage;
