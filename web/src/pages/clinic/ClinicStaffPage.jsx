import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinic } from '../../layouts/ClinicLayout';
import { Badge, DataTable, Field, FormError, Modal, Section } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { CLINIC_ROLE_LABELS } from '../../config/clinicNavigation';
import { getMembers, inviteMember, updateMember } from '../../services/clinicPortalApi';
import { useAuth } from '../../auth/AuthContext';

const ROLE_OPTIONS = Object.entries(CLINIC_ROLE_LABELS).map(([value, label]) => ({ value, label }));

function InviteModal({ onClose }) {
  const { clinicId } = useClinic();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', email: '', role: 'staff' });
  const invite = useMutation({
    mutationFn: () => inviteMember(clinicId, form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] }),
  });
  const bind = (name) => ({ value: form[name], onChange: (e) => setForm((f) => ({ ...f, [name]: e.target.value })) });

  return (
    <Modal title="Add staff member" onClose={onClose}>
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

function Staff() {
  const { clinicId } = useClinic();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isInviting, setIsInviting] = useState(false);
  const query = useQuery({ queryKey: ['clinic', clinicId, 'members'], queryFn: () => getMembers(clinicId) });
  const update = useMutation({
    mutationFn: ({ id, body }) => updateMember(clinicId, id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] }),
  });

  return (
    <Section
      title="Staff"
      subtitle="Roles decide what each person can see. Receptionists cannot read clinical records; clinic admins do not see records by default."
      actions={<button type="button" className="btn btn-primary btn-sm" onClick={() => setIsInviting(true)}>Add staff</button>}
    >
      <QueryState query={query} loadingLabel="Loading staff…">
        {(members) => (
          <DataTable
            caption="Clinic staff"
            rows={members}
            columns={[
              { key: 'name', label: 'Name' },
              { key: 'email', label: 'Email' },
              {
                key: 'role',
                label: 'Role',
                render: (m) =>
                  m.user_id === user?.id ? (
                    CLINIC_ROLE_LABELS[m.role]
                  ) : (
                    <select
                      className="portal-field-control"
                      aria-label={`Role for ${m.name}`}
                      value={m.role}
                      disabled={update.isPending}
                      onChange={(e) => update.mutate({ id: m.id, body: { role: e.target.value } })}
                    >
                      {ROLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ),
              },
              { key: 'status', label: 'Status', render: (m) => <Badge status={m.status} /> },
              {
                key: 'actions',
                label: '',
                render: (m) =>
                  m.user_id !== user?.id &&
                  m.status !== 'invited' && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ id: m.id, body: { status: m.status === 'active' ? 'suspended' : 'active' } })}
                    >
                      {m.status === 'active' ? 'Suspend access' : 'Restore access'}
                    </button>
                  ),
              },
            ]}
          />
        )}
      </QueryState>
      <FormError error={update.error} />
      {isInviting && <InviteModal onClose={() => setIsInviting(false)} />}
    </Section>
  );
}

function ClinicStaffPage() {
  return (
    <ClinicLayout section="staff" title="Staff" requires={['clinic.staff.manage']}>
      <Staff />
    </ClinicLayout>
  );
}

export default ClinicStaffPage;
