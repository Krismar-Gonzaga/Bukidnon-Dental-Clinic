import { useId } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { useAuth } from '../auth/AuthContext';
import { LOGIN_HREF } from '../config/navigation';
import { useDropdown } from '../hooks/useDropdown';
import './AccountMenu.css';

const getInitial = (name = '') => name.trim().charAt(0).toUpperCase() || '?';

/**
 * Avatar button in a header that opens the account menu: optional links
 * (`links`: [{ label, href, icon }]), then My Profile and Log Out.
 * Closes on Escape (focus returns to the avatar), outside click, or choosing an item.
 */
function AccountMenu({ profileHref, roleLabel, links = [], triggerLabel, onNavigate }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const dropdown = useDropdown();
  const { isOpen, wrapperRef, triggerRef } = dropdown;
  const panelId = useId();
  const name = user?.name ?? '';

  const close = () => {
    dropdown.close();
    onNavigate?.();
  };

  const handleLogout = async () => {
    close();
    await signOut();
    navigate(LOGIN_HREF, { replace: true });
  };

  if (!user) return null;

  return (
    <div className="account-menu" ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        className="account-menu-trigger"
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={`Account menu for ${name}`}
        onClick={dropdown.toggle}
      >
        <span className="account-menu-avatar" aria-hidden="true">
          {getInitial(name)}
        </span>
        {triggerLabel && <span className="account-menu-trigger-label">{triggerLabel}</span>}
        <Icon name="chevronDown" size={16} className={`account-menu-chevron${isOpen ? ' is-open' : ''}`} />
      </button>

      {isOpen && (
        <div id={panelId} className="account-menu-panel">
          <div className="account-menu-identity">
            <p className="account-menu-name">{name}</p>
            <p className="account-menu-detail">{roleLabel ?? user.email}</p>
          </div>
          <ul className="account-menu-list">
            {links.map(({ label, href, icon }) => (
              <li key={href}>
                <a href={href} className="account-menu-item" onClick={close}>
                  <Icon name={icon} size={18} />
                  {label}
                </a>
              </li>
            ))}
            {profileHref && (
              <li>
                <a href={profileHref} className="account-menu-item" onClick={close}>
                  <Icon name="user" size={18} />
                  My Profile
                </a>
              </li>
            )}
            <li className="account-menu-divider" aria-hidden="true" />
            <li>
              <button type="button" className="account-menu-item account-menu-logout" onClick={handleLogout}>
                <Icon name="logOut" size={18} />
                Log Out
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default AccountMenu;
