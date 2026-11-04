import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import ClinicLayout, { useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { BackLink, Card, getPositionLabel, STAFF_POSITIONS } from '../../components/clinic/ClinicAdminUi';
import { Checkbox, Field, FormError } from '../../components/portal/PortalUi';
import { getClinicHref } from '../../config/clinicNavigation';
import { inviteMember } from '../../services/clinicPortalApi';
import '../../components/clinic/ClinicAdminUi.css';

// Matches backend config/permissions.php (staff_assignable). Clinical records are not offered.
const PERMISSIONS = [
  { key: 'appointments.view_all', label: 'View Appointments' },
  { key: 'appointments.manage', label: 'Manage Appointments' },
  { key: 'patients.view', label: 'View Patients' },
  { key: 'patients.manage', label: 'Manage Patients' },
  { key: 'patients.medical_alerts', label: 'See Medical Alerts' },
  { key: 'inventory.view', label: 'View Inventory' },
  { key: 'inventory.manage', label: 'Manage Inventory' },
  { key: 'reports.view', label: 'View Reports' },
  { key: 'clinic.staff.manage', label: 'Manage Staff' },
];

// What each position starts with; changing the ticks gives this person their own list.
const POSITION_DEFAULTS = {
  receptionist: ['appointments.view_all', 'appointments.manage', 'patients.view', 'patients.manage', 'patients.medical_alerts'],
  dental_assistant: ['appointments.view_all', 'appointments.manage', 'patients.view', 'patients.manage', 'patients.medical_alerts', 'inventory.view', 'inventory.manage'],
  dental_hygienist: ['appointments.view_all', 'appointments.manage', 'patients.view', 'patients.manage', 'patients.medical_alerts'],
  office_manager: ['appointments.view_all', 'appointments.manage', 'patients.view', 'patients.manage', 'patients.medical_alerts', 'inventory.view', 'inventory.manage', 'reports.view', 'clinic.staff.manage'],
};

const sameList = (a, b) => a.length === b.length && a.every((item) => b.includes(item));

function ClinicAddStaffPage() {
  const { clinicId, membership } = useClinicAccess();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', position: 'receptionist' });
  const [permissions, setPermissions] = useState(POSITION_DEFAULTS.receptionist);
  const backHref = getClinicHref(clinicId, 'staff');
  // Choosing what someone may do is for clinic administrators.
  const canChoosePermissions = membership?.role === 'clinic_admin';

  const send = useMutation({
    mutationFn: () =>
      inviteMember(clinicId, {
        role: 'staff',
        name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        position: form.position,
        ...(canChoosePermissions && !sameList(permissions, POSITION_DEFAULTS[form.position]) ? { permissions } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
      navigate(backHref);
    },
  });

  const bind = (name) => ({ value: form[name], onChange: (event) => setForm((f) => ({ ...f, [name]: event.target.value })) });

  return (
    <ClinicLayout section="staff" title="Add Staff Member" subtitle="Invite a staff member to your clinic" requires={['clinic.staff.manage']} hideSearch>
      <BackLink href={backHref}>Back to Staff</BackLink>
      <div className="clinic-form-page">
        <Card title="Staff Information">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              send.mutate();
            }}
          >
            <div className="portal-form-grid">
              <Field label="First name" required maxLength={120} {...bind('firstName')} />
              <Field label="Last name" required maxLength={120} {...bind('lastName')} />
              <Field label="Email address" type="email" required className="is-wide" maxLength={255} {...bind('email')} />
              <Field label="Phone number" type="tel" className="is-wide" maxLength={30} {...bind('phone')} />
              <Field
                label="Role / position"
                as="select"
                className="is-wide"
                required
                options={STAFF_POSITIONS}
                value={form.position}
                onChange={(event) => {
                  setForm((f) => ({ ...f, position: event.target.value }));
                  setPermissions(POSITION_DEFAULTS[event.target.value]);
                }}
              />
            </div>
            {canChoosePermissions && (
              <fieldset className="clinic-pref-group clinic-permission-box">
                <legend>Permissions for {getPositionLabel(form.position)}</legend>
                <div className="portal-form-grid">
                  {PERMISSIONS.map(({ key, label }) => (
                    <Checkbox
                      key={key}
                      label={label}
                      checked={permissions.includes(key)}
                      onChange={(event) => setPermissions((list) => (event.target.checked ? [...list, key] : list.filter((p) => p !== key)))}
                    />
                  ))}
                </div>
              </fieldset>
            )}
            <p className="clinic-info-note">
              <Icon name="mail" size={16} />
              An invitation email will be sent to the staff member with instructions to set up their account.
            </p>
            <FormError error={send.error} />
            <div className="clinic-form-actions">
              <a href={backHref} className="btn btn-outline">
                Cancel
              </a>
              <button type="submit" className="btn btn-primary" disabled={send.isPending}>
                {send.isPending ? 'Sending…' : 'Send Invitation'}
              </button>
            </div>
          </form>
        </Card>
      </div>
    </ClinicLayout>
  );
}

export default ClinicAddStaffPage;
