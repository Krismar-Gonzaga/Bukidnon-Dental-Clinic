import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import ClinicLayout, { useClinicAccess } from '../../layouts/ClinicLayout';
import { isDentistMember, isFrontDeskMember } from '../../config/clinicNavigation';
import Icon from '../../components/Icon';
import { NotificationPreferences } from '../../components/clinic/ClinicAdminUi';
import { PageTabs } from '../../components/clinic/ClinicUi';
import { FormError } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { useAuth } from '../../auth/AuthContext';
import { NOTIFICATIONS_KEY } from '../../hooks/useUnreadNotifications';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../../services/notificationApi';
import { getNotificationHref } from '../../utils/notificationLinks';
import '../../components/clinic/ClinicAdminUi.css';

// The API's notification `kind`, grouped the way the design filters them.
const groupOf = ({ kind }) => {
  if (['appointment', 'reminder', 'follow_up', 'schedule'].includes(kind)) return 'appointment';
  if (kind === 'inventory') return 'inventory';
  return 'system';
};

const GROUP_ICONS = { appointment: 'calendarBlank', inventory: 'package', system: 'bell' };

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'system', label: 'System' },
];

function NotificationItem({ notification, onOpen }) {
  const group = groupOf(notification);
  return (
    <li>
      <button type="button" className={`clinic-notice${notification.unread ? ' is-unread' : ''}`} onClick={onOpen}>
        <span className={`clinic-notice-icon is-${group}`}>
          <Icon name={GROUP_ICONS[group]} size={18} />
        </span>
        <span className="clinic-notice-body">
          <span className="clinic-notice-title">{notification.title}</span>
          <span className="clinic-notice-text">{notification.message}</span>
        </span>
        <span className="clinic-notice-time">{notification.time}</span>
        {notification.unread && (
          <span className="clinic-notice-dot">
            <span className="visually-hidden">Unread</span>
          </span>
        )}
      </button>
    </li>
  );
}

function NotificationFeed({ query, onOpen }) {
  const [filter, setFilter] = useState('all');
  return (
    <>
      <div className="clinic-chips" role="group" aria-label="Filter notifications">
        {FILTERS.map(({ value, label }) => (
          <button key={value} type="button" className={`clinic-chip-button${filter === value ? ' is-active' : ''}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>
            {label}
          </button>
        ))}
      </div>
      <QueryState query={query} loadingLabel="Loading notifications…">
        {({ notifications }) => {
          const visible = notifications.filter((item) => filter === 'all' || groupOf(item) === filter);
          return visible.length === 0 ? (
            <p className="portal-empty">No notifications here yet.</p>
          ) : (
            <ul className="clinic-notice-list">
              {visible.map((notification) => (
                <NotificationItem key={notification.id} notification={notification} onOpen={() => onOpen(notification)} />
              ))}
            </ul>
          );
        }}
      </QueryState>
    </>
  );
}

function FrontDeskFeed({ query, onOpen, onMarkRead, unreadOnly = false }) {
  return (
    <QueryState query={query} loadingLabel="Loading notifications…">
      {({ notifications: all }) => {
        const notifications = unreadOnly ? all.filter((item) => item.unread) : all;
        return notifications.length === 0 ? (
          <p className="portal-empty">No notifications yet.</p>
        ) : (
          <ul className="frontdesk-list">
            {notifications.map((notification) => (
              <li key={notification.id} className={`frontdesk-notice${notification.unread ? ' is-unread' : ''}`}>
                <span className={`clinic-notice-icon is-${groupOf(notification)}`}>
                  <Icon name="bell" size={18} />
                </span>
                <button type="button" className="frontdesk-notice-open" onClick={() => onOpen(notification)}>
                  <span className="frontdesk-notice-title">
                    {notification.title}
                    {notification.unread && <span className="clinic-notice-dot"><span className="visually-hidden">Unread</span></span>}
                  </span>
                  <span className="clinic-notice-text">{notification.message}</span>
                  <span className="clinic-file-meta">{notification.time}</span>
                </button>
                {notification.unread && (
                  <button type="button" className="clinic-link-button" aria-label={`Mark ${notification.title} as read`} onClick={() => onMarkRead(notification.id)}>
                    Mark read
                  </button>
                )}
              </li>
            ))}
          </ul>
        );
      }}
    </QueryState>
  );
}

function ClinicNotificationsPage() {
  const { membership } = useClinicAccess();
  const isDentist = isDentistMember(membership);
  // Clinic staff and dentists: one feed with Mark read on each row.
  const isFrontDesk = isFrontDeskMember(membership) || isDentist;
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('notifications');
  const query = useQuery({ queryKey: [...NOTIFICATIONS_KEY, 'list'], queryFn: () => getNotifications({ perPage: 50 }) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
  const markAll = useMutation({ mutationFn: () => markAllNotificationsRead(), onSuccess: refresh });
  const markOne = useMutation({ mutationFn: (id) => markNotificationRead(id), onSuccess: refresh });

  const open = (notification) => {
    if (notification.unread) markOne.mutate(notification.id);
    const href = getNotificationHref(notification, user);
    if (href) navigate(href);
  };

  return (
    <ClinicLayout
      section="notifications"
      title="Notifications"
      subtitle={isFrontDesk && query.data ? `${query.data.unreadCount} unread` : null}
      hideSearch
      headerActions={
        tab === 'notifications' &&
        (query.data?.unreadCount ?? 0) > 0 && (
          <button type="button" className={isFrontDesk ? 'clinic-action-button' : 'clinic-link-button'} disabled={markAll.isPending} onClick={() => markAll.mutate()}>
            {isFrontDesk && <Icon name="checkCircle" size={16} />}
            {isFrontDesk ? 'Mark all read' : 'Mark all as read'}
          </button>
        )
      }
    >
      {isDentist ? (
        <>
          <PageTabs
            label="Notification sections"
            value={tab}
            onChange={setTab}
            tabs={[
              { value: 'notifications', label: 'All' },
              { value: 'unread', label: `Unread (${query.data?.unreadCount ?? 0})` },
              { value: 'settings', label: 'Preferences' },
            ]}
          />
          <FormError error={markAll.error || markOne.error} />
          {tab === 'settings' ? (
            <div className="clinic-form-page">
              <NotificationPreferences />
            </div>
          ) : (
            <div className="clinic-form-gap">
              <FrontDeskFeed query={query} unreadOnly={tab === 'unread'} onOpen={open} onMarkRead={(id) => markOne.mutate(id)} />
            </div>
          )}
        </>
      ) : isFrontDesk ? (
        <>
          <FormError error={markAll.error || markOne.error} />
          <FrontDeskFeed query={query} onOpen={open} onMarkRead={(id) => markOne.mutate(id)} />
        </>
      ) : (
      <>
      <PageTabs
        label="Notification sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'notifications', label: 'Notifications' },
          { value: 'settings', label: 'Settings' },
        ]}
      />
      <FormError error={markAll.error} />
      {tab === 'notifications' ? (
        <NotificationFeed query={query} onOpen={open} />
      ) : (
        <div className="clinic-form-page">
          <NotificationPreferences />
        </div>
      )}
      </>
      )}
    </ClinicLayout>
  );
}

export default ClinicNotificationsPage;
