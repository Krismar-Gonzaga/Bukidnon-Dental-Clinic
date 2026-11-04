import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import Icon from '../../components/Icon';
import { Initials, SegmentedTabs } from '../../components/admin/AdminData';
import { StatusTag } from '../../components/admin/AdminUi';
import { Card } from '../../components/clinic/ClinicAdminUi';
import { Field, FormError } from '../../components/portal/PortalUi';
import { AccountSecurity } from '../../components/security/AccountSecurity';
import { QueryState } from '../../components/StatusMessage';
import { useAuth } from '../../auth/AuthContext';
import { ADMIN_PROFILE_HREF } from '../../config/adminNavigation';
import { changePassword, updateAccount } from '../../services/authService';
import { getFieldErrors } from '../../services/apiErrors';
import { getNotificationPreferences, updateNotificationPreferences } from '../../services/notificationApi';
import { getPasswordRuleError } from '../../utils/passwordStrength';

const TABS = [
  { value: 'profile', label: 'Profile' },
  { value: 'security', label: 'Security' },
  { value: 'notifications', label: 'Notifications' },
];

const ROLE = 'System Administrator';

const PREFERENCES = [
  { key: 'admin_new_clinic_registrations', label: 'New Clinic Registrations', hint: 'Alert when a new clinic registers' },
  { key: 'admin_verification_requests', label: 'Verification Requests', hint: 'Alert on new verification submissions' },
  { key: 'admin_payment_submissions', label: 'Payment Submissions', hint: 'Alert when proof of payment is submitted' },
  { key: 'admin_system_alerts', label: 'System Errors & Alerts', hint: 'Critical platform alerts' },
];

function ProfileDetails({ user, editing, onDone }) {
  const { refresh } = useAuth();
  const [form, setForm] = useState({ name: user.name ?? '', email: user.email ?? '', phone: user.phone ?? '' });
  const save = useMutation({
    mutationFn: () => updateAccount(form),
    onSuccess: async () => {
      await refresh();
      onDone();
    },
  });
  const errors = getFieldErrors(save.error);
  const bind = (name) => ({
    value: form[name],
    error: errors[name],
    onChange: (event) => setForm((current) => ({ ...current, [name]: event.target.value })),
  });

  if (!editing) {
    return (
      <Card className="admin-profile-card">
        <dl className="admin-info-list is-lined">
          <div>
            <dt>Name</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{ROLE}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>{user.phone || '—'}</dd>
          </div>
        </dl>
      </Card>
    );
  }

  return (
    <Card className="admin-profile-card">
      <form
        className="admin-form"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Name" required autoComplete="name" maxLength={255} {...bind('name')} />
        <Field label="Email" type="email" required autoComplete="email" maxLength={255} {...bind('email')} />
        <Field label="Phone" type="tel" autoComplete="tel" maxLength={20} {...bind('phone')} />
        <FormError error={save.error} />
        <div className="admin-form-actions">
          <button type="button" className="btn btn-outline" onClick={onDone} disabled={save.isPending}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Card>
  );
}

const EMPTY_PASSWORD = { current: '', next: '', confirm: '' };

// Changing the password signs out the account's other devices; this session stays signed in.
function ChangePasswordCard() {
  const [form, setForm] = useState(EMPTY_PASSWORD);
  const [problem, setProblem] = useState('');
  const change = useMutation({
    mutationFn: () => changePassword({ currentPassword: form.current, newPassword: form.next }),
    onSuccess: () => setForm(EMPTY_PASSWORD),
  });
  const bind = (name) => ({
    value: form[name],
    onChange: (event) => {
      setProblem('');
      setForm((current) => ({ ...current, [name]: event.target.value }));
    },
  });
  const submit = (event) => {
    event.preventDefault();
    const ruleError = getPasswordRuleError(form.next, 'New password');
    if (ruleError || form.next !== form.confirm) {
      setProblem(ruleError || 'New passwords do not match.');
      return;
    }
    change.mutate();
  };

  return (
    <Card title="Change Password" className="admin-profile-card">
      <form className="admin-form" onSubmit={submit}>
        <Field label="Current Password" type="password" required autoComplete="current-password" {...bind('current')} />
        <Field label="New Password" type="password" required autoComplete="new-password" {...bind('next')} />
        <Field label="Confirm New Password" type="password" required autoComplete="new-password" {...bind('confirm')} />
        {problem && (
          <p className="portal-inline-error" role="alert">
            {problem}
          </p>
        )}
        <FormError error={change.error} />
        {change.isSuccess && (
          <p className="portal-success" role="status">
            Password updated. Your other devices were signed out.
          </p>
        )}
        <button type="submit" className="btn btn-primary admin-full-button" disabled={change.isPending}>
          {change.isPending ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </Card>
  );
}

function NotificationsCard() {
  const queryClient = useQueryClient();
  const queryKey = ['notifications', 'preferences'];
  const query = useQuery({ queryKey, queryFn: getNotificationPreferences });
  const [categories, setCategories] = useState(null);

  useEffect(() => {
    if (query.data && categories === null) setCategories(query.data.categories ?? {});
  }, [query.data, categories]);

  const save = useMutation({
    mutationFn: (next) => updateNotificationPreferences({ categories: next }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const toggle = (key, value) => {
    const next = { ...categories, [key]: value };
    setCategories(next);
    save.mutate({ [key]: value });
  };

  return (
    <Card title="Notification Preferences" className="admin-profile-card">
      <QueryState query={query} loadingLabel="Loading preferences…">
        {() =>
          categories && (
            <div className="admin-form">
              {PREFERENCES.map((item) => (
                <label key={item.key} className="admin-switch-row">
                  <span>
                    <span className="admin-switch-label">{item.label}</span>
                    <span className="admin-switch-hint">{item.hint}</span>
                  </span>
                  <input type="checkbox" role="switch" checked={categories[item.key] !== false} onChange={(event) => toggle(item.key, event.target.checked)} />
                  <span className="admin-switch" aria-hidden="true" />
                </label>
              ))}
              <FormError error={save.error} />
            </div>
          )
        }
      </QueryState>
    </Card>
  );
}

function AdminProfilePage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const [tab, setTab] = useState(TABS.some((option) => option.value === requested) ? requested : 'profile');
  const [editing, setEditing] = useState(false);

  return (
    <AdminLayout
      title="My Profile"
      activeHref={ADMIN_PROFILE_HREF}
      headerActions={
        tab === 'profile' && !editing ? (
          <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
            <Icon name="pencil" size={18} />
            Edit
          </button>
        ) : null
      }
    >
      <div className="admin-stack">
        <section className="admin-profile-hero" aria-label="Your account">
          <span className="admin-profile-avatar">
            <Initials name={user?.name} tone="primary" square />
          </span>
          <div>
            <h2 className="admin-detail-name">{user?.name}</h2>
            <p className="admin-detail-sub">{ROLE}</p>
            <p className="admin-profile-tags">
              <StatusTag tone="primary">System Admin</StatusTag>
              <StatusTag tone="success">Active</StatusTag>
            </p>
          </div>
        </section>

        <div className="admin-tabs-row">
          <SegmentedTabs label="Profile sections" value={tab} tabs={TABS} onChange={setTab} />
        </div>

        {tab === 'profile' && <ProfileDetails user={user ?? {}} editing={editing} onDone={() => setEditing(false)} />}
        {tab === 'security' && (
          <>
            <ChangePasswordCard />
            <AccountSecurity />
          </>
        )}
        {tab === 'notifications' && <NotificationsCard />}
      </div>
    </AdminLayout>
  );
}

export default AdminProfilePage;
