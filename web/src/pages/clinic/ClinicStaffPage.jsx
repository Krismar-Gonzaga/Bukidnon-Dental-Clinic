import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinic, useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { getPositionLabel, InviteByEmailModal } from '../../components/clinic/ClinicAdminUi';
import { FilterSelect, InitialsTile, Pill, SearchInput } from '../../components/clinic/ClinicUi';
import { ConfirmDialog, Field, FormError, Modal } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { CLINIC_ROLE_LABELS, getClinicHref } from '../../config/clinicNavigation';
import { getMembers, resetMemberPassword, updateMember } from '../../services/clinicPortalApi';
import { useAuth } from '../../auth/AuthContext';
import { WEEK_DAYS } from './frontDesk';
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

// Role and work phone of one member. The API refuses changes that would
// leave the clinic without an active administrator.
function EditModal({ member, onClose }) {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ role: member.role, phone: member.phone ?? '' });
  const [days, setDays] = useState(member.work_schedule?.days ?? []);
  const [hours, setHours] = useState({ starts_at: member.work_schedule?.starts_at ?? '08:00', ends_at: member.work_schedule?.ends_at ?? '17:00' });
  const update = useMutation({
    mutationFn: () =>
      updateMember(clinicId, member.id, {
        role: form.role,
        phone: form.phone.trim() || null,
        ...(form.role === 'staff' ? { work_schedule: days.length > 0 ? { days, ...hours } : null } : {}),
      }),
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
            hint="Roles decide what each person can see. Only dentists and clinic administrators can read clinical records, and every view is logged. Staff see allergy and condition alerts only."
          />
          <Field label="Work phone" type="tel" className="is-wide" maxLength={30} value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          {form.role === 'staff' && (
            <>
              <div className="is-wide">
                <p className="portal-field-label">Working days</p>
                <div className="clinic-chips">
                  {WEEK_DAYS.map(({ day, label }) => (
                    <button
                      key={day}
                      type="button"
                      className={`clinic-chip-button${days.includes(day) ? ' is-active' : ''}`}
                      aria-pressed={days.includes(day)}
                      onClick={() => setDays((list) => (list.includes(day) ? list.filter((d) => d !== day) : [...list, day]))}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <Field label="Start time" type="time" required={days.length > 0} value={hours.starts_at} onChange={(e) => setHours((h) => ({ ...h, starts_at: e.target.value }))} />
              <Field label="End time" type="time" required={days.length > 0} value={hours.ends_at} onChange={(e) => setHours((h) => ({ ...h, ends_at: e.target.value }))} />
            </>
          )}
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
    mutationFn: () => (isReset ? resetMemberPassword(clinicId, member.id) : updateMember(clinicId, member.id, { status: isSuspend ? 'suspended' : 'active' })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
      onClose();
    },
  });

  return (
    <ConfirmDialog
      title={isReset ? 'Reset Password' : `${isSuspend ? 'Deactivate' : 'Activate'} ${member.name}?`}
      message={
        isReset
          ? `A password reset link will be sent to ${member.email}. ${member.name} will be asked to set a new password.`
          : isSuspend
            ? 'They lose access to this clinic immediately. Their account and history are kept.'
            : 'They can use this clinic again with their current role.'
      }
      confirmLabel={isReset ? 'Send Reset Link' : isSuspend ? 'Deactivate' : 'Activate'}
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
                        <td data-label="Name">
                          <div className="clinic-cell-person">
                            <InitialsTile name={m.name} size="sm" tone="soft" />
                            <span className="clinic-cell-title">{m.name}</span>
                          </div>
                        </td>
                        <td data-label="Role">{getPositionLabel(m.position) ?? CLINIC_ROLE_LABELS[m.role] ?? m.role}</td>
                        <td data-label="Email">{m.email}</td>
                        <td data-label="Phone">{m.phone || '—'}</td>
                        <td data-label="Status">
                          <Pill tone={STATUS_TONES[m.status]}>{STATUS_LABELS[m.status] ?? m.status}</Pill>
                        </td>
                        <td data-label="Last Active">{lastActiveLabel(m.last_active_at)}</td>
                        <td data-label="" className="is-end">
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
  const { clinicId, membership, can } = useClinicAccess();
  // ?search= comes from the global search's staff results.
  const [searchParams] = useSearchParams();
  const urlSearch = searchParams.get('search') ?? '';
  const [search, setSearch] = useState(urlSearch);
  useEffect(() => setSearch(urlSearch), [urlSearch]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [inviting, setInviting] = useState(false);
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
          <button type="button" className="btn btn-outline clinic-header-button" onClick={() => setInviting(true)}>
            <Icon name="mail" size={18} />
            Invite by Email
          </button>
          <a href={`${getClinicHref(clinicId, 'staff')}/new`} className="btn btn-primary clinic-header-button">
            <Icon name="userPlus" size={18} />
            Add Staff
          </a>
        </>
      }
    >
      <StaffDirectory query={query} search={search} setSearch={setSearch} roleFilter={roleFilter} setRoleFilter={setRoleFilter} />
      {inviting && <InviteByEmailModal clinicId={clinicId} clinicName={membership?.clinic_name} role="staff" title="Invite by Email" onClose={() => setInviting(false)} />}
    </ClinicLayout>
  );
}

export default ClinicStaffPage;
