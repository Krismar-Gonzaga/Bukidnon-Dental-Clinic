import { useQuery } from '@tanstack/react-query';
import AdminLayout, { useSystemHealth } from '../../layouts/AdminLayout';
import Icon from '../../components/Icon';
import { QueryState } from '../../components/StatusMessage';
import {
  ADMIN_APPLICATIONS_HREF,
  ADMIN_AUDIT_HREF,
  ADMIN_DASHBOARD_HREF,
  ADMIN_REVIEWS_HREF,
  ADMIN_SETTINGS_HREF,
  ADMIN_USERS_HREF,
  APPLICATION_STATUS_LABELS,
  getAdminApplicationHref,
} from '../../config/adminNavigation';
import { getAdminDashboard } from '../../services/adminApi';
import { formatRelative, formatShortDate } from '../../utils/dateTime';
import './AdminDashboardPage.css';

const count = (value) => new Intl.NumberFormat('en-PH').format(value ?? 0);
const HIGH_QUEUE = 5;

function StatCard({ label, value, icon, badge, tone = 'primary', featured = false, href }) {
  const body = (
    <>
      <div className="admin-stat-top">
        <span className={`admin-stat-icon is-${tone}`} aria-hidden="true">
          <Icon name={icon} size={22} />
        </span>
        {badge && (
          <span className={`admin-stat-badge is-${badge.tone}`}>
            {badge.icon && <Icon name={badge.icon} size={14} />}
            {badge.text}
          </span>
        )}
      </div>
      <p className="admin-stat-label">{label}</p>
      <p className="admin-stat-value">{value}</p>
    </>
  );
  const className = `admin-stat${featured ? ' is-featured' : ''}`;
  return href ? (
    <a href={href} className={className}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}

function HealthCard() {
  const health = useSystemHealth();
  const database = health.data?.checks?.find((c) => c.key === 'database');
  const value = health.isPending ? '…' : health.isError ? 'Unknown' : { healthy: 'Healthy', degraded: 'Degraded', down: 'Down' }[health.data.status];
  return (
    <StatCard
      label="System Health"
      value={value}
      icon="zap"
      featured
      href={ADMIN_SETTINGS_HREF}
      badge={database ? { text: database.detail.replace('Responding in ', ''), tone: 'light', icon: 'clock' } : null}
    />
  );
}

function RegistrationQueue({ queue }) {
  return (
    <section className="admin-card admin-queue" aria-labelledby="admin-queue-title">
      <div className="admin-card-header admin-queue-header">
        <h2 id="admin-queue-title" className="admin-card-title">
          Registration Queue
        </h2>
        <a href={ADMIN_APPLICATIONS_HREF} className="admin-card-link">
          View All Queue
        </a>
      </div>
      {queue.length === 0 ? (
        <p className="admin-empty">No clinics are waiting for verification.</p>
      ) : (
        <div className="admin-table-scroll">
          <table className="admin-table">
            <caption className="visually-hidden">Clinic registrations waiting for review, oldest first</caption>
            <thead>
              <tr>
                <th scope="col">Clinic Name</th>
                <th scope="col">Location</th>
                <th scope="col">Date Submitted</th>
                <th scope="col">Status</th>
                <th scope="col" className="is-end">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {queue.map((a) => (
                <tr key={a.id}>
                  <td className="is-strong">{a.clinic_name}</td>
                  <td>{[a.city, a.province].filter(Boolean).join(', ') || '—'}</td>
                  <td>{a.submitted_at ? formatShortDate(a.submitted_at) : '—'}</td>
                  <td>
                    <span className={`admin-status-chip is-${a.status}`}>{APPLICATION_STATUS_LABELS[a.status] ?? a.status}</span>
                  </td>
                  <td className="is-end">
                    <a href={getAdminApplicationHref(a.id)} className="admin-icon-link" aria-label={`Review ${a.clinic_name}`}>
                      <Icon name="eye" size={20} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const dayLabel = (date) => new Date(`${date}T12:00:00+08:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

function ActivityChart({ days }) {
  const max = Math.max(1, ...days.map((d) => d.total));
  const total = days.reduce((sum, d) => sum + d.total, 0);
  const busiest = days.reduce((top, d) => (d.total > top.total ? d : top), days[0] ?? { total: 0 });

  return (
    <section className="admin-card" aria-labelledby="admin-activity-chart-title">
      <div className="admin-card-header">
        <h2 id="admin-activity-chart-title" className="admin-card-title">
          Platform Activity
        </h2>
        <span className="admin-chart-total">{count(total)} events</span>
      </div>
      <ol className="admin-bars" aria-label="Audited events per day, last 14 days">
        {days.map((d, index) => (
          <li key={d.date} className={`admin-bar${index >= days.length - 5 ? ' is-recent' : ''}`} title={`${dayLabel(d.date)}: ${d.total}`}>
            <span className="admin-bar-fill" style={{ height: `${Math.max(4, (d.total / max) * 100)}%` }} />
            <span className="visually-hidden">
              {dayLabel(d.date)}: {d.total} events
            </span>
          </li>
        ))}
      </ol>
      <p className="admin-chart-note">
        Last 14 days{busiest?.total ? ` · busiest ${dayLabel(busiest.date)} (${count(busiest.total)})` : ''}
      </p>
    </section>
  );
}

const ACTIVITY = {
  'clinic_application.submitted': { icon: 'send', tone: 'primary', text: (l) => [l.subject_label, 'submitted a clinic registration.'] },
  'clinic_application.document_uploaded': { icon: 'clipboardList', tone: 'primary', text: (l) => [l.subject_label, 'uploaded verification documents.'] },
  'clinic_application.review_started': { icon: 'eye', tone: 'tertiary', text: (l) => [l.subject_label, `review started${l.actor ? ` by ${l.actor}` : ''}.`] },
  'clinic_application.approved': { icon: 'checkCircle', tone: 'secondary', text: (l) => [l.subject_label, `verification approved${l.actor ? ` by ${l.actor}` : ''}.`] },
  'clinic_application.rejected': { icon: 'alertCircle', tone: 'tertiary', text: (l) => [l.subject_label, `returned to the applicant${l.actor ? ` by ${l.actor}` : ''}.`] },
  'clinic.suspended': { icon: 'alertTriangle', tone: 'error', text: (l) => [l.subject_label, `suspended${l.actor ? ` by ${l.actor}` : ''}.`] },
  'clinic.reactivated': { icon: 'checkCircle', tone: 'secondary', text: (l) => [l.subject_label, `reactivated${l.actor ? ` by ${l.actor}` : ''}.`] },
  'admin.user_updated': { icon: 'userCheck', tone: 'tertiary', text: (l) => [l.subject_label, `account updated${l.actor ? ` by ${l.actor}` : ''}.`] },
  'review.moderated': { icon: 'star', tone: 'tertiary', text: (l) => [null, `A review was moderated${l.actor ? ` by ${l.actor}` : ''}.`] },
};

function ActivityFeed({ items }) {
  return (
    <section className="admin-card" aria-labelledby="admin-feed-title">
      <h2 id="admin-feed-title" className="admin-card-title admin-feed-title">
        Recent Activity
      </h2>
      {items.length === 0 ? (
        <p className="admin-empty">No platform activity yet.</p>
      ) : (
        <ol className="admin-feed">
          {items.map((item) => {
            const meta = ACTIVITY[item.action] ?? { icon: 'info', tone: 'tertiary', text: () => [null, item.action] };
            const [subject, rest] = meta.text(item);
            return (
              <li key={item.id} className="admin-feed-item">
                <span className={`admin-feed-icon is-${meta.tone}`} aria-hidden="true">
                  <Icon name={meta.icon} size={12} />
                </span>
                <div>
                  <p className="admin-feed-text">
                    {subject && <strong>{subject}</strong>} {rest}
                  </p>
                  <p className="admin-feed-time">{formatRelative(item.created_at)}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <a href={ADMIN_AUDIT_HREF} className="admin-outline-button">
        View Activity Logs
      </a>
    </section>
  );
}

function SecurityOverview({ security, openReports }) {
  const items = [
    { label: 'Failed sign-ins (24 h)', value: security.failed_logins_24h, alert: security.failed_logins_24h >= 10 },
    { label: 'Blocked sign-ins (24 h)', value: security.blocked_logins_24h, alert: security.blocked_logins_24h > 0 },
    { label: 'Failed admin password checks (24 h)', value: security.failed_password_confirmations_24h, alert: security.failed_password_confirmations_24h > 0 },
    { label: 'Suspended accounts', value: security.suspended_users },
    { label: 'Open review reports', value: openReports, href: ADMIN_REVIEWS_HREF },
  ];

  return (
    <section className="admin-security" aria-labelledby="admin-security-title">
      <div className="admin-security-text">
        <h2 id="admin-security-title" className="admin-security-title">
          Security Overview
        </h2>
        <p className="admin-security-lead">
          Sign-in failures, blocked accounts and admin password checks from the audit log. Investigate spikes in the audit log before
          they become incidents.
        </p>
        <dl className="admin-security-stats">
          {items.map((item) => (
            <div key={item.label} className={item.alert ? 'is-alert' : undefined}>
              <dt>{item.label}</dt>
              <dd>{item.href ? <a href={item.href}>{count(item.value)}</a> : count(item.value)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="admin-security-actions">
        <a href={`${ADMIN_AUDIT_HREF}?action=auth.login_failed`} className="btn btn-outline">
          Detailed Audit
        </a>
        <a href={`${ADMIN_USERS_HREF}?status=suspended`} className="btn btn-primary">
          Review Accounts
        </a>
      </div>
    </section>
  );
}

// Platform summary: aggregates only, no patient-level data.
function AdminDashboardPage() {
  const query = useQuery({ queryKey: ['admin', 'dashboard'], queryFn: getAdminDashboard });

  return (
    <AdminLayout title="Platform Overview" activeHref={ADMIN_DASHBOARD_HREF}>
      <QueryState query={query} loadingLabel="Loading overview…">
        {(data) => {
          const waiting = data.applications.pending + data.applications.under_review;
          return (
            <div className="admin-dashboard">
              <div className="admin-stats">
                <StatCard
                  label="Total Clinics"
                  value={count(data.clinics.total)}
                  icon="building"
                  badge={{ text: `+${count(data.clinics.new_this_month)} this month`, tone: 'up', icon: 'trendingUp' }}
                />
                <StatCard
                  label="Listed Clinics"
                  value={count(data.clinics.listed)}
                  icon="mapPin"
                  tone="secondary"
                  badge={
                    data.clinics.suspended
                      ? { text: `${count(data.clinics.suspended)} suspended`, tone: 'warn', icon: 'alertTriangle' }
                      : { text: 'Stable', tone: 'up', icon: 'check' }
                  }
                />
                <StatCard
                  label="Pending Verifications"
                  value={count(waiting)}
                  icon="shieldCheck"
                  tone="tertiary"
                  href={ADMIN_APPLICATIONS_HREF}
                  badge={
                    waiting >= HIGH_QUEUE
                      ? { text: 'High', tone: 'warn', icon: 'alertTriangle' }
                      : { text: waiting ? 'Normal' : 'Clear', tone: 'up', icon: 'check' }
                  }
                />
                <HealthCard />
              </div>

              <div className="admin-dashboard-grid">
                <RegistrationQueue queue={data.queue ?? []} />
                <div className="admin-dashboard-side">
                  <ActivityChart days={data.activity_by_day ?? []} />
                  <ActivityFeed items={data.recent_activity ?? []} />
                </div>
              </div>

              {data.security && <SecurityOverview security={data.security} openReports={data.open_review_reports} />}
            </div>
          );
        }}
      </QueryState>
    </AdminLayout>
  );
}

export default AdminDashboardPage;
