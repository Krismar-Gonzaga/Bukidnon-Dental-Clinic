// Notifications for clinic members (web: ClinicNotificationsPage, the top
// bar bell). Opening one marks it read and goes to the page it is about.
import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ClinicScreen, useOpenSection } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { Button, EmptyState, FormError, LoadState, ui, useLoader } from '../../components/clinic/ClinicUi';
import { can, formatDateTime, serverMessage } from '../../services/clinicPortal';
import { AppNotification, fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../../services/notifications';
import { palette, radius, spacing } from '../../theme/tokens';

const ClinicNotificationsScreen = () => {
  const navigation = useNavigation<any>();
  const open = useOpenSection('ClinicNotifications');
  const { membership, memberships, selectClinic, setUnreadCount } = useClinicPortal();
  const list = useLoader(async () => {
    const result = await fetchNotifications();
    setUnreadCount(result.unreadCount);
    return result;
  }, [], 'Notifications could not be loaded.');
  const [error, setError] = useState<string | null>(null);
  const items = list.data?.notifications ?? [];
  const unread = list.data?.unreadCount ?? 0;

  const markRead = (item: AppNotification) => {
    if (item.readAt || !list.data) return;
    const next = Math.max(0, unread - 1);
    list.setData({
      notifications: items.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)),
      unreadCount: next,
    });
    setUnreadCount(next);
    markNotificationRead(item.id).catch(() => undefined);
  };

  const go = (item: AppNotification) => {
    markRead(item);
    const { type, id, clinic_id: clinicId } = item.resource ?? {};
    // Notifications can be about another clinic this person works at.
    if (clinicId && clinicId !== membership?.clinic_id && memberships.some((m) => m.clinic_id === clinicId)) selectClinic(clinicId);
    const target = memberships.find((m) => m.clinic_id === clinicId) ?? membership;
    if (type === 'clinic_appointment' && id && can(target, 'appointments.view_all', 'appointments.view_assigned')) {
      navigation.navigate('ClinicAppointmentDetail', { appointmentId: id });
    } else if (type === 'inventory_alerts' && can(target, 'inventory.view')) {
      open('ClinicInventory');
    }
  };

  const readAll = async () => {
    setError(null);
    try {
      await markAllNotificationsRead();
      list.setData({ notifications: items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })), unreadCount: 0 });
      setUnreadCount(0);
    } catch (err) {
      setError(serverMessage(err, 'Could not mark notifications as read.'));
    }
  };

  return (
    <ClinicScreen title="Notifications" active="ClinicNotifications" back>
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} colors={[palette.primary]} />}
        ListHeaderComponent={
          <View style={ui.stack}>
            {unread > 0 && <Button small variant="tonal" icon="checkmark-done-outline" label={`Mark all as read (${unread})`} onPress={readAll} />}
            <FormError message={error} />
            <LoadState loading={list.loading} error={list.data ? null : list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.loading || list.error ? undefined : <EmptyState icon="notifications-off-outline" text="No notifications yet." />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, !item.readAt && styles.unread]}
            onPress={() => go(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.readAt ? '' : 'Unread. '}${item.title}. ${item.message}`}
          >
            {!item.readAt && <View style={styles.dot} />}
            <View style={ui.flex}>
              <Text style={ui.title}>{item.title}</Text>
              <Text style={ui.muted}>{item.message}</Text>
              <Text style={ui.small}>{formatDateTime(item.createdAt)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surfaceContainerLowest,
  },
  unread: { borderColor: palette.primary, backgroundColor: '#eef4ff' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.primary, marginTop: 8 },
});

export default ClinicNotificationsScreen;
