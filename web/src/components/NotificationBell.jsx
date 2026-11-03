import { useId } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { useAuth } from '../auth/AuthContext';
import { useDropdown } from '../hooks/useDropdown';
import { NOTIFICATIONS_KEY, useUnreadNotifications } from '../hooks/useUnreadNotifications';
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notificationApi';
import { getErrorMessage } from '../services/apiErrors';
import { getNotificationHref } from '../utils/notificationLinks';
import './NotificationBell.css';

const PREVIEW_COUNT = 6;

/**
 * Header bell. Opens a dropdown with the latest notifications; choosing one
 * marks it read and opens the page it is about. "View all" goes to the
 * notifications page (`allHref`).
 */
function NotificationBell({ allHref, isCurrentPage = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const unreadCount = useUnreadNotifications();
  const dropdown = useDropdown();
  const { isOpen, wrapperRef, triggerRef } = dropdown;
  const panelId = useId();

  const preview = useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'preview'],
    queryFn: () => getNotifications({ perPage: PREVIEW_COUNT }),
    enabled: isOpen,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
  const markAll = useMutation({ mutationFn: () => markAllNotificationsRead(), onSuccess: refresh });
  const markOne = useMutation({ mutationFn: (id) => markNotificationRead(id), onSuccess: refresh });

  const openNotification = (notification) => {
    if (notification.unread) markOne.mutate(notification.id);
    dropdown.close();
    navigate(getNotificationHref(notification, user) ?? allHref);
  };

  const notifications = preview.data?.notifications ?? [];

  return (
    <div className="notification-bell" ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`patient-topbar-bell${isCurrentPage || isOpen ? ' is-active' : ''}`}
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        onClick={dropdown.toggle}
      >
        <Icon name="bell" size={22} />
        {unreadCount > 0 && <span className="patient-topbar-bell-dot" aria-hidden="true" />}
      </button>

      {isOpen && (
        <div id={panelId} className="notification-bell-panel">
          <div className="notification-bell-header">
            <p className="notification-bell-title">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                className="notification-bell-mark-all"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
              >
                Mark all as read
              </button>
            )}
          </div>

          {preview.isPending ? (
            <p className="notification-bell-status" role="status">Loading…</p>
          ) : preview.isError ? (
            <p className="notification-bell-status" role="alert">{getErrorMessage(preview.error)}</p>
          ) : notifications.length === 0 ? (
            <p className="notification-bell-status">You have no notifications yet.</p>
          ) : (
            <ul className="notification-bell-list">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button
                    type="button"
                    className={`notification-bell-item${notification.unread ? ' is-unread' : ''}`}
                    onClick={() => openNotification(notification)}
                  >
                    <span className="notification-bell-item-title">
                      {notification.title}
                      {notification.unread && <span className="visually-hidden"> (unread)</span>}
                    </span>
                    <span className="notification-bell-item-message">{notification.message}</span>
                    <span className="notification-bell-item-time">{notification.time}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <a href={allHref} className="notification-bell-all" onClick={dropdown.close}>
            View all notifications
          </a>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
