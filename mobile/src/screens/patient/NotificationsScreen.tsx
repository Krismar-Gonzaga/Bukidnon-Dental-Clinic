// src/screens/patient/NotificationsScreen.tsx
// In-app notifications (appointment updates and reminders). These come
// straight from the server; there is no offline copy.
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { isNetworkError } from '../../services/api';
import {
  AppNotification,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notifications';

const formatWhen = (iso: string | null) => {
  if (!iso) {
    return '';
  }
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const NotificationsScreen = ({ navigation }: { navigation: any }) => {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchNotifications();
      setItems(result.notifications);
      setUnreadCount(result.unreadCount);
      setError(null);
    } catch (err) {
      setError(
        isNetworkError(err)
          ? "You're offline. Notifications will load when you're back online."
          : 'Notifications could not be loaded.',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (item: AppNotification) => {
    if (!item.readAt) {
      setItems((list) => list.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
      setUnreadCount((count) => Math.max(0, count - 1));
      markNotificationRead(item.id).catch(() => undefined);
    }
    if (item.resource?.type === 'appointment') {
      navigation.navigate('Appointments');
    }
  };

  const readAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((list) => list.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
      setUnreadCount(0);
    } catch {
      setError('Could not mark notifications as read. Please try again.');
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#003f87" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <TouchableOpacity style={styles.readAll} onPress={readAll} accessibilityRole="button">
          <Text style={styles.readAllText}>Mark all as read ({unreadCount})</Text>
        </TouchableOpacity>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        ListEmptyComponent={
          error ? null : (
            <View style={styles.centered}>
              <Icon name="notifications-off-outline" size={48} color="#a0aec0" />
              <Text style={styles.empty}>No notifications yet.</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, !item.readAt && styles.itemUnread]}
            onPress={() => open(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.readAt ? '' : 'Unread. '}${item.title}. ${item.message}`}
          >
            {!item.readAt && <View style={styles.dot} />}
            <View style={styles.itemBody}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.message}>{item.message}</Text>
              <Text style={styles.time}>{formatWhen(item.createdAt)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9ff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  readAll: { alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 12, minHeight: 44 },
  readAllText: { color: '#003f87', fontWeight: '600', fontSize: 14 },
  error: { color: '#c53030', paddingHorizontal: 16, paddingVertical: 8, fontSize: 14 },
  empty: { marginTop: 12, color: '#718096', fontSize: 15 },
  item: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  itemUnread: { borderColor: '#003f87', backgroundColor: '#eef4ff' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#003f87', marginTop: 6, marginRight: 10 },
  itemBody: { flex: 1 },
  title: { fontSize: 15, fontWeight: '600', color: '#1a202c' },
  message: { fontSize: 14, color: '#4a5568', marginTop: 4 },
  time: { fontSize: 12, color: '#718096', marginTop: 6 },
});

export default NotificationsScreen;
