import { useQuery } from '@tanstack/react-query';
import AdminLayout from '../../layouts/AdminLayout';
import Icon from '../../components/Icon';
import { Card } from '../../components/clinic/ClinicAdminUi';
import { LineChart } from '../../components/clinic/ClinicCharts';
import { StatTile } from '../../components/admin/AdminUi';
import { QueryState } from '../../components/StatusMessage';
import { useAuth } from '../../auth/AuthContext';
import {
  ADMIN_APPLICATIONS_HREF,
  ADMIN_AUDIT_HREF,
  ADMIN_DASHBOARD_HREF,
  ADMIN_SUBSCRIPTIONS_HREF,
  USER_ROLE_TONES,
  getAdminApplicationHref,
  getAdminSubscriptionHref,
} from '../../config/adminNavigation';
import { getAdminDashboard } from '../../services/adminApi';
import { formatDate, formatShortDate, formatTime } from '../../utils/dateTime';
import { useBrandName } from '../../services/platformStore';

const count = (value) => new Intl.NumberFormat('en-PH').format(value ?? 0);
const OUTCOME_TONES = { success: 'success', pending: 'warning', failed: 'danger', blocked: 'danger' };
const BREAKDOWN = [
  { role: 'patient', label: 'Patients' },
  { role: 'dentist', label: 'Dentists' },
  { role: 'staff', label: 'Clinic Staff' },
  { role: 'clinic_admin', label: 'Clinic Admins' },
  { role: 'system_admin', label: 'System Admins' },
];

function Hero({ name, waiting, payments }) {
  return (
    <section className="admin-hero" aria-label="Welcome">
      <div>
        <p className="admin-hero-greeting">Welcome back,</p>
        <p className="admin-hero-name">{name}</p>
        <p className="admin-hero-text">
          <strong className="is-warning">{count(waiting)} clinic(s)</strong> pending verification. <strong className="is-success">{count(payments)} payment(s)</strong>{' '}
          awaiting review.
        </p>
      </div>
      <div className="admin-hero-actions">
        <a href={ADMIN_APPLICATIONS_HREF} className="admin-hero-button is-solid">
          <Icon name="shield" size={18} />
          Review Verifications
        </a>
        <a href={ADMIN_SUBSCRIPTIONS_HREF} className="admin-hero-button">
          <Icon name="creditCard" size={18} />
          Payment Review
        </a>
      </div>
    </section>
  );
}

function PendingActions({ queue, payments }) {
  const empty = queue.length === 0 && payments.length === 0;
  return (
    <Card title="Pending Actions" className="admin-pending">
      {empty ? (
        <p className="admin-muted">Nothing is waiting for you.</p>
      ) : (
        <ul className="admin-pending-list">
          {queue.map((item) => (
            <li key={`application-${item.id}`} className="admin-pending-item is-verification">
              <p className="admin-pending-name">{item.clinic_name}</p>
              <p className="admin-pending-meta">Verification · {item.submitted_at ? formatShortDate(item.submitted_at) : 'Not dated'}</p>
              <a href={getAdminApplicationHref(item.id)} className="admin-pending-button" aria-label={`Review ${item.clinic_name}`}>
                Review Now
              </a>
            </li>
          ))}
          {payments.map((item) => (
            <li key={`payment-${item.id}`} className="admin-pending-item is-payment">
              <p className="admin-pending-name">{item.clinic_name}</p>
              <p className="admin-pending-meta">Payment Proof Submitted</p>
              <a href={getAdminSubscriptionHref(item.clinic_id)} className="admin-pending-button" aria-label={`Verify payment from ${item.clinic_name}`}>
                Verify Payment
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function RecentAudit({ items }) {
  return (
    <Card
      title="Recent Audit Activity"
      actions={
        <a href={ADMIN_AUDIT_HREF} className="admin-card-link">
          View all logs
        </a>
      }
    >
      {items.length === 0 ? (
        <p className="admin-muted">No activity yet.</p>
      ) : (
        <ul className="admin-audit-feed">
          {items.map((item) => (
            <li key={item.id}>
              <span className={`admin-feed-dot is-${OUTCOME_TONES[item.outcome] ?? 'success'}`} aria-hidden="true" />
              <div>
                <p className="admin-audit-feed-title">{[item.label, item.subject_label].filter(Boolean).join(' — ')}</p>
                <p className="admin-audit-feed-meta">{[item.user_name, item.module, `${formatDate(item.created_at)} ${formatTime(item.created_at)}`].filter(Boolean).join(' · ')}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function UserBreakdown({ users }) {
  return (
    <Card title="User Breakdown">
      <ul className="admin-breakdown">
        {BREAKDOWN.map(({ role, label }) => (
          <li key={role}>
            {label}
            <span className={`admin-count-badge is-${USER_ROLE_TONES[role]}`}>{count(users[role])}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// Platform summary: aggregates only, no patient-level data.
function AdminDashboardPage() {
  const { user } = useAuth();
  const brand = useBrandName();
  const query = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: getAdminDashboard });

  return (
    <AdminLayout title="System Dashboard" subtitle={`${brand} Platform Overview`} activeHref={ADMIN_DASHBOARD_HREF}>
      <QueryState query={query} loadingLabel="Loading overview…">
        {(data) => {
          const waiting = data.applications.pending + data.applications.under_review;
          const totalUsers = Object.values(data.users).reduce((sum, value) => sum + Number(value), 0);
          return (
            <div className="admin-stack">
              <Hero name={user?.name} waiting={waiting} payments={data.pending_payments.total} />

              <div className="admin-tiles">
                <StatTile icon="building" value={count(data.clinics.total)} label="Total Clinics" note={`${count(data.clinics.verified)} verified`} />
                <StatTile icon="shield" tone="warning" value={count(waiting)} label="Pending Verification" note="Awaiting review" />
                <StatTile icon="users" tone="success" value={count(totalUsers)} label="Total Users" note="All roles" />
                <StatTile icon="creditCard" tone="info" value={count(data.pending_payments.total)} label="Pending Payments" note="Proof submitted" />
                <StatTile icon="checkCircle" tone="teal" value={count(data.active_subscriptions)} label="Active Subscriptions" note="Across all clinics" />
                <StatTile icon="calendar" tone="warning" value={count(data.total_appointments)} label="Total Appointments" note="Platform-wide" />
                <StatTile icon="alertCircle" tone="danger" value={count(data.clinics.suspended)} label="Suspended Clinics" note="Inactive" />
                <StatTile icon="bell" tone="info" value={count(data.active_announcements)} label="System Announcements" note="Active" />
              </div>

              <div className="admin-dashboard-columns">
                <div className="admin-stack">
                  <Card title="Platform Growth">
                    <LineChart
                      caption="Accounts on the platform at the end of each month"
                      rows={data.platform_growth.map((point) => ({ key: point.month, label: point.label, value: point.total }))}
                      valueLabel="Accounts"
                    />
                  </Card>
                  <RecentAudit items={data.recent_audit} />
                </div>
                <div className="admin-stack">
                  <PendingActions queue={data.queue ?? []} payments={data.pending_payments.items} />
                  <UserBreakdown users={data.users} />
                </div>
              </div>
            </div>
          );
        }}
      </QueryState>
    </AdminLayout>
  );
}

export default AdminDashboardPage;
