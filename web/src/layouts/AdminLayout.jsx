import { useEffect, useState } from 'react';
import Icon from '../components/Icon';
import AccountMenu from '../components/AccountMenu';
import NotificationBell from '../components/NotificationBell';
import { AdminSecurityProvider } from '../components/admin/AdminSecurity';
import { Initials } from '../components/admin/AdminData';
import { useAuth } from '../auth/AuthContext';
import {
  ADMIN_DASHBOARD_HREF,
  ADMIN_NAV_ITEMS,
  ADMIN_NOTIFICATIONS_HREF,
  ADMIN_PROFILE_HREF,
  ADMIN_SETTINGS_HREF,
} from '../config/adminNavigation';
import { useBrandName } from '../services/platformStore';
import { SignOutLink, readCollapsed, saveCollapsed } from './ClinicShell';
import '../components/portal/portal.css';
import '../components/clinic/ClinicAdminUi.css';
import './ClinicShell.css';
import './ClinicShellGrouped.css';
import './AdminLayout.css';

const ROLE_LABEL = 'System Admin';

/** "Rhea Delos Reyes" -> "R. Delos Reyes" (top bar and sidebar footer of the design). */
const shortName = (name = '') => {
  const [first, ...rest] = name.trim().split(/\s+/);
  return rest.length ? `${first.charAt(0)}. ${rest.join(' ')}` : first ?? '';
};

/**
 * System administrator frame: the clinic admin's white sidebar and blue theme, with the
 * sections of the system admin design. `title`, `subtitle` and `headerActions` fill the top
 * bar. High-impact actions inside ask for the password again (AdminSecurityProvider).
 */
function AdminLayout({ title, subtitle, activeHref, headerActions, children }) {
  const { user } = useAuth();
  const brand = useBrandName();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const name = user?.name ?? '';
  const isCollapsed = collapsed && !drawerOpen;

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [drawerOpen]);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      saveCollapsed(!current);
      return !current;
    });
  };

  return (
    <AdminSecurityProvider>
      <div className={`clinic-shell admin-shell is-grouped${isCollapsed ? ' is-collapsed' : ''}${drawerOpen ? ' is-drawer-open' : ''}`}>
        {drawerOpen && <button type="button" className="clinic-drawer-backdrop" aria-label="Close menu" onClick={() => setDrawerOpen(false)} />}
        <aside className="clinic-sidebar">
          <div className="clinic-sidebar-brand clinic-sidebar-logo">
            {!isCollapsed && (
              <a href={ADMIN_DASHBOARD_HREF} className="clinic-sidebar-name">
                {brand}
              </a>
            )}
            <button
              type="button"
              className="clinic-sidebar-toggle"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!isCollapsed}
              onClick={toggleCollapsed}
            >
              <Icon name={isCollapsed ? 'chevronRight' : 'chevronLeft'} size={18} />
            </button>
            <button type="button" className="clinic-drawer-close" aria-label="Close menu" onClick={() => setDrawerOpen(false)}>
              <Icon name="close" size={20} />
            </button>
          </div>

          {!isCollapsed && (
            <div className="admin-sidebar-card">
              <Initials name={name} tone="primary" />
              <div className="admin-sidebar-card-text">
                <p className="admin-sidebar-card-name">{name}</p>
                <p className="admin-sidebar-card-role">{ROLE_LABEL}</p>
              </div>
            </div>
          )}

          <nav className="clinic-sidebar-nav" aria-label="Administration">
            <ul>
              {ADMIN_NAV_ITEMS.map(({ label, href, icon }) => {
                const isActive = href === activeHref;
                return (
                  <li key={href}>
                    <a
                      href={href}
                      className={`clinic-nav-link${isActive ? ' is-active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                      title={isCollapsed ? label : undefined}
                    >
                      <Icon name={icon} size={20} />
                      <span className="clinic-nav-label">{label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="clinic-sidebar-footer">
            <div className="clinic-sidebar-user">
              <Initials name={name} tone="primary" />
              {!isCollapsed && (
                <div className="clinic-sidebar-user-text">
                  <p className="clinic-sidebar-user-name">{shortName(name)}</p>
                  <p className="clinic-sidebar-user-role">{ROLE_LABEL}</p>
                </div>
              )}
              <SignOutLink iconOnly message="You will need to sign in again to open the admin portal." />
            </div>
          </div>
        </aside>

        <div className="clinic-main">
          <header className="clinic-topbar">
            <button type="button" className="clinic-menu-button" aria-label="Open menu" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>
              <Icon name="menu" size={22} />
            </button>
            <div className="clinic-topbar-heading">
              <h1 className="clinic-topbar-title">{title}</h1>
              {subtitle && <p className="clinic-topbar-subtitle">{subtitle}</p>}
            </div>
            <div className="clinic-topbar-page-actions">{headerActions}</div>
            <div className="clinic-topbar-actions">
              <NotificationBell allHref={ADMIN_NOTIFICATIONS_HREF} isCurrentPage={activeHref === ADMIN_NOTIFICATIONS_HREF} />
              <div className="clinic-topbar-user">
                <p className="clinic-topbar-user-name">{shortName(name)}</p>
                <p className="clinic-topbar-user-role">{ROLE_LABEL}</p>
              </div>
              <AccountMenu
                roleLabel={ROLE_LABEL}
                links={[
                  { label: 'My Profile', href: ADMIN_PROFILE_HREF, icon: 'user' },
                  { label: 'Notifications', href: ADMIN_NOTIFICATIONS_HREF, icon: 'bell' },
                  { label: 'System Settings', href: ADMIN_SETTINGS_HREF, icon: 'settings' },
                ]}
              />
            </div>
          </header>

          <main className="clinic-content admin-content">{children}</main>
        </div>
      </div>
    </AdminSecurityProvider>
  );
}

export default AdminLayout;
