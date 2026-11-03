import AdminLayout, { useSystemHealth } from '../../layouts/AdminLayout';
import Icon from '../../components/Icon';
import { Badge, Section } from '../../components/portal/PortalUi';
import { ErrorState, LoadingState } from '../../components/StatusMessage';
import { ADMIN_AUDIT_HREF, ADMIN_PASSWORD_HREF, ADMIN_PROFILE_HREF, ADMIN_SETTINGS_HREF } from '../../config/adminNavigation';
import { formatDateTime } from '../../utils/dateTime';

const CHECK_TONES = { ok: 'success', warn: 'warning', fail: 'danger' };
const CHECK_LABELS = { ok: 'OK', warn: 'Attention', fail: 'Failing' };
const OVERALL = {
  healthy: { tone: 'success', label: 'Healthy' },
  degraded: { tone: 'warning', label: 'Needs attention' },
  down: { tone: 'danger', label: 'Service down' },
};

const SECURITY_POINTS = [
  'Approving or returning clinic registrations, suspending or reactivating clinics and accounts, changing account types and moderating reviews ask for your password again. A confirmation lasts 15 minutes and only on this device.',
  'Verification documents open through links that expire after 5 minutes; every view and download is recorded.',
  'Administrators cannot change their own account type or status, and cannot read patients’ clinical records.',
  'Sign-ins, failed sign-ins and every administrative action are written to the audit log, which cannot be edited.',
];

function SystemHealth() {
  const health = useSystemHealth();

  return (
    <Section
      title="Platform health"
      subtitle={health.data ? `Checked ${formatDateTime(health.data.checked_at)} · ${health.data.environment} environment` : 'Live checks of the services the platform needs.'}
      actions={
        <>
          {health.data && <Badge tone={OVERALL[health.data.status]?.tone}>{OVERALL[health.data.status]?.label ?? health.data.status}</Badge>}
          <button type="button" className="btn btn-outline btn-sm" onClick={() => health.refetch()} disabled={health.isFetching}>
            <Icon name="history" size={16} />
            {health.isFetching ? 'Checking…' : 'Run checks again'}
          </button>
        </>
      }
    >
      {health.isPending ? (
        <LoadingState label="Running health checks…" />
      ) : health.isError ? (
        <ErrorState error={health.error} title="Health checks could not run" onRetry={() => health.refetch()} />
      ) : (
        <ul className="portal-list">
          {health.data.checks.map((check) => (
            <li key={check.key} className="portal-list-item">
              <div className="portal-section-header">
                <strong>{check.label}</strong>
                <Badge tone={CHECK_TONES[check.status]}>{CHECK_LABELS[check.status] ?? check.status}</Badge>
              </div>
              <p className="portal-list-item-meta">{check.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function AdminSettingsPage() {
  return (
    <AdminLayout title="Settings" activeHref={ADMIN_SETTINGS_HREF}>
      <div className="portal-stack">
        <SystemHealth />
        <Section title="Security safeguards" subtitle="How the platform protects administrative actions.">
          <ul className="portal-list">
            {SECURITY_POINTS.map((point) => (
              <li key={point} className="portal-list-item">
                {point}
              </li>
            ))}
          </ul>
          <p className="portal-spaced-top">
            <a href={ADMIN_AUDIT_HREF}>Open the audit log</a>
          </p>
        </Section>
        <Section title="Your account">
          <div className="portal-actions">
            <a href={ADMIN_PROFILE_HREF} className="btn btn-outline btn-sm">
              My Profile
            </a>
            <a href={ADMIN_PASSWORD_HREF} className="btn btn-outline btn-sm">
              Change Password
            </a>
          </div>
        </Section>
      </div>
    </AdminLayout>
  );
}

export default AdminSettingsPage;
