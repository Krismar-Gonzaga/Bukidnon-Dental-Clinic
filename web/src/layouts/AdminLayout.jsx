import { useQuery } from '@tanstack/react-query';
import Icon from '../components/Icon';
import AccountMenu from '../components/AccountMenu';
import NotificationBell from '../components/NotificationBell';
import AdminGlobalSearch from '../components/admin/AdminGlobalSearch';
import { AdminSecurityProvider } from '../components/admin/AdminSecurity';
import { BRAND_NAME } from '../config/app';
import {
  ADMIN_AUDIT_HREF,
  ADMIN_DASHBOARD_HREF,
  ADMIN_NAV_ITEMS,
  ADMIN_NOTIFICATIONS_HREF,
  ADMIN_PROFILE_HREF,
  ADMIN_SETTINGS_HREF,
} from '../config/adminNavigation';
import { getSystemHealth } from '../services/adminApi';
import '../components/portal/portal.css';
import './ClinicShell.css';
import './AdminLayout.css';

const ROLE_LABEL = 'System Administrator';
const HEALTH_LABELS = { healthy: 'Healthy', degraded: 'Needs attention', down: 'Service down' };
const HEALTH_TONES = { healthy: 'ok', degraded: 'warn', down: 'fail' };

/** Live platform health (sidebar card); details on the Settings page. */
export function useSystemHealth() {
  return useQuery({ queryKey: ['admin', 'health'], queryFn: getSystemHealth, staleTime: 60000, retry: false });
}

function SystemStatusCard() {
  const health = useSystemHealth();
  const status = health.data?.status;
  const label = health.isPending ? 'Checking…' : health.isError ? 'Unavailable' : HEALTH_LABELS[status] ?? status;
  const tone = health.isError ? 'fail' : HEALTH_TONES[status] ?? 'pending';

  return (
    <div className="admin-status-card">
      <p className="admin-status-line" role="status">
        <span className={`admin-status-dot is-${tone}`} aria-hidden="true" />
        System Status: {label}
      </p>
      <a href={ADMIN_SETTINGS_HREF} className="admin-status-button">
        View Health Logs
      </a>
    </div>
  );
}

const TOP_LINKS = [
  { label: 'Platform Health', href: ADMIN_SETTINGS_HREF },
  { label: 'Audit Logs', href: ADMIN_AUDIT_HREF },
];

/**
 * System administrator portal frame (admin portal design): sidebar with the
 * sections and live system status; top bar with search across clinics,
 * applications and users, Platform Health / Audit Logs links, notifications,
 * settings and the account menu. Uses the clinic portal's color roles
 * (ClinicShell.css), which match this design. High-impact actions inside
 * ask for the password again (AdminSecurityProvider).
 */
function AdminLayout({ title, activeHref, children }) {
  return (
    <AdminSecurityProvider>
      <div className="clinic-shell admin-shell">
        <aside className="clinic-sidebar">
          <a href={ADMIN_DASHBOARD_HREF} className="admin-brand">
            <span className="admin-brand-mark" aria-hidden="true">
              <Icon name="tooth" size={24} />
            </span>
            <span>
              <span className="admin-brand-name">Admin Portal</span>
              <span className="admin-brand-role">{ROLE_LABEL}</span>
            </span>
          </a>

          <nav className="clinic-sidebar-nav" aria-label="Administration">
            <ul>
              {ADMIN_NAV_ITEMS.map(({ label, href, icon }) => {
                const isActive = href === activeHref;
                return (
                  <li key={href}>
                    <a href={href} className={`clinic-nav-link${isActive ? ' is-active' : ''}`} aria-current={isActive ? 'page' : undefined}>
                      <Icon name={icon} size={20} />
                      {label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <SystemStatusCard />
        </aside>

        <div className="clinic-main">
          <header className="clinic-topbar admin-topbar">
            <span className="admin-topbar-brand">{BRAND_NAME} Admin</span>
            <AdminGlobalSearch />
            <nav className="admin-topbar-links" aria-label="Platform">
              {TOP_LINKS.map(({ label, href }) => (
                <a key={label} href={href} className={href === activeHref ? 'is-active' : undefined} aria-current={href === activeHref ? 'page' : undefined}>
                  {label}
                </a>
              ))}
            </nav>
            <div className="clinic-topbar-actions">
              <NotificationBell allHref={ADMIN_NOTIFICATIONS_HREF} isCurrentPage={activeHref === ADMIN_NOTIFICATIONS_HREF} />
              <a href={ADMIN_SETTINGS_HREF} className="clinic-topbar-icon" aria-label="Settings">
                <Icon name="settings" size={22} />
              </a>
              <AccountMenu profileHref={ADMIN_PROFILE_HREF} roleLabel={ROLE_LABEL} />
            </div>
          </header>

          <main className="clinic-content">
            {/* Pages without a title render their own header (PageHeader in components/admin/AdminData). */}
            {title && <h1 className="admin-page-title">{title}</h1>}
            {children}
          </main>
        </div>
      </div>
    </AdminSecurityProvider>
  );
}

export default AdminLayout;
