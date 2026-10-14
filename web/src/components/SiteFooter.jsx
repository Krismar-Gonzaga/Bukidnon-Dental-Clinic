import Icon from './Icon';
import { BRAND_NAME } from '../config/app';
import {
  FOOTER_CONTACT,
  FOOTER_LINK_GROUPS,
  FOOTER_SOCIAL_LINKS,
  FOOTER_TAGLINE,
} from '../config/footer';
import './SiteFooter.css';

function SiteFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="site-footer-brand-col">
          <a href="/" className="site-footer-brand">
            {BRAND_NAME}
          </a>
          <p className="site-footer-tagline">{FOOTER_TAGLINE}</p>
          <ul className="site-footer-social" aria-label="Social media">
            {FOOTER_SOCIAL_LINKS.map((social) => (
              <li key={social.label}>
                <a
                  href={social.href}
                  className="site-footer-social-link"
                  aria-label={social.label}
                >
                  <Icon name={social.icon} size={18} />
                </a>
              </li>
            ))}
          </ul>
        </div>

        {FOOTER_LINK_GROUPS.map((group) => (
          <nav
            key={group.title}
            className="site-footer-group"
            aria-label={group.title}
          >
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
          <h2 className="site-footer-heading">Contact</h2>
          <address className="site-footer-contact">
            <a
              href={`mailto:${FOOTER_CONTACT.email}`}
              className="site-footer-contact-item"
            >
              <Icon name="mail" size={18} />
              {FOOTER_CONTACT.email}
            </a>
            <a
              href={`tel:${FOOTER_CONTACT.phone.replace(/\s/g, '')}`}
              className="site-footer-contact-item"
            >
              <Icon name="phone" size={18} />
              {FOOTER_CONTACT.phone}
            </a>
            <span className="site-footer-contact-item">
              <Icon name="mapPin" size={18} />
              {FOOTER_CONTACT.location}
            </span>
          </address>
        </div>
      </div>

      <div className="site-footer-bottom">
        <p className="site-footer-bottom-inner">
          &copy; {currentYear} {BRAND_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default SiteFooter;
