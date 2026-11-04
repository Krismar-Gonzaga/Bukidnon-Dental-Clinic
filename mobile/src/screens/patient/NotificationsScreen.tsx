// In-app notifications (appointment updates and reminders). These come straight from the
// server; there is no offline copy.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import PatientShell from '../../components/patient/PatientShell';
import { guestColors, Message } from '../../components/guest/GuestUi';
import { isNetworkError } from '../../services/api';
import { AppNotification, fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../../services/notifications';
import { spacing, type } from '../../theme/tokens';
import { timeAgo } from '../../utils/format';

/** Reminders, confirmations, and everything else, as on the website. */
export const notificationStyle = (kind: string | null) => {
  if (kind === 'reminder') {
    return { icon: 'notifications-outline', color: guestColors.primary, background: '#d7e2ff' };
  }
  if (kind === 'appointment' || kind === 'clinic_verification') {
    return { icon: 'checkmark-circle-outline', color: '#22a35a', background: '#e8f7ee' };
  }
  return { icon: 'chatbox-outline', color: guestColors.textMuted, background: guestColors.neutralSoft };
};

const Separator = () => <View style={styles.separator} />;

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
      setError(isNetworkError(err) ? "You're offline. Notifications will load when you're back online." : 'Notifications could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = (item: AppNotification) => {
    if (!item.readAt) {
      setItems((list) => list.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
      setUnreadCount((count) => Math.max(0, count - 1));
      markNotificationRead(item.id).catch(() => undefined);
    }
    if (item.resource?.type === 'appointment' && item.resource.id) {
      navigation.navigate('AppointmentDetails', { appointmentId: item.resource.id });
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

  return (
    <PatientShell navigation={navigation} title="Notifications" active="Notifications">
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={guestColors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.count}>
                {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}
              </Text>
              {unreadCount > 0 && (
                <TouchableOpacity style={styles.readAll} onPress={readAll} accessibilityRole="button">
                  <Icon name="checkmark" size={16} color={guestColors.primary} />
                  <Text style={styles.readAllText}>Mark all as read</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          renderItem={({ item }) => {
            const look = notificationStyle(item.kind);
            return (
              <TouchableOpacity style={styles.card} onPress={() => open(item)} activeOpacity={0.85} accessibilityRole="button">
                <View style={[styles.icon, { backgroundColor: look.background }]}>
                  <Icon name={look.icon} size={20} color={look.color} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.title}>{item.title}</Text>
                  <Text style={styles.message}>{item.message}</Text>
                  <Text style={styles.time}>{item.createdAt ? timeAgo(Date.parse(item.createdAt)) : ''}</Text>
                </View>
                {!item.readAt && <View style={styles.dot} accessibilityLabel="Unread" />}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            error ? (
              <Message icon="cloud-offline-outline" title={error} actionLabel="Try again" onAction={load} />
            ) : (
              <Message icon="notifications-outline" title="No notifications yet" body="Appointment updates and reminders appear here." />
            )
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              colors={[guestColors.primary]}
              tintColor={guestColors.primary}
            />
          }
        />
      )}
    </PatientShell>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: 64 },
  list: { padding: spacing.marginMobile, paddingBottom: spacing.xl },
  separator: { height: spacing.sm },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.base, marginBottom: spacing.md },
  count: { ...type.bodyMd, color: guestColors.textMuted },
  readAll: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  readAllText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: guestColors.primary },
  card: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: 16, borderWidth: 1, borderColor: guestColors.border, backgroundColor: guestColors.surface },
  icon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: guestColors.text },
  message: { ...type.bodyMd, color: guestColors.textMuted },
  time: { fontSize: 12, lineHeight: 18, color: guestColors.textMuted, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: spacing.xs, backgroundColor: '#2f80f7' },
});

export default NotificationsScreen;
