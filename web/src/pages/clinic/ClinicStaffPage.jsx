import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinic, useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { FilterSelect, InitialsTile, Pill, SearchInput } from '../../components/clinic/ClinicUi';
import { ConfirmDialog, Field, FormError, Modal } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { CLINIC_ROLE_LABELS } from '../../config/clinicNavigation';
import { requestPasswordReset } from '../../services/authService';
import { getMembers, inviteMember, updateMember } from '../../services/clinicPortalApi';
import { useAuth } from '../../auth/AuthContext';
import { addDaysToKey, businessTodayKey, formatDate, formatShortDate, formatTime, toBusinessDateKey } from '../../utils/dateTime';

const ROLE_OPTIONS = Object.entries(CLINIC_ROLE_LABELS).map(([value, label]) => ({ value, label }));

const ROLE_FILTERS = [
  { value: 'all', label: 'All roles' },
  { value: 'clinic_admin', label: 'Clinic Administrators' },
  { value: 'staff', label: 'Receptionists / Staff' },
  { value: 'inventory_staff', label: 'Inventory Staff' },
];

const STATUS_LABELS = { active: 'Active', invited: 'Invited', suspended: 'Suspended' };

const branchLabel = (member) => {
  if (member.branches == null) return 'All branches';
  return member.branches.length > 0 ? member.branches.join(', ') : 'Not scheduled yet';
};

// Also opened from the dashboard (Invite Dentist).
export function InviteModal({ onClose, title = 'Add staff member', defaultRole = 'staff' }) {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', email: '', phone: '', role: defaultRole });
  const invite = useMutation({
    mutationFn: () => inviteMember(clinicId, { ...form, phone: form.phone.trim() || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] }),
  });
  const bind = (name) => ({ value: form[name], onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });

  return (
    <Modal title={title} onClose={onClose}>
      {invite.isSuccess ? (
        <>
          <p className="portal-success" role="status">{invite.data.message}</p>
          <div className="portal-form-actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>
          </div>
        </>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); invite.mutate(); }}>
          <div className="portal-form-grid">
            <Field label="Full name" required className="is-wide" {...bind('name')} />
            <Field label="Email" type="email" required className="is-wide" {...bind('email')} />
            <Field label="Work phone (optional)" type="tel" className="is-wide" maxLength={30} {...bind('phone')} />
            <Field
              label="Role"
              as="select"
              options={ROLE_OPTIONS}
              className="is-wide"
              hint="New people get an email to set their password. Existing accounts must accept the invitation."
              {...bind('role')}
            />
          </div>
          <FormError error={invite.error} />
          <div className="portal-form-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={invite.isPending}>Add</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// Role and work phone of one member. The API refuses changes that would
// leave the clinic without an active administrator.
function EditModal({ member, onClose }) {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ role: member.role, phone: member.phone ?? '' });
  const update = useMutation({
    mutationFn: () => updateMember(clinicId, member.id, { role: form.role, phone: form.phone.trim() || null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
      onClose();
    },
  });

  return (
    <Modal title={`Edit ${member.name}`} onClose={onClose}>
      <dl className="portal-details">
        <dt>Email</dt>
        <dd>{member.email}</dd>
        <dt>Works at</dt>
        <dd>{branchLabel(member)}</dd>
        {member.joined_at && (
          <>
            <dt>Added</dt>
            <dd>{formatShortDate(member.joined_at)}</dd>
          </>
        )}
      </dl>
      <form
        className="portal-spaced-top"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate();
        }}
      >
        <div className="portal-form-grid">
          <Field
            label="Role"
            as="select"
            className="is-wide"
            options={ROLE_OPTIONS}
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            hint="Roles decide what each person can see. Receptionists cannot read clinical records; clinic admins do not see records by default."
          />
          <Field label="Work phone" type="tel" className="is-wide" maxLength={30} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <FormError error={update.error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Asks first, then suspends or restores access, or emails a password link. */
function MemberAction({ pending, onClose }) {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const { type, member } = pending;
  const isReset = type === 'reset';
  const isSuspend = member.status === 'active';
  const run = useMutation({
    mutationFn: () => (isReset ? requestPasswordReset(member.email) : updateMember(clinicId, member.id, { status: isSuspend ? 'suspended' : 'active' })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
      onClose();
    },
  });

  return (
    <ConfirmDialog
      title={isReset ? `Reset password for ${member.name}?` : `${isSuspend ? 'Deactivate' : 'Activate'} ${member.name}?`}
      message={
        isReset
          ? `A password reset link will be emailed to ${member.email}. Their current password keeps working until they change it.`
          : isSuspend
            ? 'They lose access to this clinic immediately. Their account and history are kept.'
            : 'They can use this clinic again with their current role.'
      }
      confirmLabel={isReset ? 'Send reset link' : isSuspend ? 'Deactivate' : 'Activate'}
      danger={!isReset && isSuspend}
      isBusy={run.isPending}
      error={run.error}
      onConfirm={() => run.mutate()}
      onCancel={onClose}
    />
  );
}

function lastActiveLabel(iso) {
  if (!iso) return 'Never';
  const day = toBusinessDateKey(iso);
  const today = businessTodayKey();
  if (day === today) return `Today, ${formatTime(iso)}`;
  if (day === addDaysToKey(today, -1)) return 'Yesterday';
  return formatDate(iso);
}

const STATUS_TONES = { active: 'success', invited: 'info', suspended: 'neutral' };

function StaffDirectory({ query, search, setSearch, roleFilter, setRoleFilter }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(null);
  const [pending, setPending] = useState(null);

  return (
    <div className="clinic-staff">
      <div className="clinic-toolbar">
        <SearchInput label="Search staff" placeholder="Search staff..." value={search} onChange={setSearch} />
        <FilterSelect label="Role" value={roleFilter} onChange={setRoleFilter} options={ROLE_FILTERS} />
      </div>
      <QueryState query={query} loadingLabel="Loading staff…">
        {(members) => {
          const term = search.trim().toLowerCase();
          const staff = members.filter((m) => m.role !== 'dentist');
          const visible = staff.filter((m) => (roleFilter === 'all' || m.role === roleFilter) && (!term || `${m.name} ${m.email} ${m.phone ?? ''}`.toLowerCase().includes(term)));

          return (
            <div className="clinic-data-card">
              <div className="clinic-data-scroll">
                <table className="clinic-data-table">
                  <caption className="visually-hidden">Clinic staff</caption>
                  <thead>
                    <tr>
                      <th scope="col">Name</th>
                      <th scope="col">Role</th>
                      <th scope="col">Email</th>
                      <th scope="col">Phone</th>
                      <th scope="col">Status</th>
                      <th scope="col">Last Active</th>
                      <th scope="col" className="is-end">
                        <span className="visually-hidden">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((m) => (
                      <tr key={m.id}>
                        <td>
                          <div className="clinic-cell-person">
                            <InitialsTile name={m.name} size="sm" tone="soft" />
                            <span className="clinic-cell-title">{m.name}</span>
                          </div>
                        </td>
                        <td>{CLINIC_ROLE_LABELS[m.role] ?? m.role}</td>
                        <td>{m.email}</td>
                        <td>{m.phone || '—'}</td>
                        <td>
                          <Pill tone={STATUS_TONES[m.status]}>{STATUS_LABELS[m.status] ?? m.status}</Pill>
                        </td>
                        <td>{lastActiveLabel(m.last_active_at)}</td>
                        <td className="is-end">
                          {m.user_id === user?.id ? (
                            <span className="clinic-cell-sub">You</span>
                          ) : (
                            <div className="clinic-row-actions">
                              <button type="button" className="clinic-icon-action" aria-label={`Edit ${m.name}`} onClick={() => setEditing(m)}>
                                <Icon name="pencil" size={18} />
                              </button>
                              <button type="button" className="clinic-icon-action" aria-label={`Send ${m.name} a password reset link`} onClick={() => setPending({ type: 'reset', member: m })}>
                                <Icon name="lock" size={18} />
                              </button>
                              {m.status !== 'invited' && (
                                <button
                                  type="button"
                                  className={`clinic-icon-action ${m.status === 'active' ? 'is-danger' : 'is-success'}`}
                                  aria-label={`${m.status === 'active' ? 'Deactivate' : 'Activate'} ${m.name}`}
                                  onClick={() => setPending({ type: 'status', member: m })}
                                >
                                  <Icon name={m.status === 'active' ? 'alertCircle' : 'checkCircle'} size={18} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {visible.length === 0 && (
                      <tr>
                        <td colSpan={7} className="clinic-empty-row">
                          {staff.length === 0 ? 'No staff yet. Use Add Staff to invite your team.' : 'No staff match this filter.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }}
      </QueryState>
      {editing && <EditModal member={editing} onClose={() => setEditing(null)} />}
      {pending && <MemberAction pending={pending} onClose={() => setPending(null)} />}
    </div>
  );
}

function ClinicStaffPage() {
  const { clinicId, can } = useClinicAccess();
  // ?search= comes from the global search's staff results.
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') ?? '';
  const [search, setSearch] = useState(urlSearch);
  useEffect(() => setSearch(urlSearch), [urlSearch]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [inviting, setInviting] = useState(null);
  const query = useQuery({ queryKey: ['clinic', clinicId, 'members'], queryFn: () => getMembers(clinicId), enabled: can('clinic.staff.manage') });
  const total = query.data?.filter((m) => m.role !== 'dentist').length;

  return (
    <ClinicLayout
      section="staff"
      title="Clinic Staff"
      subtitle={total == null ? 'Loading staff…' : `${total} staff ${total === 1 ? 'member' : 'members'}`}
      requires={['clinic.staff.manage']}
      hideSearch
      headerActions={
        <>
          <button type="button" className="btn btn-outline clinic-header-button" onClick={() => setInviting('Invite by email')}>
            <Icon name="mail" size={18} />
            Invite by Email
          </button>
          <button type="button" className="btn btn-primary clinic-header-button" onClick={() => setInviting('Add staff member')}>
            <Icon name="userPlus" size={18} />
            Add Staff
          </button>
        </>
      }
    >
      <StaffDirectory query={query} search={search} setSearch={setSearch} roleFilter={roleFilter} setRoleFilter={setRoleFilter} />
      {inviting && <InviteModal title={inviting} onClose={() => setInviting(null)} />}
    </ClinicLayout>
  );
}

export default ClinicStaffPage;
