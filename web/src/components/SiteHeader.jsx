import { BRAND_NAME } from '../config/app';
import { MAIN_NAV_ITEMS } from '../config/navigation';
import './SiteHeader.css';

// Login/Register are visual only until authentication is implemented.
function SiteHeader({ activeHref = '/' }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a href="/" className="site-header-brand">
          {BRAND_NAME}
        </a>

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
                  >
                    {item.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="site-header-actions">
          <button type="button" className="btn btn-outline">
            Login
          </button>
          <button type="button" className="btn btn-primary">
            Register
          </button>
        </div>
      </div>
    </header>
  );
}

export default SiteHeader;
