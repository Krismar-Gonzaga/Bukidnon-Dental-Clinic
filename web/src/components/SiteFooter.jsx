import { useBrandName } from '../services/platformStore';
import { FOOTER_CONTACT, FOOTER_LINK_GROUPS, FOOTER_TAGLINE } from '../config/footer';
import './SiteFooter.css';

function SiteFooter() {
  const brand = useBrandName();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand-col">
          <a href="/" className="site-footer-brand">
            {brand}
          </a>
          <p className="site-footer-tagline">{FOOTER_TAGLINE}</p>
        </div>

        {FOOTER_LINK_GROUPS.map((group) => (
          <nav key={group.title} className="site-footer-group" aria-label={group.title}>
            <h2 className="site-footer-heading">{group.title}</h2>
            <ul className="site-footer-links">
              {group.links.map((link) => (
                <li key={link.label}>
                  <a href={link.href} className="site-footer-link">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div className="site-footer-group">
          <h2 className="site-footer-heading">Contact Us</h2>
          <address className="site-footer-contact">
            <a href={`mailto:${FOOTER_CONTACT.email}`} className="site-footer-link">
              {FOOTER_CONTACT.email}
            </a>
            <a href={`tel:${FOOTER_CONTACT.phone.replace(/\s/g, '')}`} className="site-footer-link">
              {FOOTER_CONTACT.phone}
            </a>
          </address>
        </div>
      </div>

      <div className="site-footer-bottom">
        <p className="site-footer-bottom-inner">
          &copy; {currentYear} {brand}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default SiteFooter;
