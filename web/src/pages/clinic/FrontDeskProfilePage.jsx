import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { Card, Toggle } from '../../components/clinic/ClinicAdminUi';
import { InitialsTile, PageTabs, Pill } from '../../components/clinic/ClinicUi';
import { Field, FormError, Modal } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { useAuth } from '../../auth/AuthContext';
import { updateAccount } from '../../services/authService';
import { getMyClinicDetails, updateMyClinicDetails } from '../../services/clinicPortalApi';
import { getNotificationPreferences, updateNotificationPreferences } from '../../services/notificationApi';
import { formatClockTime } from '../../utils/dateTime';
import { AccountSecurity } from '../../components/security/AccountSecurity';
import { ChangePasswordCard } from './ClinicAdminSettingsPage';
import { WEEK_DAYS } from './frontDesk';
import '../../components/clinic/ClinicAdminUi.css';
import './FrontDesk.css';

const TABS = [
  { value: 'profile', label: 'Profile' },
  { value: 'schedule', label: 'Schedule' },
  { value: 'security', label: 'Security' },
  { value: 'preferences', label: 'Preferences' },
];

const PREFERENCES = [
  { key: 'appointment_reminders', label: 'Appointment Reminders', hint: 'Get notified before appointments' },
  { key: 'check_in_alerts', label: 'Check-in Alerts', hint: 'Alert when a patient is due but not checked in' },
  { key: 'system_announcements', label: 'System Announcements', hint: 'Platform-wide notices' },
];

function EditModal({ details, clinicId, onClose }) {
  const { refresh } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: details.name ?? '', email: details.email ?? '', phone: details.phone ?? '', address: details.address ?? '' });
  const save = useMutation({
    mutationFn: async () => {
      await updateAccount({ name: form.name.trim(), email: form.email.trim() });
      await updateMyClinicDetails(clinicId, { phone: form.phone.trim() || null, address: form.address.trim() || null });
    },
    onSuccess: async () => {
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'me'] })]);
      onClose();
    },
  });
  const bind = (name) => ({ value: form[name], onChange: (event) => setForm((f) => ({ ...f, [name]: event.target.value })) });

  return (
    <Modal title="Edit Profile" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <div className="portal-form-grid">
          <Field label="Full name" required className="is-wide" autoComplete="name" maxLength={255} {...bind('name')} />
          <Field label="Email" type="email" required className="is-wide" autoComplete="email" maxLength={255} {...bind('email')} />
          <Field label="Phone" type="tel" className="is-wide" maxLength={30} {...bind('phone')} />
          <Field label="Address" className="is-wide" maxLength={255} {...bind('address')} />
        </div>
        <FormError error={save.error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ProfileTab({ details }) {
  const rows = [
    ['Name', details.name],
    ['Position', details.position_label],
    ['Clinic', details.clinic_name],
    ['Email', details.email],
    ['Phone', details.phone],
    ['Address', details.address],
  ];
  return (
    <Card>
      <dl className="frontdesk-profile-rows">
        {rows.map(([label, value]) => (
          <div key={label} style={{ display: 'contents' }}>
            <dt>{label}</dt>
            <dd>{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function ScheduleTab({ schedule }) {
  return (
    <Card title="Working Schedule">
      {schedule ? (
        <>
          <div className="frontdesk-week">
            {WEEK_DAYS.map(({ day, label }) => {
              const on = schedule.days.includes(day);
              return (
                <span key={day} className={`frontdesk-week-day${on ? ' is-on' : ''}`} aria-label={`${label}: ${on ? 'working' : 'off'}`}>
                  {label}
                </span>
              );
            })}
          </div>
          <p>
            Working hours:{' '}
            <strong>
              {formatClockTime(schedule.starts_at)} – {formatClockTime(schedule.ends_at)}
            </strong>
          </p>
        </>
      ) : (
        <p>Your clinic admin has not set your working schedule yet.</p>
      )}
      <p className="clinic-admin-card-sub clinic-form-gap">Schedule changes must be requested through Clinic Admin.</p>
    </Card>
  );
}

function PreferencesTab() {
  const queryClient = useQueryClient();
  const queryKey = ['notifications', 'preferences'];
  const query = useQuery({ queryKey, queryFn: getNotificationPreferences });
  const save = useMutation({
    mutationFn: (categories) => updateNotificationPreferences({ categories }),
    onMutate: (categories) => queryClient.setQueryData(queryKey, (current) => ({ ...current, categories })),
    onError: () => queryClient.invalidateQueries({ queryKey }),
  });

  return (
    <Card title="Notification Preferences">
      <QueryState query={query} loadingLabel="Loading preferences…">
        {(data) => {
          const categories = data?.categories ?? {};
          return (
            <>
              {PREFERENCES.map(({ key, label, hint }) => (
                <Toggle key={key} label={label} hint={hint} checked={categories[key] !== false} onChange={(value) => save.mutate({ ...categories, [key]: value })} />
              ))}
              <FormError error={save.error} />
            </>
          );
        }}
      </QueryState>
    </Card>
  );
}

/** My Profile for clinic staff: details, working schedule, password and notifications. */
function FrontDeskProfilePage() {
  const { clinicId } = useClinicAccess();
  const [tab, setTab] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);
  const query = useQuery({ queryKey: ['clinic', clinicId, 'me'], queryFn: () => getMyClinicDetails(clinicId) });
  const details = query.data;

  return (
    <ClinicLayout
      section="profile"
      title="My Profile"
      subtitle={null}
      hideSearch
      headerActions={
        tab === 'profile' &&
        details && (
          <button type="button" className="btn btn-primary clinic-header-button" onClick={() => setIsEditing(true)}>
            <Icon name="pencil" size={18} />
            Edit
          </button>
        )
      }
    >
      <QueryState query={query} loadingLabel="Loading your profile…">
        {(data) => (
          <>
            <Card>
              <div className="frontdesk-profile-head">
                <InitialsTile name={data.name} size="lg" tone="navy" />
                <div>
                  <h2 className="frontdesk-profile-name">{data.name}</h2>
                  <p className="clinic-admin-card-sub">
                    {data.position_label} · {data.clinic_name}
                  </p>
                  <Pill tone="success">{data.status === 'active' ? 'Active' : data.status}</Pill>
                </div>
              </div>
            </Card>
            <div className="clinic-form-gap">
              <PageTabs label="Profile sections" value={tab} onChange={setTab} tabs={TABS} />
            </div>
            <div className="frontdesk-profile-body">
              {tab === 'profile' && <ProfileTab details={data} />}
              {tab === 'schedule' && <ScheduleTab schedule={data.work_schedule} />}
              {tab === 'security' && (
                <div className="frontdesk-page">
                  <ChangePasswordCard />
                  <AccountSecurity />
                </div>
              )}
              {tab === 'preferences' && <PreferencesTab />}
            </div>
          </>
        )}
      </QueryState>
      {isEditing && details && <EditModal details={details} clinicId={clinicId} onClose={() => setIsEditing(false)} />}
    </ClinicLayout>
  );
}

export default FrontDeskProfilePage;
