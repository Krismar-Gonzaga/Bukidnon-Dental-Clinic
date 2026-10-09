import Icon from '../Icon';
import './AboutValueCard.css';

function AboutValueCard({ icon, tone, title, description }) {
  return (
    <article className="about-value">
      <span
        className={`about-value-icon about-value-icon--${tone}`}
        aria-hidden="true"
      >
        <Icon name={icon} size={26} />
      </span>
      <h3 className="about-value-title">{title}</h3>
      <p className="about-value-text">{description}</p>
    </article>
  );
}

export default AboutValueCard;
