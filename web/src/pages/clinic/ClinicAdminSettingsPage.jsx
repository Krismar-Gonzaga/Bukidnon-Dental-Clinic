import { useEffect, useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { TableFooter } from '../../components/admin/AdminData';
import { Card, NotificationPreferences, Toggle } from '../../components/clinic/ClinicAdminUi';
import { AccountSecurity } from '../../components/security/AccountSecurity';
import { Pill } from '../../components/clinic/ClinicUi';
import { Field, FormError, Modal } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { useAuth } from '../../auth/AuthContext';
import { changePassword } from '../../services/authService';
import {
  exportClinicAuditLogs,
  getClinicAuditLogs,
  getClinicSettings,
  getRolePermissions,
  updateClinicSettings,
  updateRolePermissions,
} from '../../services/clinicPortalApi';
import { formatDateTime } from '../../utils/dateTime';
import '../../components/clinic/ClinicAdminUi.css';

function SavedNote({ children }) {
  return (
    <p className="clinic-saved-note" role="status">
      <Icon name="checkCircle" size={16} />
      {children}
    </p>
  );
}

function GeneralTab() {
  const { clinicId } = useClinicAccess();
  const queryClient = useQueryClient();
  const queryKey = ['clinic', clinicId, 'clinic-settings'];
  const query = useQuery({ queryKey, queryFn: () => getClinicSettings(clinicId) });
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (query.data && !form) setForm(query.data);
  }, [query.data, form]);
  const save = useMutation({
    mutationFn: () =>
      updateClinicSettings(clinicId, {
        slot_minutes: Number(form.slot_minutes),
        allow_online_booking: form.allow_online_booking,
        require_approval: form.require_approval,
        send_reminders: form.send_reminders,
        allow_patient_cancel: form.allow_patient_cancel,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });
  const set = (name, value) => {
    save.reset();
    setForm((current) => ({ ...current, [name]: value }));
  };

  return (
    <Card title="Clinic Settings">
      <QueryState query={query} loadingLabel="Loading settings…">
        {() =>
          form && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
            >
              <div className="portal-form-grid">
                <Field label="Timezone" as="select" className="is-wide" disabled options={[{ value: form.timezone, label: form.timezone }]} value={form.timezone} onChange={() => {}} />
                <Field label="Language" as="select" className="is-wide" disabled options={[{ value: 'en', label: 'English' }]} value="en" onChange={() => {}} />
                <Field label="Date format" as="select" className="is-wide" disabled options={[{ value: 'long', label: 'July 15, 2026' }]} value="long" onChange={() => {}} />
                <Field
                  label="Appointment slot duration"
                  as="select"
                  className="is-wide"
                  options={form.slot_options.map((minutes) => ({ value: String(minutes), label: `${minutes} minutes` }))}
                  value={String(form.slot_minutes)}
                  onChange={(event) => set('slot_minutes', event.target.value)}
                />
              </div>
              <fieldset className="clinic-pref-group clinic-form-gap">
                <legend>Booking Settings</legend>
                <Toggle label="Allow online appointment bookings" checked={form.allow_online_booking} onChange={(value) => set('allow_online_booking', value)} />
                <Toggle label="Require appointment approval before confirming" checked={form.require_approval} onChange={(value) => set('require_approval', value)} />
                <Toggle label="Send reminders 24 hrs before appointment" hint="By email and in-app notification." checked={form.send_reminders} onChange={(value) => set('send_reminders', value)} />
                <Toggle label="Allow patients to cancel online" checked={form.allow_patient_cancel} onChange={(value) => set('allow_patient_cancel', value)} />
              </fieldset>
              <FormError error={save.error} />
              {save.isSuccess && <SavedNote>Settings saved.</SavedNote>}
              <button type="submit" className="btn btn-primary" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save Settings'}
              </button>
            </form>
          )
        }
      </QueryState>
    </Card>
  );
}

function PermissionsTab() {
  const { clinicId } = useClinicAccess();
  const queryClient = useQueryClient();
  const queryKey = ['clinic', clinicId, 'role-permissions'];
  const query = useQuery({ queryKey, queryFn: () => getRolePermissions(clinicId) });
  const [draft, setDraft] = useState(null);
  useEffect(() => {
    if (query.data && !draft) setDraft(Object.fromEntries(query.data.positions.map(({ key, modules }) => [key, modules])));
  }, [query.data, draft]);
  const save = useMutation({
    mutationFn: () => updateRolePermissions(clinicId, draft),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const toggle = (position, module) => {
    save.reset();
    setDraft((current) => ({
      ...current,
      [position]: current[position].includes(module) ? current[position].filter((m) => m !== module) : [...current[position], module],
    }));
  };

  return (
    <Card title="Role Permissions" subtitle="Control which modules each role can access within the clinic admin portal. Clinical records stay with dentists and clinic administrators.">
      <QueryState query={query} loadingLabel="Loading permissions…">
        {({ modules, positions }) =>
          draft && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                save.mutate();
              }}
            >
              <div className="clinic-matrix-scroll">
                <table className="clinic-matrix">
                  <caption className="visually-hidden">Modules each staff role can open</caption>
                  <thead>
                    <tr>
                      <th scope="col">Module</th>
                      <th scope="col">Admin</th>
                      {positions.map(({ key, label }) => (
                        <th key={key} scope="col">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map((module) => (
                      <tr key={module.key}>
                        <td>{module.label}</td>
                        <td>
                          <Icon name="checkCircle" size={18} title="Always allowed" />
                        </td>
                        {positions.map(({ key, label }) => (
                          <td key={key}>
                            <input type="checkbox" aria-label={`${label}: ${module.label}`} checked={draft[key].includes(module.key)} onChange={() => toggle(key, module.key)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <FormError error={save.error} />
              {save.isSuccess && <SavedNote>Permissions saved.</SavedNote>}
              <button type="submit" className="btn btn-primary clinic-form-gap" disabled={save.isPending}>
                {save.isPending ? 'Saving…' : 'Save Permissions'}
              </button>
            </form>
          )
        }
      </QueryState>
    </Card>
  );
}

const EMPTY_PASSWORD = { current: '', next: '', confirm: '' };

export function ChangePasswordCard() {
  const [form, setForm] = useState(EMPTY_PASSWORD);
  const [mismatch, setMismatch] = useState(false);
  const save = useMutation({
    mutationFn: () => changePassword({ currentPassword: form.current, newPassword: form.next }),
    onSuccess: () => setForm(EMPTY_PASSWORD),
  });
  const bind = (name) => ({ value: form[name], onChange: (event) => setForm((f) => ({ ...f, [name]: event.target.value })) });

  return (
    <Card title="Change Password">
      {save.isSuccess ? (
        <SavedNote>Password updated successfully.</SavedNote>
      ) : (
        <form
          className="clinic-password-form"
          onSubmit={(event) => {
            event.preventDefault();
            const differs = form.next !== form.confirm;
            setMismatch(differs);
            if (!differs) save.mutate();
          }}
        >
          <Field label="Current password" type="password" required autoComplete="current-password" {...bind('current')} />
          <Field label="New password" type="password" required autoComplete="new-password" {...bind('next')} />
          <Field label="Confirm new password" type="password" required autoComplete="new-password" {...bind('confirm')} />
          {mismatch && (
            <p className="portal-inline-error" role="alert">
              The new passwords do not match.
            </p>
          )}
          <FormError error={save.error} />
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      )}
    </Card>
  );
}

const AUDIT_CATEGORY_TONES = { Subscription: 'purple', Records: 'warning' };

function AuditLogTab() {
  const { clinicId } = useClinicAccess();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'audit-logs', page, perPage],
    queryFn: () => getClinicAuditLogs(clinicId, { page, per_page: perPage }),
    placeholderData: keepPreviousData,
  });
  const exportLog = useMutation({ mutationFn: () => exportClinicAuditLogs(clinicId) });

  return (
    <Card
      title="Audit Log"
      actions={
        <button type="button" className="clinic-action-button" disabled={exportLog.isPending} onClick={() => exportLog.mutate()}>
          <Icon name="download" size={16} />
          {exportLog.isPending ? 'Exporting…' : 'Export Log'}
        </button>
      }
    >
      <FormError error={exportLog.error} />
      <QueryState query={query} loadingLabel="Loading audit log…">
        {({ items, meta }) =>
          items.length === 0 ? (
            <p className="portal-empty">Nothing has been logged yet.</p>
          ) : (
            <>
              <ul className="clinic-audit-list">
                {items.map((entry) => (
                  <li key={entry.id} className="clinic-audit-row">
                    <span aria-hidden="true" />
                    <div className="clinic-audit-body">
                      <p className="clinic-file-name">{entry.detail ? `${entry.label}: ${entry.detail}` : entry.label}</p>
                      <p className="clinic-file-meta">{[entry.user_name, entry.user_role && `(${entry.user_role})`].filter(Boolean).join(' ')}</p>
                    </div>
                    <div className="clinic-audit-side">
                      {entry.category && <Pill tone={AUDIT_CATEGORY_TONES[entry.category] ?? 'info'}>{entry.category}</Pill>}
                      <span>{formatDateTime(entry.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
              <TableFooter
                meta={meta}
                perPage={perPage}
                onPerPageChange={(n) => {
                  setPerPage(n);
                  setPage(1);
                }}
                onPageChange={setPage}
                noun="entries"
                label="Audit log pages"
              />
            </>
          )
        }
      </QueryState>
    </Card>
  );
}

function ClinicAdminSettingsPage() {
  const { can } = useClinicAccess();
  const tabs = [
    can('clinic.settings.manage') && { value: 'general', label: 'General' },
    can('clinic.permissions.manage') && { value: 'permissions', label: 'Permissions' },
    { value: 'security', label: 'Security' },
    { value: 'notifications', label: 'Notifications' },
    can('clinic.audit.view') && { value: 'audit', label: 'Audit Log' },
  ].filter(Boolean);
  const [tab, setTab] = useState(tabs[0].value);

  return (
    <ClinicLayout section="clinic-settings" title="Settings" subtitle={null} requires={['clinic.settings.manage', 'clinic.permissions.manage', 'clinic.audit.view']} hideSearch>
      <div className="clinic-settings">
        <nav className="clinic-settings-nav" aria-label="Settings sections">
          {tabs.map(({ value, label }) => (
            <button key={value} type="button" className={tab === value ? 'is-active' : undefined} aria-current={tab === value ? 'page' : undefined} onClick={() => setTab(value)}>
              {label}
            </button>
          ))}
        </nav>
        <div>
          {tab === 'general' && <GeneralTab />}
          {tab === 'permissions' && <PermissionsTab />}
          {tab === 'security' && (
            <>
              <ChangePasswordCard />
              <AccountSecurity />
            </>
          )}
          {tab === 'notifications' && <NotificationPreferences />}
          {tab === 'audit' && <AuditLogTab />}
        </div>
      </div>
    </ClinicLayout>
  );
}

export default ClinicAdminSettingsPage;
