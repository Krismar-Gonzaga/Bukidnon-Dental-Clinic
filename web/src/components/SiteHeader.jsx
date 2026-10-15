import { useEffect, useState } from 'react';
import Icon from './Icon';
import { BRAND_NAME } from '../config/app';
import {
  LOGIN_HREF,
  MAIN_NAV_ITEMS,
  REGISTER_HREF,
} from '../config/navigation';
import { useAuth } from '../auth/AuthContext';
import { getHomeHref } from '../auth/homeRoutes';
import './SiteHeader.css';

// Login and Register link to the account pages. For a signed-in user a
// "My Account" link to their portal replaces them (`account` overrides it).
// Below the desktop breakpoint, nav and actions collapse into a menu panel.
function SiteHeader({ activeHref = '/', account: accountOverride }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user } = useAuth();
  const account = accountOverride ?? (user ? { name: user.name, href: getHomeHref(user) } : null);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a href="/" className="site-header-brand">
          {BRAND_NAME}
        </a>

        <button
          type="button"
          className="site-header-menu-toggle"
          aria-expanded={isMenuOpen}
          aria-controls="site-header-menu"
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          <Icon name={isMenuOpen ? 'close' : 'menu'} size={24} />
        </button>

        <div
          id="site-header-menu"
          className={`site-header-menu${isMenuOpen ? ' is-open' : ''}`}
        >
          <nav className="site-header-nav" aria-label="Main navigation">
            <ul className="site-header-nav-list">
              {MAIN_NAV_ITEMS.map((item) => {
                const isActive = item.href === activeHref;
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      className={`site-header-link${isActive ? ' is-active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={closeMenu}
                    >
                      {item.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="site-header-actions">
            {account ? (
              <a href={account.href} className="site-header-account" onClick={closeMenu}>
                <span className="site-header-account-avatar" aria-hidden="true">
                  {account.name.trim().charAt(0).toUpperCase()}
                </span>
                My Account
              </a>
            ) : (
              <>
                <a href={LOGIN_HREF} className="btn btn-outline" onClick={closeMenu}>
                  Login
                </a>
                <a
                  href={REGISTER_HREF}
                  className="btn btn-primary"
                  onClick={closeMenu}
                >
                  Register
                </a>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default SiteHeader;
