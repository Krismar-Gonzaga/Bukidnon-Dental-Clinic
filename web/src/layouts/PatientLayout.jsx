import Icon from '../components/Icon';
import { BRAND_NAME } from '../config/app';
import {
  PATIENT_NAV_ITEMS,
  PATIENT_NOTIFICATIONS_HREF,
} from '../config/patientNavigation';
import './PatientLayout.css';

const getInitial = (name) => name.trim().charAt(0).toUpperCase();

// Patient portal frame: fixed sidebar with account summary and navigation,
// plus a top bar with the page title, notifications, and avatar.
function PatientLayout({ title, activeHref, user, hasUnreadNotifications, children }) {
  const initial = getInitial(user.name);

  return (
    <div className="patient-layout">
      <aside className="patient-sidebar">
        <div className="patient-sidebar-top">
          <a href="/" className="patient-sidebar-brand">
            {BRAND_NAME}
          </a>
          <div className="patient-sidebar-user">
            <span className="patient-avatar" aria-hidden="true">
              {initial}
            </span>
            <div>
              <p className="patient-sidebar-user-name">{user.name}</p>
              <p className="patient-sidebar-user-role">{user.role}</p>
            </div>
          </div>
        </div>

        <nav className="patient-sidebar-nav" aria-label="Patient">
          <ul>
            {PATIENT_NAV_ITEMS.map(({ label, href, icon }) => {
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
          {/* Sign-out is not connected until authentication is integrated. */}
          <button type="button" className="patient-logout">
            <Icon name="logOut" size={20} />
            Log Out
          </button>
        </div>
      </aside>

      <div className="patient-main">
        <header className="patient-topbar">
          <h1 className="patient-topbar-title">{title}</h1>
          <div className="patient-topbar-actions">
            <a
              href={PATIENT_NOTIFICATIONS_HREF}
              className="patient-topbar-bell"
              aria-label={
                hasUnreadNotifications
                  ? 'Notifications, unread items'
                  : 'Notifications'
              }
            >
              <Icon name="bell" size={22} />
              {hasUnreadNotifications && (
                <span className="patient-topbar-bell-dot" aria-hidden="true" />
              )}
            </a>
            <span className="patient-avatar" aria-hidden="true">
              {initial}
            </span>
          </div>
        </header>

        <main className="patient-content">{children}</main>
      </div>
    </div>
  );
}

export default PatientLayout;
