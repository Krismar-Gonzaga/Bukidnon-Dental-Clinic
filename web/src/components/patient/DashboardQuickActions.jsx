import Icon from '../Icon';
import './patientPanel.css';
import './DashboardQuickActions.css';

// actions: [{ label, href, icon }]
function DashboardQuickActions({ actions }) {
  return (
    <section className="patient-panel" aria-labelledby="dashboard-quick-actions-title">
      <div className="patient-panel-header">
        <h2 id="dashboard-quick-actions-title" className="patient-panel-title">
          Quick Actions
        </h2>
      </div>

      <ul className="dashboard-quick-actions">
        {actions.map(({ label, href, icon }) => (
          <li key={href}>
            <a href={href} className="dashboard-quick-action">
              <span className="dashboard-quick-action-icon">
                <Icon name={icon} size={18} />
              </span>
              <span className="dashboard-quick-action-label">{label}</span>
              <Icon name="chevronRight" size={16} className="dashboard-quick-action-chevron" />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default DashboardQuickActions;
