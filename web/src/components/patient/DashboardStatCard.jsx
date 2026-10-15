import Icon from '../Icon';
import './DashboardStatCard.css';

// tone: blue | green | red | amber (icon tile color)
function DashboardStatCard({ label, value, icon, tone }) {
  return (
    <div className="dashboard-stat-card">
      <span className={`dashboard-stat-icon dashboard-stat-icon--${tone}`}>
        <Icon name={icon} size={20} />
      </span>
      <p className="dashboard-stat-value">{value}</p>
      <p className="dashboard-stat-label">{label}</p>
    </div>
  );
}

export default DashboardStatCard;
