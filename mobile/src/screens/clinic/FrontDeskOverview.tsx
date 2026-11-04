// The front desk's day (web: FrontDeskOverview): who is due, who has arrived,
// what comes next. Navy like the clinic admin screens.
import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useOpenSection } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { InitialsTile, StatRow } from '../../components/clinic/ClinicAdminKit';
import { Badge, Card, EmptyState, LoadState, ui, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import { useAuth } from '../../context/AuthContext';
import { toBusinessDateKey } from '../../services/booking';
import { can, ClinicAppointment, clinicClock, fetchAppointments, formatDateTime, frontDeskStatus, hasCheckedIn } from '../../services/clinicPortal';
import { formatClockTime } from '../../services/booking';
import { fetchNotifications } from '../../services/notifications';
import { palette, radius, spacing, type } from '../../theme/tokens';
import { addDays } from './ClinicAppointmentsScreen';

const UPCOMING_DAYS = 3;
const UPCOMING_LIMIT = 4;

const greeting = () => {
  const hour = (new Date().getUTCHours() + 8) % 24;
  if (hour < 12) return 'Good morning,';
  return hour < 18 ? 'Good afternoon,' : 'Good evening,';
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export const summarizeToday = (rows: ClinicAppointment[]) => {
  const count = (...statuses: string[]) => rows.filter((a) => statuses.includes(a.status)).length;
  return {
    total: rows.length,
    waiting: count('checked_in'),
    ongoing: count('in_progress'),
    checkedIn: count('checked_in', 'in_progress'),
    completed: count('completed'),
    pending: count('pending'),
    noShow: count('no_show'),
  };
};

const FrontDeskOverview = () => {
  const navigation = useNavigation<any>();
  const open = useOpenSection('ClinicDashboard');
  const { user } = useAuth();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const today = toBusinessDateKey(new Date());

  const data = useLoader(
    async () => {
      const [todayPage, upcomingPage, notices] = await Promise.all([
        fetchAppointments(clinicId, { from: today, to: today, per_page: 100 }),
        fetchAppointments(clinicId, { from: addDays(today, 1), to: addDays(today, UPCOMING_DAYS), status: 'pending,confirmed', per_page: 100 }),
        fetchNotifications(),
      ]);
      return { todays: todayPage.items, upcoming: upcomingPage.items, notices: notices.notifications.slice(0, 2) };
    },
    [clinicId, today],
    "Today's figures could not be loaded.",
  );
  useRefreshOnFocus(data.sync);

  const todays = data.data?.todays ?? [];
  const upcoming = data.data?.upcoming ?? [];
  const summary = summarizeToday(todays);
  const openAppointment = (id: number) => navigation.navigate('ClinicAppointmentDetail', { appointmentId: id });

  const tiles = [
    { icon: 'calendar-outline', value: summary.total, label: "Today's Appointments", note: 'All statuses' },
    { icon: 'person-outline', value: summary.checkedIn, label: 'Checked In', note: 'In queue or ongoing' },
    { icon: 'checkmark-circle-outline', value: summary.completed, label: 'Completed', note: 'Today' },
    { icon: 'time-outline', value: summary.pending, label: 'Pending Confirmation', note: 'Needs action' },
  ];
  const quick = [
    ...(can(membership, 'patients.manage') ? [{ icon: 'person-add-outline', label: 'Register Patient', onPress: () => open('ClinicPatients', { register: true }) }] : []),
    ...(can(membership, 'appointments.manage')
      ? [
          { icon: 'calendar-outline', label: 'Schedule Appointment', onPress: () => navigation.navigate('ClinicWalkIn', { scheduled: true }) },
          { icon: 'person-outline', label: 'Check In Patient', onPress: () => open('ClinicCheckIn') },
        ]
      : []),
    { icon: 'today-outline', label: "Today's Appointments", onPress: () => open('ClinicAppointments', { date: today }) },
  ];

  return (
    <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={data.refresh} colors={[palette.primary]} />}>
      <View style={styles.hero}>
        <Text style={styles.heroGreeting}>{greeting()}</Text>
        <Text style={styles.heroName}>{user?.name}</Text>
        <Text style={styles.heroText}>
          <Text style={styles.heroStrong}>{plural(summary.total, 'appointment', 'appointments')}</Text> today. <Text style={styles.heroAccent}>{plural(summary.waiting, 'patient', 'patients')}</Text> in the waiting area.
        </Text>
        <TouchableOpacity style={styles.heroButton} onPress={() => open('ClinicCheckIn')} accessibilityRole="button">
          <Icon name="person-outline" size={18} color={palette.primary} />
          <Text style={styles.heroButtonText}>Check In Patient</Text>
        </TouchableOpacity>
      </View>

      <LoadState loading={data.loading} error={data.data ? null : data.error} onRetry={data.reload} />

      <View style={styles.grid}>
        {tiles.map((tile) => (
          <View key={tile.label} style={styles.tile}>
            <View style={styles.tileIcon}>
              <Icon name={tile.icon} size={20} color={palette.primary} />
            </View>
            <Text style={styles.tileValue}>{tile.value}</Text>
            <Text style={styles.tileLabel}>{tile.label}</Text>
            <Text style={ui.small}>{tile.note}</Text>
          </View>
        ))}
      </View>

      <Text style={ui.title}>Quick Actions</Text>
      <View style={styles.grid}>
        {quick.map((item) => (
          <TouchableOpacity key={item.label} style={styles.quick} onPress={item.onPress} accessibilityRole="button">
            <Icon name={item.icon} size={24} color={palette.primary} />
            <Text style={styles.quickText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Card title="Today's Appointment Queue">
        {data.data && todays.length === 0 && <EmptyState icon="calendar-outline" text="No appointments today." />}
        {todays.map((a, index) => {
          const status = frontDeskStatus(a.status);
          const arrived = hasCheckedIn(a.status);
          return (
            <TouchableOpacity
              key={a.id}
              style={[styles.queueRow, arrived && styles.queueArrived, a.status === 'pending' && styles.queuePending]}
              onPress={() => openAppointment(a.id)}
              accessibilityRole="button"
              accessibilityLabel={`${a.patient?.name}, ${status.label}`}
            >
              <View style={styles.number}>
                <Text style={styles.numberText}>{index + 1}</Text>
              </View>
              <View style={ui.flex}>
                <Text style={ui.title}>{a.patient?.name}</Text>
                <Text style={ui.small}>
                  {a.service?.name}
                  {a.starts_at ? ` · ${formatClockTime(clinicClock(a.starts_at))}` : ''}
                </Text>
                <View style={ui.rowWrap}>
                  <Text style={arrived ? styles.arrived : ui.small}>{arrived ? 'Checked In' : 'Not checked in'}</Text>
                  <Badge tone={status.tone} label={status.label} />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </Card>

      <Card title="Today at a Glance">
        <StatRow label="Waiting" value={summary.waiting} />
        <StatRow label="Ongoing" value={summary.ongoing} />
        <StatRow label="Completed" value={summary.completed} />
        <StatRow label="No-show" value={summary.noShow} />
        <StatRow label={`Upcoming (${UPCOMING_DAYS} days)`} value={upcoming.length} />
      </Card>

      <Card title="Upcoming Appointments">
        {data.data && upcoming.length === 0 && <EmptyState icon="calendar-outline" text={`Nothing booked for the next ${UPCOMING_DAYS} days.`} />}
        {upcoming.slice(0, UPCOMING_LIMIT).map((a) => (
          <View key={a.id} style={styles.upcoming}>
            <InitialsTile name={a.patient?.name} />
            <View style={ui.flex}>
              <Text style={ui.title}>{a.patient?.name}</Text>
              <Text style={ui.small}>{a.service?.name}</Text>
            </View>
            <Text style={ui.small}>{formatDateTime(a.starts_at)}</Text>
          </View>
        ))}
      </Card>

      <Card title="Recent Notifications">
        {data.data?.notices.length === 0 && <Text style={ui.muted}>No notifications yet.</Text>}
        {data.data?.notices.map((notice) => (
          <View key={notice.id} style={styles.notice}>
            <Text style={styles.noticeTitle}>{notice.title}</Text>
            <Text style={ui.small}>{notice.message}</Text>
          </View>
        ))}
        <TouchableOpacity onPress={() => open('ClinicNotifications')} accessibilityRole="link">
          <Text style={styles.link}>View all</Text>
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  hero: { padding: spacing.lg, borderRadius: radius.xxl, backgroundColor: palette.primary, gap: spacing.xs },
  heroGreeting: { ...type.bodyMd, color: palette.primaryFixedDim },
  heroName: { ...type.titleLg, fontWeight: '700', color: palette.onPrimary },
  heroText: { ...type.bodyMd, color: palette.onPrimary },
  heroStrong: { fontWeight: '700' },
  heroAccent: { fontWeight: '700', color: '#ffe082' },
  heroButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.base, minHeight: 46, marginTop: spacing.sm, borderRadius: radius.xl, backgroundColor: palette.onPrimary },
  heroButtonText: { ...type.bodyMd, fontWeight: '600', color: palette.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { width: '47%', flexGrow: 1, padding: spacing.md, borderRadius: radius.xxl, backgroundColor: palette.surfaceContainerLowest, borderWidth: 1, borderColor: 'rgba(194,198,212,0.3)', gap: 2 },
  tileIcon: { width: 38, height: 38, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primaryFixed, marginBottom: spacing.xs },
  tileValue: { ...type.titleLg, fontWeight: '700', color: palette.onSurface },
  tileLabel: { fontSize: 13, fontWeight: '600', color: palette.onSurface },
  quick: { width: '47%', flexGrow: 1, minHeight: 84, padding: spacing.sm, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.xl, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceContainerLowest },
  quickText: { fontSize: 12, fontWeight: '600', color: palette.onSurface, textAlign: 'center' },
  queueRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.xl, borderWidth: 1, borderColor: palette.surfaceContainerHigh, backgroundColor: palette.surface },
  queueArrived: { borderColor: palette.primaryFixedDim, backgroundColor: palette.primaryFixed },
  queuePending: { borderColor: '#f4d774', backgroundColor: '#fff8e1' },
  number: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surfaceContainerLowest },
  numberText: { fontSize: 13, fontWeight: '700', color: palette.primary },
  arrived: { fontSize: 12, fontWeight: '600', color: palette.primary },
  upcoming: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.xl, backgroundColor: palette.surface },
  notice: { padding: spacing.sm, borderRadius: radius.xl, backgroundColor: palette.primaryFixed },
  noticeTitle: { fontSize: 13, fontWeight: '600', color: palette.primary },
  link: { ...type.bodyMd, fontWeight: '600', color: palette.primary },
});

export default FrontDeskOverview;
