import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import AccountMenu from '../components/AccountMenu';
import NotificationBell from '../components/NotificationBell';
import { useBrandName } from '../services/platformStore';
import { useAuth } from '../auth/AuthContext';
import { getProfileHref } from '../auth/homeRoutes';
import { LOGIN_HREF } from '../config/navigation';
import './PatientLayout.css';
import { getErrorMessage } from '../services/apiErrors';

const getInitial = (name = '') => name.trim().charAt(0).toUpperCase() || '?';

/**
 * Signed-in portal frame shared by the patient, clinic and admin areas:
 * sidebar (account summary and navigation) and a top bar with the page
 * title, the notification bell (dropdown of recent notifications), and the
 * avatar menu (My Profile, Log Out). On phones and small tablets the sidebar
 * becomes a slide-in menu opened from the top bar.
 * Styles come from the patient Figma design.
 *
 * sidebarExtra: content under the account summary (e.g. clinic switcher).
 * profileHref: the avatar menu's My Profile link (defaults by role).
 */
function PortalLayout({
  title,
  navItems,
  activeHref,
  roleLabel,
  notificationsHref,
  profileHref,
  navLabel = 'Portal',
  sidebarExtra,
  children,
}) {
  const brand = useBrandName();
  const { user, signOut } = useAuth();
  const [logoutError, setLogoutError] = useState('');
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const name = user?.name ?? '';
  const isNotificationsPage = Boolean(notificationsHref) && activeHref === notificationsHref;

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isMenuOpen]);

  const handleLogout = async () => {
    setLogoutError('');
    try {
      await signOut();
      navigate(LOGIN_HREF, { replace: true });
    } catch (error) {
      setLogoutError(`You are still signed in. ${getErrorMessage(error)}`);
    }
  };

  return (
    <div className="patient-layout">
      {isMenuOpen && <div className="patient-sidebar-scrim" onClick={() => setIsMenuOpen(false)} aria-hidden="true" />}
      <aside id="portal-sidebar" className={`patient-sidebar${isMenuOpen ? ' is-open' : ''}`}>
        <div className="patient-sidebar-top">
          <a href="/" className="patient-sidebar-brand">
            {brand}
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
                    onClick={() => setIsMenuOpen(false)}
                  >
                    <Icon name={icon} size={20} />
                    {label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="patient-sidebar-footer">
          {logoutError && (
            <p className="patient-logout-error" role="alert">
              {logoutError}
            </p>
          )}
          <button type="button" className="patient-logout" onClick={handleLogout}>
            <Icon name="logOut" size={20} />
            Log Out
          </button>
        </div>
      </aside>

      <div className="patient-main">
        <header className="patient-topbar">
          <div className="patient-topbar-start">
            <button
              type="button"
              className="patient-menu-button"
              aria-label="Open menu"
              aria-expanded={isMenuOpen}
              aria-controls="portal-sidebar"
              onClick={() => setIsMenuOpen(true)}
            >
              <Icon name="menu" size={22} />
            </button>
            <h1 className="patient-topbar-title">{title}</h1>
          </div>
          <div className="patient-topbar-actions">
            {notificationsHref && <NotificationBell allHref={notificationsHref} isCurrentPage={isNotificationsPage} />}
            <AccountMenu profileHref={profileHref ?? getProfileHref(user)} roleLabel={roleLabel} />
          </div>
        </header>

        <main className="patient-content">{children}</main>
      </div>
    </div>
  );
}

export default PortalLayout;
