import Icon from '../Icon';
import './ContactInfoCard.css';

function ContactInfoCard({ icon, title, primary, href, secondary }) {
  return (
    <div className="contact-info">
      <span className="contact-info-icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <div className="contact-info-body">
        <h2 className="contact-info-title">{title}</h2>
        <p className="contact-info-line">
          {href ? (
            <a href={href} className="contact-info-link">
              {primary}
            </a>
          ) : (
            primary
          )}
        </p>
        <p className="contact-info-line">{secondary}</p>
      </div>
    </div>
  );
}

export default ContactInfoCard;
