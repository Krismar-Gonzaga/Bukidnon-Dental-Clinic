import { PATIENT_NOTIFICATIONS_HREF } from '../../config/patientNavigation';
import './patientPanel.css';
import './DashboardNotifications.css';

function DashboardNotifications({ notifications }) {
  const unreadCount = notifications.filter(({ unread }) => unread).length;

  return (
    <section className="patient-panel" aria-labelledby="dashboard-notifications-title">
      <div className="patient-panel-header">
        <h2 id="dashboard-notifications-title" className="patient-panel-title">
          Notifications
        </h2>
        {unreadCount > 0 && (
          <span className="dashboard-notifications-count">
            {unreadCount}
            <span className="visually-hidden"> unread</span>
          </span>
        )}
      </div>

      <ul className="dashboard-notifications-list">
        {notifications.map(({ id, title, time, unread }) => (
          <li
            key={id}
            className={`dashboard-notification${unread ? ' is-unread' : ''}`}
          >
            <span className="dashboard-notification-dot" aria-hidden="true" />
            <div>
              <p className="dashboard-notification-title">
                {title}
                {unread && <span className="visually-hidden"> (unread)</span>}
              </p>
              <p className="dashboard-notification-time">{time}</p>
            </div>
          </li>
        ))}
      </ul>

      <a href={PATIENT_NOTIFICATIONS_HREF} className="dashboard-notifications-all">
        View all notifications
      </a>
    </section>
  );
}

export default DashboardNotifications;
