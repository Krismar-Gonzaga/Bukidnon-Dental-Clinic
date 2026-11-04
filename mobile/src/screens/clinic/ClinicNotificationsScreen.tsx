// Notifications for clinic members (web: ClinicNotificationsPage): filter by
// group, open what it is about, and choose what to be told about.
import React, { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { ClinicScreen, useOpenSection } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { NotificationPreferences } from '../../components/clinic/ClinicAdminKit';
import { Button, Chips, EmptyState, FormError, LoadState, ui, useLoader } from '../../components/clinic/ClinicUi';
import { can, formatDateTime, serverMessage } from '../../services/clinicPortal';
import { AppNotification, fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../../services/notifications';
import { palette, radius, spacing } from '../../theme/tokens';

type Group = 'all' | 'appointment' | 'inventory' | 'system';

// The API's notification `kind`, grouped the way the design filters them.
const groupOf = ({ kind }: AppNotification): Exclude<Group, 'all'> => {
  if (kind === 'appointment' || kind === 'reminder') return 'appointment';
  if (kind === 'inventory') return 'inventory';
  return 'system';
};

const GROUP_ICONS = { appointment: 'calendar-outline', inventory: 'cube-outline', system: 'notifications-outline' };
const GROUP_TINTS = { appointment: palette.primaryFixed, inventory: '#fff4d6', system: palette.surfaceContainerLow };

const FILTERS: { id: Group; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'appointment', label: 'Appointment' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'system', label: 'System' },
];

const ClinicNotificationsScreen = () => {
  const navigation = useNavigation<any>();
  const open = useOpenSection('ClinicNotifications');
  const { membership, memberships, selectClinic, setUnreadCount } = useClinicPortal();
  const list = useLoader(async () => {
    const result = await fetchNotifications();
    setUnreadCount(result.unreadCount);
    return result;
  }, [], 'Notifications could not be loaded.');
  const [tab, setTab] = useState<'notifications' | 'settings'>('notifications');
  const [filter, setFilter] = useState<Group>('all');
  const [error, setError] = useState<string | null>(null);
  const items = list.data?.notifications ?? [];
  const unread = list.data?.unreadCount ?? 0;
  const visible = items.filter((item) => filter === 'all' || groupOf(item) === filter);

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
    if (type === 'clinic_dentist' && id && can(target, 'clinic.dentists.manage', 'clinic.schedules.manage')) {
      navigation.navigate('ClinicDentistProfile', { dentistId: id });
      return;
    }
    if (type === 'dentist_schedule') {
      open('ClinicMySchedule');
      return;
    }
    if (type === 'clinic_patient' && id && can(target, 'patients.view')) {
      navigation.navigate('ClinicPatientDetail', { patientId: id });
      return;
    }
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

  // Clinic staff and dentists: one feed with Mark read on each row. Dentists can also reach their preferences.
  const isDentist = membership?.role === 'dentist';
  const isFrontDesk = membership?.role === 'staff' || isDentist;
  const tabs = isFrontDesk && !isDentist ? null : (
    <Chips
      options={[
        { id: 'notifications' as const, label: 'Notifications' },
        { id: 'settings' as const, label: 'Settings' },
      ]}
      value={tab}
      onChange={setTab}
      scroll={false}
    />
  );

  return (
    <ClinicScreen title="Notifications" active="ClinicNotifications" back>
      {tab === 'settings' ? (
        <ScrollView contentContainerStyle={ui.content}>
          {tabs}
          <NotificationPreferences />
        </ScrollView>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(n) => n.id}
          contentContainerStyle={ui.content}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} colors={[palette.primary]} />}
          ListHeaderComponent={
            <View style={ui.stack}>
              {tabs}
              {isFrontDesk ? <Text style={ui.muted}>{unread} unread</Text> : <Chips options={FILTERS} value={filter} onChange={setFilter} />}
              {unread > 0 && <Button small variant="tonal" icon="checkmark-done-outline" label={isFrontDesk ? 'Mark all read' : 'Mark all as read'} onPress={readAll} />}
              <FormError message={error} />
              <LoadState loading={list.loading} error={list.data ? null : list.error} onRetry={list.reload} />
            </View>
          }
          ListEmptyComponent={list.loading || list.error ? undefined : <EmptyState icon="notifications-off-outline" text="No notifications here yet." />}
          renderItem={({ item }) => {
            const group = groupOf(item);
            return (
              <TouchableOpacity
                style={[styles.item, !item.readAt && styles.unread]}
                onPress={() => go(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.readAt ? '' : 'Unread. '}${item.title}. ${item.message}`}
              >
                <View style={[styles.icon, { backgroundColor: GROUP_TINTS[group] }]}>
                  <Icon name={GROUP_ICONS[group]} size={18} color={palette.primary} />
                </View>
                <View style={ui.flex}>
                  <Text style={ui.title}>{item.title}</Text>
                  <Text style={ui.muted}>{item.message}</Text>
                  <Text style={ui.small}>{formatDateTime(item.createdAt)}</Text>
                </View>
                {!item.readAt && (isFrontDesk ? <Button small variant="outline" label="Mark read" onPress={() => markRead(item)} /> : <View style={styles.dot} />)}
              </TouchableOpacity>
            );
          }}
        />
      )}
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
  unread: { borderColor: palette.primaryFixedDim, backgroundColor: '#eef4ff' },
  icon: { width: 36, height: 36, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.primary, marginTop: 8 },
});

export default ClinicNotificationsScreen;
