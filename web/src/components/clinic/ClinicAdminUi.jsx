import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import Icon from '../Icon';
import { Field, FormError, Modal } from '../portal/PortalUi';
import { QueryState } from '../StatusMessage';
import { getNotificationPreferences, updateNotificationPreferences } from '../../services/notificationApi';
import { getSpecializations } from '../../services/publicApi';
import { inviteMember } from '../../services/clinicPortalApi';
import './ClinicAdminUi.css';

export function BackLink({ href, children }) {
  return (
    <a href={href} className="clinic-back-link">
      <Icon name="chevronLeft" size={16} />
      {children}
    </a>
  );
}

export function Card({ title, subtitle, actions, className = '', children }) {
  return (
    <section className={`clinic-admin-card ${className}`.trim()}>
      {(title || actions) && (
        <div className="clinic-admin-card-head">
          <div>
            {title && <h2 className="clinic-admin-card-title">{title}</h2>}
            {subtitle && <p className="clinic-admin-card-sub">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function SuccessPanel({ title, children, action }) {
  return (
    <div className="clinic-success" role="status">
      <span className="clinic-success-icon">
        <Icon name="checkCircle" size={36} />
      </span>
      <h2 className="clinic-success-title">{title}</h2>
      <div className="clinic-success-text">{children}</div>
      {action}
    </div>
  );
}

export function Toggle({ label, hint, checked, disabled, onChange }) {
  return (
    <label className="clinic-toggle-row">
      <span>
        {label}
        {hint && <span className="clinic-toggle-hint">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span className="clinic-toggle" aria-hidden="true" />
    </label>
  );
}

/** "Invite by Email" for dentists and staff, with the design's confirmation step. */
export function InviteByEmailModal({ clinicId, clinicName, role, title, onClose }) {
  const queryClient = useQueryClient();
  const isDentist = role === 'dentist';
  const [form, setForm] = useState({ email: '', name: '', specialization_id: '', position: 'receptionist' });
  const specializations = useQuery({ queryKey: ['specializations', 'list'], queryFn: getSpecializations, enabled: isDentist });

  const send = useMutation({
    mutationFn: () =>
      inviteMember(clinicId, {
        email: form.email.trim(),
        name: form.name.trim() || undefined,
        role,
        ...(isDentist ? { specialization_id: form.specialization_id ? Number(form.specialization_id) : undefined } : { position: form.position }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] }),
  });

  const bind = (name) => ({ value: form[name], onChange: (event) => setForm((f) => ({ ...f, [name]: event.target.value })) });

  return (
    <Modal title={title} onClose={onClose}>
      {send.isSuccess ? (
        <SuccessPanel
          title="Invitation Sent!"
          action={
            <button type="button" className="btn btn-primary clinic-full-button" onClick={onClose}>
              Done
            </button>
          }
        >
          They will receive an email with instructions to join {clinicName}.
        </SuccessPanel>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            send.mutate();
          }}
        >
          <div className="portal-form-grid">
            <Field label="Email address" type="email" required className="is-wide" maxLength={255} placeholder={isDentist ? 'dentist@example.com' : 'staff@example.com'} {...bind('email')} />
            <Field label="Full name (optional)" className="is-wide" maxLength={255} placeholder={isDentist ? 'Dr. First Last' : 'First Last'} {...bind('name')} />
            {isDentist ? (
              <Field
                label="Specialization"
                as="select"
                className="is-wide"
                options={[{ value: '', label: 'Choose…' }, ...(specializations.data ?? []).map((s) => ({ value: String(s.id), label: s.name }))]}
                {...bind('specialization_id')}
              />
            ) : (
              <Field label="Role / position" as="select" className="is-wide" options={STAFF_POSITIONS} {...bind('position')} />
            )}
          </div>
          <p className="clinic-info-note">
            <Icon name="mail" size={16} />
            An invitation email will be sent with a secure link to join your clinic and set up their account.
          </p>
          <FormError error={send.error} />
          <div className="portal-form-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={send.isPending}>
              {send.isPending ? 'Sending…' : 'Send Invitation'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

// Matches backend config/permissions.php (staff_positions).
export const STAFF_POSITIONS = [
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'dental_assistant', label: 'Dental Assistant' },
  { value: 'dental_hygienist', label: 'Dental Hygienist' },
  { value: 'office_manager', label: 'Office Manager' },
];

export const getPositionLabel = (position) => STAFF_POSITIONS.find(({ value }) => value === position)?.label;

const PREFERENCE_GROUPS = [
  {
    title: 'Appointments',
    items: [
      { key: 'appointment_requests', label: 'New appointment requests' },
      { key: 'appointment_confirmations', label: 'Appointment confirmations' },
      { key: 'appointment_cancellations', label: 'Appointment cancellations' },
      { key: 'appointment_reminders', label: 'Appointment reminders (24 hrs before)' },
      { key: 'daily_summary', label: 'Daily appointment summary (7:00 AM)' },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { key: 'inventory_low_stock', label: 'Low stock alerts' },
      { key: 'inventory_critical', label: 'Critical stock alerts' },
      { key: 'inventory_expiry', label: 'Expiry date alerts (30 days)' },
    ],
  },
  {
    title: 'Team',
    items: [
      { key: 'team_dentists', label: 'Dentist account changes' },
      { key: 'team_staff', label: 'Staff account changes' },
      { key: 'team_password_resets', label: 'Password reset requests' },
    ],
  },
  {
    title: 'System',
    items: [
      { key: 'subscription_renewal', label: 'Subscription renewal reminders' },
      { key: 'new_reviews', label: 'New patient reviews' },
      { key: 'monthly_reports', label: 'Monthly report summaries' },
      { key: 'system_announcements', label: 'System announcements' },
    ],
  },
];

/** A member's own notification choices. Everything starts on. */
export function NotificationPreferences() {
  const queryClient = useQueryClient();
  const queryKey = ['notifications', 'preferences'];
  const query = useQuery({ queryKey, queryFn: getNotificationPreferences });
  const [draft, setDraft] = useState(null);

  useEffect(() => {
    if (query.data && draft === null) setDraft(query.data.categories ?? {});
  }, [query.data, draft]);

  const save = useMutation({
    mutationFn: () => updateNotificationPreferences({ categories: draft }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return (
    <Card title="Notification Preferences">
      <QueryState query={query} loadingLabel="Loading preferences…">
        {() =>
          draft && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
            >
              {PREFERENCE_GROUPS.map((group) => (
                <fieldset key={group.title} className="clinic-pref-group">
                  <legend>{group.title}</legend>
                  {group.items.map((item) => (
                    <Toggle
                      key={item.key}
                      label={item.label}
                      checked={draft[item.key] !== false}
                      onChange={(value) => {
                        save.reset();
                        setDraft((d) => ({ ...d, [item.key]: value }));
                      }}
                    />
                  ))}
                </fieldset>
              ))}
              <FormError error={save.error} />
              {save.isSuccess && (
                <p className="clinic-saved-note" role="status">
                  <Icon name="checkCircle" size={16} />
                  Preferences saved.
                </p>
              )}
              <button type="submit" className="btn btn-primary" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save Preferences'}
              </button>
            </form>
          )
        }
      </QueryState>
    </Card>
  );
}
