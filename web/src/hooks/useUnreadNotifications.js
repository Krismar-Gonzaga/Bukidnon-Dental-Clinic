import { useQuery } from '@tanstack/react-query';
import { getNotifications } from '../services/notificationApi';
import { useAuth } from '../auth/AuthContext';

export const NOTIFICATIONS_KEY = ['notifications'];

/** Unread count for the bell in portal top bars. */
export function useUnreadNotifications() {
  const { isAuthenticated } = useAuth();
  const query = useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'unread'],
    queryFn: () => getNotifications({ perPage: 1 }),
    enabled: isAuthenticated,
    staleTime: 60 * 1000,
  });

  return query.data?.unreadCount ?? 0;
}
