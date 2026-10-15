import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from './Icon';
import NotificationCard from './patient/NotificationCard';
import { QueryState } from './StatusMessage';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationApi';
import { NOTIFICATIONS_KEY } from '../hooks/useUnreadNotifications';
import { pluralize } from '../utils/patientDashboard';
import '../pages/NotificationsPage.css';

/**
 * Notification center body, shared by the patient, clinic and admin portals.
 * Opening a notification marks it read.
 */
function NotificationList() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'list'],
    queryFn: () => getNotifications({ perPage: 50 }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
  const markAll = useMutation({ mutationFn: () => markAllNotificationsRead(), onSuccess: refresh });
  const markOne = useMutation({ mutationFn: (id) => markNotificationRead(id), onSuccess: refresh });

  return (
    <div className="notifications-page">
      <QueryState query={query} loadingLabel="Loading notifications…">
        {({ notifications, unreadCount }) => (
          <>
            <div className="notifications-toolbar">
              <p className="notifications-count" role="status">
                {unreadCount > 0
                  ? pluralize(unreadCount, 'unread notification', 'unread notifications')
                  : 'No unread notifications'}
              </p>
              {unreadCount > 0 && (
                <button
                  type="button"
                  className="notifications-mark-read"
                  onClick={() => markAll.mutate()}
                  disabled={markAll.isPending}
                >
                  <Icon name="check" size={16} />
                  Mark all as read
                </button>
              )}
            </div>

            {notifications.length > 0 ? (
              <ul className="notifications-list">
                {notifications.map((notification) => (
                  <li
                    key={notification.id}
                    onClick={() => notification.unread && markOne.mutate(notification.id)}
                  >
                    <NotificationCard notification={notification} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="notifications-empty">You have no notifications yet.</p>
            )}
          </>
        )}
      </QueryState>
    </div>
  );
}

export default NotificationList;
