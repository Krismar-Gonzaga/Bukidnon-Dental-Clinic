import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { BRAND_NAME } from '../config/app';
import { LOGIN_HREF } from '../config/navigation';
import { useAuth } from '../auth/AuthContext';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import './PatientLayout.css';

const getInitial = (name = '') => name.trim().charAt(0).toUpperCase() || '?';

/**
 * Signed-in portal frame shared by the patient, clinic and admin areas:
 * sidebar (account summary, navigation, log out) and a top bar with the page
 * title and notification bell. Styles come from the patient Figma design.
 *
 * sidebarExtra: content under the account summary (e.g. clinic switcher).
 */
function PortalLayout({
  title,
  navItems,
  activeHref,
  roleLabel,
  notificationsHref,
  navLabel = 'Portal',
  sidebarExtra,
  children,
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const unreadCount = useUnreadNotifications();
  const name = user?.name ?? '';

  const handleLogout = async () => {
    await signOut();
    navigate(LOGIN_HREF, { replace: true });
  };

  return (
    <div className="patient-layout">
      <aside className="patient-sidebar">
        <div className="patient-sidebar-top">
          <a href="/" className="patient-sidebar-brand">
            {BRAND_NAME}
          </a>
          <div className="patient-sidebar-user">
            <span className="patient-avatar" aria-hidden="true">
              {getInitial(name)}
            </span>
            <div>
              <p className="patient-sidebar-user-name">{name}</p>
              <p className="patient-sidebar-user-role">{roleLabel}</p>
            </div>
          </div>
          {sidebarExtra}
        </div>

        <nav className="patient-sidebar-nav" aria-label={navLabel}>
          <ul>
            {navItems.map(({ label, href, icon }) => {
              const isActive = href === activeHref;
              return (
                <li key={href}>
                  <a
                    href={href}
                    className={`patient-nav-link${isActive ? ' is-active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon name={icon} size={20} />
                    {label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="patient-sidebar-bottom">
          <button type="button" className="patient-logout" onClick={handleLogout}>
            <Icon name="logOut" size={20} />
            Log Out
          </button>
        </div>
      </aside>

      <div className="patient-main">
        <header className="patient-topbar">
          <h1 className="patient-topbar-title">{title}</h1>
          <div className="patient-topbar-actions">
            {notificationsHref && (
              <a
                href={notificationsHref}
                className="patient-topbar-bell"
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
              >
                <Icon name="bell" size={22} />
                {unreadCount > 0 && <span className="patient-topbar-bell-dot" aria-hidden="true" />}
              </a>
            )}
            <span className="patient-avatar" aria-hidden="true">
              {getInitial(name)}
            </span>
          </div>
        </header>

        <main className="patient-content">{children}</main>
      </div>
    </div>
  );
}

export default PortalLayout;
