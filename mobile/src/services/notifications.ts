// In-app notification center (GET /notifications). Online only.
import api from './http';

export type AppNotification = {
  id: string;
  kind: string | null;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string | null;
  resource: { type?: string; id?: number } | null;
};

export const fetchNotifications = async (page = 1) => {
  const response = await api.get('/notifications', { params: { page, per_page: 30 } });
  const notifications: AppNotification[] = (response.data?.data ?? []).map((n: any) => ({
    id: String(n.id),
    kind: n.kind ?? null,
    title: n.title ?? 'Notification',
    message: n.message ?? '',
    readAt: n.read_at ?? null,
    createdAt: n.created_at ?? null,
    resource: n.resource ?? null,
  }));
  return { notifications, unreadCount: Number(response.data?.meta?.unread_count ?? 0) };
};

export const markNotificationRead = (id: string) => api.post(`/notifications/${id}/read`);
export const markAllNotificationsRead = () => api.post('/notifications/read-all');
