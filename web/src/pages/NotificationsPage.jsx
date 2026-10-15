import { useState } from 'react';
import PatientLayout from '../layouts/PatientLayout';
import Icon from '../components/Icon';
import NotificationCard from '../components/patient/NotificationCard';
import { PATIENT_NOTIFICATIONS_HREF } from '../config/patientNavigation';
import { MOCK_NOTIFICATIONS } from '../mocks/notifications';
import { MOCK_PATIENT } from '../mocks/patientDashboard';
import { pluralize } from '../utils/patientDashboard';
import './NotificationsPage.css';

// Patient notifications with MOCK data. "Mark all as read" only updates this
// page; nothing is saved until a notifications endpoint exists.
function NotificationsPage({ initialNotifications = MOCK_NOTIFICATIONS }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const unreadCount = notifications.filter(({ unread }) => unread).length;

  const handleMarkAllRead = () => {
    setNotifications((current) => current.map((item) => ({ ...item, unread: false })));
  };

  return (
    <PatientLayout
      title="Notifications"
      activeHref={PATIENT_NOTIFICATIONS_HREF}
      user={MOCK_PATIENT}
      hasUnreadNotifications={unreadCount > 0}
    >
      <div className="notifications-page">
        <div className="notifications-toolbar">
          <p className="notifications-count" role="status">
            {unreadCount > 0
              ? pluralize(unreadCount, 'unread notification', 'unread notifications')
              : 'No unread notifications'}
          </p>
          {unreadCount > 0 && (
            <button type="button" className="notifications-mark-read" onClick={handleMarkAllRead}>
              <Icon name="check" size={16} />
              Mark all as read
            </button>
          )}
        </div>

        {notifications.length > 0 ? (
          <ul className="notifications-list">
            {notifications.map((notification) => (
              <li key={notification.id}>
                <NotificationCard notification={notification} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="notifications-empty">You have no notifications yet.</p>
        )}
      </div>
    </PatientLayout>
  );
}

export default NotificationsPage;
