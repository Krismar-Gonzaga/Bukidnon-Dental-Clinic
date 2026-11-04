import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import AccountMenu from '../components/AccountMenu';
import NotificationBell from '../components/NotificationBell';
import ClinicGlobalSearch from '../components/portal/ClinicGlobalSearch';
import { ConfirmDialog } from '../components/portal/PortalUi';
import { useAuth } from '../auth/AuthContext';
import { useUnreadNotifications } from '../hooks/useUnreadNotifications';
import { useBrandName } from '../services/platformStore';
import { getClinicHref } from '../config/clinicNavigation';
import { LOGIN_HREF } from '../config/navigation';
import { formatDate } from '../utils/dateTime';
import './ClinicShell.css';
import './ClinicShellGrouped.css';

const SUPPORT_HREF = '/contact';
const COLLAPSED_KEY = 'clinic-sidebar-collapsed';
const getInitial = (name = '') => name.trim().charAt(0).toUpperCase() || '?';

// A remembered convenience only: the sidebar opens expanded if storage is unavailable.
export function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveCollapsed(collapsed) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // Not remembered this time.
  }
}

// Top-bar search. Pages pass their own (e.g. the staff directory filters
// its list); otherwise the global search across patients, branches and staff.
function TopbarSearch({ search, clinicId, can }) {
  if (!search) return <ClinicGlobalSearch clinicId={clinicId} can={can} />;

  return (
    <label className="clinic-topbar-search">
      <Icon name="search" size={18} />
      <span className="visually-hidden">{search.label}</span>
      <input type="search" placeholder={search.placeholder} value={search.value} onChange={(e) => search.onChange(e.target.value)} />
    </label>
  );
}

// Sidebar sign out, confirmed first: a labelled link (dentist design) or the
// icon beside the member's name (clinic admin design).
export function SignOutLink({ iconOnly = false, message = 'You will need to sign in again to open the clinic portal.' }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const handleConfirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await signOut();
      navigate(LOGIN_HREF, { replace: true });
    } catch (signOutError) {
      setError(signOutError);
      setBusy(false);
    }
  };

  return (
    <>
      {iconOnly ? (
        <button type="button" className="clinic-sidebar-logout" aria-label="Sign out" onClick={() => setAsking(true)}>
          <Icon name="logOut" size={20} />
        </button>
      ) : (
        <button type="button" className="clinic-nav-link clinic-nav-button" onClick={() => setAsking(true)}>
          <Icon name="logOut" size={20} />
          Sign Out
        </button>
      )}
      {asking && (
        <ConfirmDialog
          title="Sign out?"
          message={message}
          confirmLabel="Sign out"
          isBusy={busy}
          error={error}
          onConfirm={handleConfirm}
          onCancel={() => setAsking(false)}
        />
      )}
    </>
  );
}

function NavLink({ item, isActive, collapsed }) {
  const unread = useUnreadNotifications();
  const badge = item.showsUnread && unread > 0 ? unread : null;
  return (
    <a
      href={item.href}
      className={`clinic-nav-link${isActive ? ' is-active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
      title={collapsed ? item.label : undefined}
    >
      <Icon name={item.icon} size={20} />
      <span className="clinic-nav-label">{item.label}</span>
      {badge != null && (
        <span className="clinic-nav-badge">
          {badge}
          <span className="visually-hidden"> unread</span>
        </span>
      )}
    </a>
  );
}

/** Sections under their group headings (clinic admin design). */
function GroupedNav({ items, activeHref, collapsed }) {
  const groups = [];
  items.forEach((item) => {
    const last = groups[groups.length - 1];
    if (last && last.name === item.group) last.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  });

  return groups.map(({ name, items: groupItems }) => (
    <div key={name ?? 'main'} className="clinic-nav-group">
      {name && <p className="clinic-nav-heading">{name}</p>}
      <ul>
        {groupItems.map((item) => (
          <li key={item.href}>
            <NavLink item={item} isActive={item.href === activeHref} collapsed={collapsed} />
          </li>
        ))}
      </ul>
    </div>
  ));
}

/**
 * Clinic portal frame. Clinic admins, receptionists and inventory staff get
 * the grouped sidebar and the top bar with the clinic and date (`grouped`,
 * clinic admin design); dentists keep the sidebar of their own design.
 * `hideSearch` leaves the global search out (the dashboard design has none).
 * Colors for the whole clinic portal are set in ClinicShell.css.
 */
function ClinicShell({
  clinicId,
  clinicName,
  roleLabel,
  shortRoleLabel,
  title,
  subtitle,
  navItems,
  activeHref,
  scheduleHref,
  showSignOut = false,
  grouped = false,
  hideSearch = false,
  can,
  sidebarExtra,
  search,
  headerActions,
  children,
}) {
  const { user } = useAuth();
  const brand = useBrandName();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  // Phones: the sidebar slides in over the page.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const name = user?.name ?? '';
  const notificationsHref = getClinicHref(clinicId, 'notifications');
  const settingsHref = getClinicHref(clinicId, 'settings');
  // The clinic's Settings page for those who may open it, otherwise their own password page.
  const accountSettingsHref = getClinicHref(clinicId, can('clinic.settings.manage', 'clinic.permissions.manage', 'clinic.audit.view') ? 'clinic-settings' : 'password');
  const canViewSchedule = can('appointments.view_all', 'appointments.view_assigned');
  const isCollapsed = grouped && collapsed && !drawerOpen;

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
    <div className={`clinic-shell${grouped ? ' is-grouped' : ''}${isCollapsed ? ' is-collapsed' : ''}${drawerOpen ? ' is-drawer-open' : ''}`}>
      {drawerOpen && <button type="button" className="clinic-drawer-backdrop" aria-label="Close menu" onClick={() => setDrawerOpen(false)} />}
      <aside className="clinic-sidebar">
        {grouped ? (
          <div className="clinic-sidebar-brand clinic-sidebar-logo">
            {!isCollapsed && (
              <a href={getClinicHref(clinicId)} className="clinic-sidebar-name">
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
        ) : (
          <div className="clinic-sidebar-brand">
            <a href={getClinicHref(clinicId)} className="clinic-sidebar-name">
              {clinicName}
            </a>
            <p className="clinic-sidebar-tagline">Clinic portal</p>
          </div>
        )}
        {!isCollapsed && sidebarExtra}

        <nav className="clinic-sidebar-nav" aria-label="Clinic">
          {grouped ? (
            <GroupedNav items={navItems} activeHref={activeHref} collapsed={isCollapsed} />
          ) : (
            <ul>
              {navItems.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} isActive={item.href === activeHref} collapsed={false} />
                </li>
              ))}
            </ul>
          )}
        </nav>

        {!grouped && can('clinic.branches.manage') && (
          <a href={`${getClinicHref(clinicId, 'branches')}?new=1`} className="clinic-sidebar-cta">
            <Icon name="plus" size={18} />
            Add New Branch
          </a>
        )}

        <div className="clinic-sidebar-footer">
          {!grouped && can('clinic.profile.manage') && (
            <a href={settingsHref} className={`clinic-nav-link${activeHref === settingsHref ? ' is-active' : ''}`}>
              <Icon name="settings" size={20} />
              Settings
            </a>
          )}
          {!grouped && (
            <a href={SUPPORT_HREF} className="clinic-nav-link">
              <Icon name="helpCircle" size={20} />
              Support
            </a>
          )}
          {showSignOut && <SignOutLink />}
          <div className="clinic-sidebar-user">
            <span className="clinic-shell-avatar" aria-hidden="true">
              {getInitial(name)}
            </span>
            {!isCollapsed && (
              <div className="clinic-sidebar-user-text">
                <p className="clinic-sidebar-user-name">{name}</p>
                <p className="clinic-sidebar-user-role">{roleLabel}</p>
              </div>
            )}
            {grouped && <SignOutLink iconOnly />}
          </div>
        </div>
      </aside>

      <div className="clinic-main">
        <header className="clinic-topbar">
          {grouped && (
            <button type="button" className="clinic-menu-button" aria-label="Open menu" aria-expanded={drawerOpen} onClick={() => setDrawerOpen(true)}>
              <Icon name="menu" size={22} />
            </button>
          )}
          {grouped ? (
            <div className="clinic-topbar-heading">
              <h1 className="clinic-topbar-title">{title}</h1>
              {subtitle !== null && <p className="clinic-topbar-subtitle">{subtitle ?? `${clinicName} · ${formatDate(new Date().toISOString())}`}</p>}
            </div>
          ) : (
            <h1 className="clinic-topbar-title">{title}</h1>
          )}
          {!hideSearch && <TopbarSearch search={search} clinicId={clinicId} can={can} />}
          <div className="clinic-topbar-page-actions">{headerActions}</div>
          <div className="clinic-topbar-actions">
            <NotificationBell allHref={notificationsHref} isCurrentPage={activeHref === notificationsHref} />
            {!grouped && canViewSchedule && (
              <a href={scheduleHref ?? getClinicHref(clinicId, 'appointments')} className="clinic-topbar-icon" aria-label="Appointment schedule">
                <Icon name="calendar" size={22} />
              </a>
            )}
            {grouped && (
              <div className="clinic-topbar-user">
                <p className="clinic-topbar-user-name">{name}</p>
                <p className="clinic-topbar-user-role">{shortRoleLabel}</p>
              </div>
            )}
            {grouped ? (
              <AccountMenu
                roleLabel={roleLabel}
                links={[
                  { label: 'My Profile', href: getClinicHref(clinicId, 'profile'), icon: 'user' },
                  { label: 'Notifications', href: notificationsHref, icon: 'bell' },
                  { label: 'Settings', href: accountSettingsHref, icon: 'settings' },
                ]}
              />
            ) : (
              <AccountMenu profileHref={getClinicHref(clinicId, 'profile')} roleLabel={roleLabel} />
            )}
          </div>
        </header>

        <main className="clinic-content">{children}</main>
      </div>
    </div>
  );
}

export default ClinicShell;
