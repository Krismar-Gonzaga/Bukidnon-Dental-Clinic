import Icon from '../Icon';
import './AboutStatCard.css';

function AboutStatCard({ icon, value, label }) {
  return (
    <div className="about-stat">
      <span className="about-stat-icon" aria-hidden="true">
        <Icon name={icon} size={22} />
      </span>
      <p className="about-stat-value">{value}</p>
      <p className="about-stat-label">{label}</p>
    </div>
  );
}

export default AboutStatCard;
