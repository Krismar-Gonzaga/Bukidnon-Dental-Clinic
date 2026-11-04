// Patient dashboard, laid out like the website's. Reads through the offline layer, so the
// last figures stay visible without a connection; notifications need one.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import PatientShell from '../../components/patient/PatientShell';
import { AppointmentCard } from '../../components/patient/PatientUi';
import { Card, guestColors, Message } from '../../components/guest/GuestUi';
import { useSync } from '../../context/SyncContext';
import { patientService } from '../../services/api';
import { AppNotification, fetchNotifications } from '../../services/notifications';
import { Appointment } from '../../services/patientPortal';
import { spacing, type } from '../../theme/tokens';
import { timeAgo } from '../../utils/format';

type Dashboard = {
  name: string;
  upcoming: Appointment[];
  counts: { upcoming: number; pending: number; completed: number; saved_clinics: number; reviews_given: number };
  unread_notifications: number;
};

const LATEST_NOTIFICATIONS = 3;

const QUICK_ACTIONS = [
  { label: 'Find a Clinic', icon: 'business-outline', route: 'GuestClinics' },
  { label: 'Clinic Locator', icon: 'map-outline', route: 'ClinicLocator' },
  { label: 'My Saved Clinics', icon: 'heart-outline', route: 'SavedClinics' },
  { label: 'Leave a Review', icon: 'star-outline', route: 'Feedback' },
];

const greeting = (hour = new Date().getHours()) => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

const PatientHomeScreen = ({ navigation }: { navigation: any }) => {
  const { dataVersion, syncNow } = useSync();
  const [data, setData] = useState<Dashboard | null>(null);
  // Null until the first answer: "none yet" must not flash while they load.
  const [notifications, setNotifications] = useState<AppNotification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await patientService.getDashboard();
      setData(response.data.data as Dashboard | null);
    } catch (error) {
      console.error('Failed to load the dashboard:', error);
    } finally {
      setLoading(false);
    }
    try {
      const latest = await fetchNotifications();
      setNotifications(latest.notifications.slice(0, LATEST_NOTIFICATIONS));
      setUnread(latest.unreadCount);
    } catch {
      // Offline: the section keeps what it last showed.
      setNotifications((current) => current ?? []);
    }
  }, []);

  useEffect(() => {
    load();
    return navigation.addListener?.('focus', load);
  }, [load, navigation, dataVersion]);

  const onRefresh = async () => {
    setRefreshing(true);
    await syncNow();
    await load();
    setRefreshing(false);
  };

  const reschedule = (appointment: Appointment) => navigation.navigate('Reschedule', { appointment });
  const counts = data?.counts;
  const confirmed = counts ? Math.max(0, counts.upcoming - counts.pending) : 0;

  const stats = counts
    ? [
        { label: 'Upcoming', value: counts.upcoming, icon: 'calendar-outline', color: '#2f80f7', background: '#eaf0fb' },
        { label: 'Completed', value: counts.completed, icon: 'checkmark-circle-outline', color: '#22a35a', background: '#e8f7ee' },
        { label: 'Saved Clinics', value: counts.saved_clinics, icon: 'heart-outline', color: '#ef3b3b', background: '#fdecec' },
        { label: 'Reviews Given', value: counts.reviews_given, icon: 'star-outline', color: '#f5a524', background: '#fdf3e2' },
      ]
    : [];

  return (
    <PatientShell navigation={navigation} title="Dashboard" active="Home">
      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color={guestColors.primary} />
      ) : !data ? (
        <Message icon="cloud-offline-outline" title="Your dashboard isn't saved yet" body="Connect to the internet to load it." actionLabel="Try again" onAction={load} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[guestColors.primary]} tintColor={guestColors.primary} />}
        >
          <View style={styles.hero}>
            <Text style={styles.heroGreeting}>{greeting()},</Text>
            <Text style={styles.heroName}>{data.name}</Text>
            <Text style={styles.heroText}>
              You have <Text style={styles.heroStrong}>{plural(confirmed, 'confirmed appointment')}</Text> and{' '}
              <Text style={styles.heroPending}>{counts?.pending ?? 0} pending approval</Text>.
            </Text>
            <View style={styles.heroActions}>
              <TouchableOpacity style={styles.heroPrimary} onPress={() => navigation.navigate('BookAppointment')} accessibilityRole="button">
                <Text style={styles.heroPrimaryText}>Book Appointment</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.heroSecondary} onPress={() => navigation.navigate('GuestClinics')} accessibilityRole="button">
                <Text style={styles.heroSecondaryText}>Find Clinics</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.stats}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.stat}>
                <View style={[styles.statIcon, { backgroundColor: stat.background }]}>
                  <Icon name={stat.icon} size={20} color={stat.color} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Appointments</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Appointments')} accessibilityRole="link" hitSlop={8}>
              <Text style={styles.link}>View All</Text>
            </TouchableOpacity>
          </View>
          {data.upcoming.length > 0 ? (
            <View style={styles.stack}>
              {data.upcoming.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  highlightPending
                  onView={() => navigation.navigate('AppointmentDetails', { appointment })}
                  onReschedule={() => reschedule(appointment)}
                />
              ))}
            </View>
          ) : (
            <Message icon="calendar-outline" title="No upcoming appointments" actionLabel="Book an Appointment" onAction={() => navigation.navigate('BookAppointment')} />
          )}

          <Card style={styles.sideCard}>
            <View style={[styles.sectionHeader, styles.cardHeader]}>
              <Text style={styles.cardTitle}>Notifications</Text>
              {unread > 0 && (
                <View style={styles.count}>
                  <Text style={styles.countText}>{unread}</Text>
                </View>
              )}
            </View>
            {notifications === null ? (
              <ActivityIndicator color={guestColors.primary} />
            ) : notifications.length === 0 ? (
              <Text style={styles.empty}>No notifications yet.</Text>
            ) : (
              notifications.map((item) => (
                <View key={item.id} style={[styles.notification, !item.readAt && styles.notificationUnread]}>
                  <View style={[styles.notificationDot, !item.readAt && styles.notificationDotUnread]} />
                  <View style={styles.flex}>
                    <Text style={styles.notificationTitle}>{item.title}</Text>
                    <Text style={styles.notificationTime}>{item.createdAt ? timeAgo(Date.parse(item.createdAt)) : ''}</Text>
                  </View>
                </View>
              ))
            )}
            <TouchableOpacity style={styles.viewAll} onPress={() => navigation.navigate('Notifications')} accessibilityRole="link">
              <Text style={styles.link}>View all notifications</Text>
            </TouchableOpacity>
          </Card>

          <Card style={styles.sideCard}>
            <Text style={styles.cardTitle}>Quick Actions</Text>
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity key={action.label} style={styles.quickAction} onPress={() => navigation.navigate(action.route)} accessibilityRole="link">
                <View style={styles.quickIcon}>
                  <Icon name={action.icon} size={18} color={guestColors.primary} />
                </View>
                <Text style={styles.quickLabel}>{action.label}</Text>
                <Icon name="chevron-forward" size={18} color={guestColors.textMuted} />
              </TouchableOpacity>
            ))}
          </Card>
        </ScrollView>
      )}
    </PatientShell>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: 64 },
  content: { padding: spacing.marginMobile, paddingBottom: spacing.xl },

  hero: { padding: spacing.lg, borderRadius: 20, backgroundColor: '#00479b' },
  heroGreeting: { fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.8)' },
  heroName: { fontSize: 24, lineHeight: 32, fontWeight: '700', color: '#ffffff', marginTop: 2 },
  heroText: { fontSize: 14, lineHeight: 21, color: 'rgba(255,255,255,0.9)', marginTop: spacing.xs },
  heroStrong: { fontWeight: '700', color: '#ffffff' },
  heroPending: { fontWeight: '700', color: '#ffd84d' },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  heroPrimary: { paddingHorizontal: spacing.md, paddingVertical: 11, borderRadius: 10, backgroundColor: '#ffffff' },
  heroPrimaryText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: guestColors.primary },
  heroSecondary: { paddingHorizontal: spacing.md, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.1)' },
  heroSecondaryText: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: '#ffffff' },

  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm, marginTop: spacing.md },
  stat: { width: '48.5%', padding: spacing.md, borderRadius: 16, borderWidth: 1, borderColor: guestColors.border, backgroundColor: guestColors.surface },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  statValue: { fontSize: 24, lineHeight: 30, fontWeight: '700', color: guestColors.text },
  statLabel: { fontSize: 14, lineHeight: 20, color: guestColors.textMuted },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, marginBottom: spacing.sm },
  cardHeader: { marginTop: 0 },
  sectionTitle: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: guestColors.text },
  link: { fontSize: 14, lineHeight: 20, fontWeight: '600', color: guestColors.primary },
  stack: { gap: spacing.sm },

  sideCard: { marginTop: spacing.md, padding: spacing.md },
  cardTitle: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: guestColors.text },
  count: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef3b3b' },
  countText: { fontSize: 12, fontWeight: '700', color: '#ffffff' },
  empty: { ...type.bodyMd, color: guestColors.textMuted },
  notification: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: 10, marginBottom: spacing.xs },
  notificationUnread: { backgroundColor: guestColors.primarySoft },
  notificationDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#c5cad6' },
  notificationDotUnread: { backgroundColor: '#2f80f7' },
  notificationTitle: { fontSize: 13, lineHeight: 18, fontWeight: '600', color: guestColors.text },
  notificationTime: { fontSize: 12, lineHeight: 16, color: guestColors.textMuted },
  viewAll: { alignItems: 'center', paddingTop: spacing.sm },
  quickAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.base, marginTop: spacing.xs },
  quickIcon: { width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: guestColors.primarySoft },
  quickLabel: { flex: 1, fontSize: 15, lineHeight: 20, color: guestColors.text },
});

export default PatientHomeScreen;
