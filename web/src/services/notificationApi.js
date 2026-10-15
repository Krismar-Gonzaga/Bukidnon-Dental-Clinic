import apiClient from './apiClient';
import { toNotification } from './adapters';

// In-app notification center (any signed-in user).

export async function getNotifications({ page = 1, perPage = 20 } = {}) {
  const { data } = await apiClient.get('/notifications', { params: { page, per_page: perPage } });
  return {
    notifications: data.data.map(toNotification),
    unreadCount: data.meta?.unread_count ?? 0,
    pageCount: data.meta?.last_page ?? 1,
  };
}

export const markNotificationRead = (id) => apiClient.post(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => apiClient.post('/notifications/read-all');
export const updateNotificationPreferences = (preferences) =>
  apiClient.put('/notification-preferences', preferences);
