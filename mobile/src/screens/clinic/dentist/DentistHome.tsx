// The dentist's day (web: DentistDashboard): who is next, what needs an answer, who is
// coming, what is due.
import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useOpenSection } from '../../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../../components/clinic/ClinicPortalContext';
import { InitialsTile } from '../../../components/clinic/ClinicAdminKit';
import { Badge, Button, Card, LoadState, ui, useLoader, useRefreshOnFocus } from '../../../components/clinic/ClinicUi';
import { useAuth } from '../../../context/AuthContext';
import { ClinicRoute } from '../../../config/clinicSections';
import { ClinicAppointment, formatDateTime } from '../../../services/clinicPortal';
import { fetchDentistOverview } from '../../../services/dentistPortal';
import { palette, radius, spacing } from '../../../theme/tokens';
import { formatDay, monthDay, statusBadge, timeOf, weekdayName } from './dentistKit';

const QUICK_ACTIONS: { route: ClinicRoute; icon: string; label: string }[] = [
  { route: 'ClinicAppointments', icon: 'calendar-outline', label: 'Appointments' },
  { route: 'ClinicPatients', icon: 'people-outline', label: 'Patient Records' },
  { route: 'ClinicDentalChart', icon: 'pulse-outline', label: 'Dental Chart' },
  { route: 'ClinicPrescriptions', icon: 'book-outline', label: 'Prescriptions' },
  { route: 'ClinicClinicalNotes', icon: 'clipboard-outline', label: 'Clinical Notes' },
  { route: 'ClinicFollowUps', icon: 'calendar-number-outline', label: 'Follow-ups' },
];

const CHART_HEIGHT = 110;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const doctorName = (name = '') => (/^dr\.?\s/i.test(name) ? name : `Dr. ${name}`);

function greeting() {
  const hour = new Date(Date.now() + 8 * 3600000).getUTCHours();
  if (hour < 12) return 'Good morning';
  return hour < 18 ? 'Good afternoon' : 'Good evening';
}

const Tile = ({ icon, value, label, note, color }: { icon: string; value: number; label: string; note: string; color: string }) => (
  <View style={styles.tile}>
    <Icon name={icon} size={22} color={color} />
    <Text style={styles.tileValue}>{value}</Text>
    <Text style={styles.tileLabel}>{label}</Text>
    <Text style={ui.small}>{note}</Text>
  </View>
);

function QueueRow({ appointment, number, onPress }: { appointment: ClinicAppointment; number: number; onPress: () => void }) {
  const status = statusBadge(appointment.status);
  const tone = appointment.status === 'in_progress' ? styles.rowOngoing : appointment.status === 'pending' ? styles.rowPending : null;
  return (
    <TouchableOpacity style={[styles.row, tone]} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open appointment for ${appointment.patient?.name}`}>
      <View style={styles.number}>
        <Text style={styles.numberText}>{number}</Text>
      </View>
      <View style={ui.flex}>
        <Text style={ui.title} numberOfLines={1}>{appointment.patient?.name}</Text>
        <Text style={ui.small} numberOfLines={1}>{appointment.service?.name}</Text>
      </View>
      <View style={styles.when}>
        <Text style={styles.time}>{timeOf(appointment.starts_at)}</Text>
        <Badge label={status.label} tone={status.tone} />
      </View>
    </TouchableOpacity>
  );
}

const DentistHome = () => {
  const navigation = useNavigation<any>();
  const open = useOpenSection('ClinicDashboard');
  const { user } = useAuth();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const overview = useLoader(() => fetchDentistOverview(clinicId), [clinicId], 'Your day could not be loaded.');
  useRefreshOnFocus(overview.sync);
  const data = overview.data;
  const openVisit = (id: number) => navigation.navigate('ClinicAppointmentDetail', { appointmentId: id });
  const highest = Math.max(1, ...(data?.week ?? []).map(({ total }) => total));

  return (
    <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={overview.refreshing} onRefresh={overview.refresh} />}>
      <LoadState loading={overview.loading} error={overview.error} onRetry={overview.reload} />
      {data && (
        <>
          <View style={styles.hero}>
            <Text style={styles.heroGreeting}>{greeting()},</Text>
            <Text style={styles.heroName}>{doctorName(user?.name)}</Text>
            <Text style={styles.heroText}>
              You have <Text style={styles.heroStrong}>{plural(data.counts.today, 'appointment', 'appointments')}</Text> today.{' '}
              {data.counts.pending > 0 && (
                <>
                  <Text style={styles.heroAlert}>{plural(data.counts.pending, 'request', 'requests')}</Text> need your review.
                </>
              )}
            </Text>
            <View style={styles.heroActions}>
              <TouchableOpacity style={styles.heroButton} onPress={() => open('ClinicMySchedule')} accessibilityRole="button">
                <Icon name="calendar-outline" size={16} color={palette.primary} />
                <Text style={styles.heroButtonText}>View Schedule</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.heroButton, styles.heroButtonSoft]} onPress={() => open('ClinicPatients')} accessibilityRole="button">
                <Icon name="people-outline" size={16} color="#ffffff" />
                <Text style={[styles.heroButtonText, styles.heroButtonTextSoft]}>My Patients</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tiles}>
            <Tile icon="calendar-outline" color="#1d5fd1" value={data.counts.today} label="Today's Appointments" note={`${data.counts.today_confirmed} confirmed`} />
            <Tile icon="time-outline" color="#b7791f" value={data.counts.pending} label="Pending Requests" note="Awaiting confirmation" />
            <Tile icon="people-outline" color="#0f9d58" value={data.counts.active_patients} label="Active Patients" note="Total caseload" />
            <Tile icon="calendar-number-outline" color="#7e22ce" value={data.counts.upcoming} label="Upcoming (3 days)" note={`${monthDay(data.upcoming_range.from)} – ${monthDay(data.upcoming_range.to)}`} />
          </View>

          <Text style={ui.title}>Quick Actions</Text>
          <View style={styles.quick}>
            {QUICK_ACTIONS.map((action) => (
              <TouchableOpacity key={action.route} style={styles.quickItem} onPress={() => open(action.route)} accessibilityRole="button" accessibilityLabel={action.label}>
                <Icon name={action.icon} size={22} color={palette.primary} />
                <Text style={styles.quickLabel} numberOfLines={2}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Card title="Today's Patient Queue" action={<Button small variant="outline" label="View all" onPress={() => open('ClinicAppointments')} />}>
            {data.today.length === 0 ? <Text style={ui.muted}>No appointments today.</Text> : data.today.map((a, index) => <QueueRow key={a.id} appointment={a} number={index + 1} onPress={() => openVisit(a.id)} />)}
          </Card>

          <Card title="Pending Requests" action={data.counts.pending > 0 ? <Badge label={String(data.counts.pending)} tone="warning" /> : undefined}>
            {data.pending_requests.length === 0 ? (
              <Text style={ui.muted}>Nothing is waiting for you.</Text>
            ) : (
              data.pending_requests.map((a) => (
                <View key={a.id} style={styles.request}>
                  <View style={ui.between}>
                    <Text style={[ui.title, ui.flex]} numberOfLines={1}>{a.patient?.name}</Text>
                    <Text style={styles.requestStatus}>{statusBadge(a.status).label}</Text>
                  </View>
                  <Text style={ui.small}>{a.service?.name}</Text>
                  <Text style={ui.small}>{formatDateTime(a.starts_at)}</Text>
                  <Button small label="Review" style={styles.review} onPress={() => openVisit(a.id)} />
                </View>
              ))
            )}
          </Card>

          <Card title="Appointments This Week">
            <View style={styles.chart} accessibilityRole="image" accessibilityLabel={`Appointments this week: ${data.week.map((d) => `${weekdayName(d.date)} ${d.total}`).join(', ')}`}>
              {data.week.map((day) => (
                <View key={day.date} style={styles.chartColumn}>
                  {day.total > 0 && <Text style={ui.small}>{day.total}</Text>}
                  <View style={[styles.chartBar, { height: Math.max(2, (day.total / highest) * CHART_HEIGHT) }]} />
                  <Text style={ui.small}>{weekdayName(day.date)}</Text>
                </View>
              ))}
            </View>
          </Card>

          <Card title="Upcoming Patients">
            {data.upcoming_patients.length === 0 ? (
              <Text style={ui.muted}>Nobody is booked for the next three days.</Text>
            ) : (
              data.upcoming_patients.map((a) => (
                <TouchableOpacity key={a.id} style={styles.sideRow} onPress={() => openVisit(a.id)} accessibilityRole="button">
                  <InitialsTile name={a.patient?.name} />
                  <View style={ui.flex}>
                    <Text style={ui.title} numberOfLines={1}>{a.patient?.name}</Text>
                    <Text style={ui.small}>{formatDateTime(a.starts_at)}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </Card>

          <Card title="Follow-ups Due" action={<Button small variant="outline" label="View all" onPress={() => open('ClinicFollowUps')} />}>
            {data.follow_ups_due.length === 0 ? (
              <Text style={ui.muted}>No follow-ups scheduled.</Text>
            ) : (
              data.follow_ups_due.map((followUp) => (
                <View key={followUp.id} style={styles.sideRow}>
                  <View style={[styles.dot, followUp.priority === 'high' && styles.dotHigh]} />
                  <View style={ui.flex}>
                    <Text style={ui.title} numberOfLines={1}>{followUp.patient}</Text>
                    <Text style={ui.small}>{formatDay(followUp.due_on)}{followUp.priority === 'high' ? ' · High priority' : ''}</Text>
                  </View>
                </View>
              ))
            )}
          </Card>
        </>
      )}
    </ScrollView>
  );
};

export default DentistHome;

const styles = StyleSheet.create({
  hero: { padding: spacing.md, borderRadius: radius.xl, backgroundColor: palette.primary },
  heroGreeting: { color: '#ffffff', opacity: 0.85, fontSize: 13 },
  heroName: { color: '#ffffff', fontSize: 20, fontWeight: '700', marginVertical: 2 },
  heroText: { color: '#ffffff', fontSize: 13 },
  heroStrong: { fontWeight: '700' },
  heroAlert: { fontWeight: '700', color: '#ffd54f' },
  heroActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  heroButton: { flexDirection: 'row', flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: spacing.md, borderRadius: radius.lg, backgroundColor: '#ffffff' },
  heroButtonSoft: { backgroundColor: 'rgba(255,255,255,0.18)' },
  heroButtonText: { fontSize: 13, fontWeight: '600', color: palette.primary },
  heroButtonTextSoft: { color: '#ffffff' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexGrow: 1, flexBasis: '45%', padding: spacing.md, borderRadius: radius.xl, backgroundColor: palette.surfaceContainerLowest, borderWidth: 1, borderColor: palette.surfaceContainerHigh },
  tileValue: { fontSize: 22, fontWeight: '700', color: palette.onSurface, marginTop: 4 },
  tileLabel: { fontSize: 13, fontWeight: '600', color: palette.onSurface },
  quick: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  quickItem: { flexGrow: 1, flexBasis: '30%', alignItems: 'center', gap: 4, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: palette.surfaceContainerLowest, borderWidth: 1, borderColor: palette.surfaceContainerHigh },
  quickLabel: { fontSize: 12, fontWeight: '500', textAlign: 'center', color: palette.onSurface },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginTop: spacing.sm, borderRadius: radius.lg, backgroundColor: palette.surfaceContainerLow, borderWidth: 1, borderColor: palette.surfaceContainerHigh },
  rowOngoing: { backgroundColor: '#edfbf1', borderColor: '#b7ebc6' },
  rowPending: { backgroundColor: '#fffbe8', borderColor: '#f3e3a1' },
  number: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#dfe7fb' },
  numberText: { fontSize: 12, fontWeight: '600', color: palette.primary },
  when: { alignItems: 'flex-end', gap: 2 },
  time: { fontSize: 12, fontWeight: '600', color: palette.onSurface },
  request: { padding: spacing.sm, marginTop: spacing.sm, borderRadius: radius.lg, backgroundColor: '#fffbe8', borderWidth: 1, borderColor: '#f3e3a1' },
  requestStatus: { fontSize: 12, fontWeight: '600', color: '#a16207' },
  review: { marginTop: spacing.sm },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xs, height: CHART_HEIGHT + 44 },
  chartColumn: { flex: 1, alignItems: 'stretch', justifyContent: 'flex-end', gap: 2 },
  chartBar: { borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: palette.primary },
  sideRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#3b82f6' },
  dotHigh: { backgroundColor: '#ef4444' },
});
