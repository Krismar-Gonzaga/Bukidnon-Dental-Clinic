// Dentist dashboard for phones (dentist design "Overview", as on the web
// DentistOverview): greeting with the day's summary, today's figures,
// today's schedule, quick actions and the dentist's latest clinical notes.
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useOpenSection } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { Badge, EmptyState, LoadState, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import { NewRecordSheet, recordSummary } from '../../components/clinic/RecordSheet';
import { useAuth } from '../../context/AuthContext';
import { formatClockTime, toBusinessDateKey } from '../../services/booking';
import {
  can,
  ClinicAppointment,
  ClinicDashboard,
  clinicClock,
  ClinicPatient,
  DAYS,
  fetchClinicDashboard,
  fetchClinicRecords,
  formatCount,
  PatientRecord,
  recordTypeLabel,
  statusLabel,
} from '../../services/clinicPortal';
import { palette, radius, shadow, spacing, type } from '../../theme/tokens';

const SCHEDULE_PREVIEW = 3;
const NOT_SCHEDULED = ['cancelled', 'rejected'];
const WAITING = ['pending', 'confirmed', 'reschedule_requested', 'checked_in'];

const plural = (n: number, one: string, many: string) => `${formatCount(n)} ${n === 1 ? one : many}`;
const isScheduled = (a: ClinicAppointment) => !NOT_SCHEDULED.includes(a.status);
const doctorName = (name = '') => (/^dr\.?\s/i.test(name) ? name : `Dr. ${name}`);

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const greeting = (now: Date) => {
  const hour = Number(clinicClock(now.toISOString()).slice(0, 2));
  if (hour < 12) return 'Good morning';
  return hour < 18 ? 'Good afternoon' : 'Good evening';
};

/** "You have 4 appointments scheduled for today. The first one starts in 15 minutes." */
export function daySummary(appointments: ClinicAppointment[], now: Date) {
  const scheduled = appointments.filter(isScheduled);
  if (scheduled.length === 0) return 'You have no appointments scheduled for today.';
  const head = `You have ${plural(scheduled.length, 'appointment', 'appointments')} scheduled for today.`;
  const inProgress = scheduled.find((a) => a.status === 'in_progress');
  if (inProgress) return `${head} Your visit with ${inProgress.patient?.name ?? 'a patient'} is in progress.`;
  const next = scheduled.find((a) => WAITING.includes(a.status) && a.starts_at && new Date(a.starts_at) > now);
  if (!next?.starts_at) return `${head} No more visits are waiting today.`;
  const minutes = Math.round((new Date(next.starts_at).getTime() - now.getTime()) / 60000);
  const when = minutes < 60 ? `in ${plural(Math.max(minutes, 1), 'minute', 'minutes')}` : `at ${formatClockTime(clinicClock(next.starts_at))}`;
  const which = scheduled.every((a) => a.starts_at && new Date(a.starts_at) > now) ? 'The first one' : 'The next one';
  return `${head} ${which} starts ${when}.`;
}

function weekChange(current: number, previous: number | undefined, weekday: string) {
  if (!previous) return { text: `None last ${weekday}`, tone: 'flat' as const };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { text: `Same as last ${weekday}`, tone: 'flat' as const };
  return { text: `${pct > 0 ? '+' : ''}${pct}% vs last ${weekday}`, tone: pct > 0 ? ('up' as const) : ('down' as const) };
}

function MetricCard({ label, value, icon, tone, change }: { label: string; value: string; icon: string; tone: 'primary' | 'secondary'; change: { text: string; tone: 'up' | 'down' | 'flat' } }) {
  return (
    <View style={styles.metric} accessible accessibilityLabel={`${label}: ${value}, ${change.text}`}>
      <View style={styles.metricTop}>
        <View style={[styles.metricIcon, tone === 'secondary' && styles.metricIconSecondary]}>
          <Icon name={icon} size={24} color={tone === 'secondary' ? palette.secondary : palette.primary} />
        </View>
        <Text style={[styles.metricChange, change.tone === 'down' && styles.down, change.tone === 'flat' && styles.flat]}>{change.text}</Text>
      </View>
      <Text style={styles.overline}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function ScheduleRow({ appointment: a, onPress }: { appointment: ClinicAppointment; onPress: () => void }) {
  const [clock, period] = a.starts_at ? formatClockTime(clinicClock(a.starts_at)).split(' ') : ['—', ''];
  return (
    <TouchableOpacity
      style={[styles.row, !isScheduled(a) && styles.rowMuted]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${clock} ${period}, ${a.patient?.name ?? 'Patient'}, ${statusLabel(a.status)}`}
    >
      <View style={styles.rowTime}>
        <Text style={styles.rowClock}>{clock.padStart(5, '0')}</Text>
        <Text style={styles.rowPeriod}>{period}</Text>
      </View>
      <View style={styles.rowDivider} />
      <View style={styles.flex}>
        <View style={styles.rowHead}>
          <Text style={styles.rowName} numberOfLines={1}>{a.patient?.name ?? 'Patient'}</Text>
          <Badge status={a.status} label={statusLabel(a.status)} />
        </View>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {[a.service?.name, a.branch?.name].filter(Boolean).join(' • ')}
        </Text>
      </View>
      <Icon name="chevron-forward" size={20} color={palette.primary} />
    </TouchableOpacity>
  );
}

function QuickAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.action} onPress={onPress} accessibilityRole="button">
      <View style={styles.actionLabel}>
        <Icon name={icon} size={22} color={palette.primary} />
        <Text style={styles.actionText}>{label}</Text>
      </View>
      <Icon name="arrow-forward" size={20} color={palette.onSurfaceVariant} />
    </TouchableOpacity>
  );
}

type RecordAction = { title: string; recordType: PatientRecord['record_type'] };

export default function DentistOverview() {
  const navigation = useNavigation<any>();
  const open = useOpenSection('ClinicDashboard');
  const { user } = useAuth();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const now = useNow();
  const [expanded, setExpanded] = useState(false);
  const [recordAction, setRecordAction] = useState<RecordAction | null>(null);
  const [saved, setSaved] = useState<ClinicPatient | null>(null);
  const canRecords = can(membership, 'records.view');

  const dashboard = useLoader<ClinicDashboard>(() => fetchClinicDashboard(clinicId), [clinicId], 'Your day could not be loaded.');
  const notes = useLoader(
    () => (canRecords ? fetchClinicRecords(clinicId, { mine: 1, per_page: 3 }) : Promise.resolve(null)),
    [clinicId, canRecords],
    'Notes could not be loaded.',
  );

  // Back on this tab (e.g. after starting a visit): refresh quietly.
  useRefreshOnFocus(() => {
    dashboard.sync();
    notes.sync();
  });

  const data = dashboard.data;
  const today = ((data?.appointments?.today ?? []) as unknown as ClinicAppointment[]);
  const scheduledToday = today.filter(isScheduled).length;
  const weekday = DAYS[new Date(`${toBusinessDateKey(now)}T12:00:00Z`).getUTCDay()];
  const shown = expanded ? today : today.slice(0, SCHEDULE_PREVIEW);
  const hiddenCount = today.length - SCHEDULE_PREVIEW;
  const openAppointment = (id: number) => navigation.navigate('ClinicAppointmentDetail', { appointmentId: id });

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={dashboard.refreshing}
          onRefresh={() => {
            dashboard.refresh();
            notes.sync();
          }}
          colors={[palette.primary]}
        />
      }
    >
      {!data ? (
        <LoadState loading={dashboard.loading} error={dashboard.error} onRetry={dashboard.reload} />
      ) : (
        <>
          <View>
            <Text style={styles.heading} accessibilityRole="header">
              {greeting(now)}, {doctorName(user?.name)}
            </Text>
            <Text style={styles.lead}>{daySummary(today, now)}</Text>
          </View>

          {data.appointments && (
            <MetricCard
              label="Today's Appointments"
              value={formatCount(scheduledToday)}
              icon="calendar-outline"
              tone="primary"
              change={weekChange(scheduledToday, data.appointments.same_day_last_week, weekday)}
            />
          )}
          {data.my_patients && (
            <MetricCard
              label="New Patients This Month"
              value={formatCount(data.my_patients.new_this_month)}
              icon="person-add-outline"
              tone="secondary"
              change={
                data.my_patients.new_today
                  ? { text: `+${formatCount(data.my_patients.new_today)} today`, tone: 'up' }
                  : { text: `${formatCount(data.my_patients.total)} in your care`, tone: 'flat' }
              }
            />
          )}

          {data.appointments && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Today's Schedule</Text>
                <TouchableOpacity onPress={() => open('ClinicSchedule')} accessibilityRole="link" style={styles.linkTouch}>
                  <Text style={styles.link}>View Calendar</Text>
                </TouchableOpacity>
              </View>
              {today.length === 0 ? (
                <EmptyState icon="calendar-clear-outline" text="No appointments today." />
              ) : (
                shown.map((a) => <ScheduleRow key={a.id} appointment={a} onPress={() => openAppointment(a.id)} />)
              )}
              {hiddenCount > 0 && (
                <TouchableOpacity style={styles.more} onPress={() => setExpanded((e) => !e)} accessibilityRole="button" accessibilityState={{ expanded }}>
                  <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={palette.onSurfaceVariant} />
                  <Text style={styles.moreText}>
                    {expanded ? 'Show fewer appointments' : `Show ${plural(hiddenCount, 'more appointment', 'more appointments')}`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.panel}>
            <Text style={[styles.overline, styles.panelTitle]}>Quick Actions</Text>
            {can(membership, 'patients.manage') && (
              <QuickAction icon="person-add-outline" label="Add New Patient" onPress={() => open('ClinicPatients', { register: true })} />
            )}
            {can(membership, 'records.write') && (
              <>
                <QuickAction icon="clipboard-outline" label="Create Treatment Plan" onPress={() => setRecordAction({ title: 'Create treatment plan', recordType: 'treatment' })} />
                <QuickAction icon="medkit-outline" label="Add Examination Note" onPress={() => setRecordAction({ title: 'Add examination note', recordType: 'examination' })} />
              </>
            )}
            {can(membership, 'patients.view') && <QuickAction icon="people-outline" label="Find a Patient" onPress={() => open('ClinicPatients')} />}
            {saved && (
              <TouchableOpacity
                style={styles.saved}
                onPress={() => navigation.navigate('ClinicPatientDetail', { patientId: saved.id })}
                accessibilityRole="link"
                accessibilityLiveRegion="polite"
              >
                <Icon name="checkmark-circle" size={18} color={palette.secondary} />
                <Text style={styles.savedText}>Record saved for {saved.name}. Open patient</Text>
              </TouchableOpacity>
            )}
          </View>

          {canRecords && (
            <View style={[styles.card, styles.notes]}>
              <View style={styles.notesHeader}>
                <Text style={styles.overline}>Clinical Notes</Text>
                <TouchableOpacity onPress={() => open('ClinicRecords', { mine: true })} accessibilityRole="button" accessibilityLabel="All my clinical notes">
                  <Icon name="ellipsis-horizontal" size={20} color={palette.onSurfaceVariant} />
                </TouchableOpacity>
              </View>
              {!notes.data ? (
                <LoadState loading={notes.loading} error={notes.error} onRetry={notes.reload} />
              ) : notes.data.items.length === 0 ? (
                <Text style={styles.lead}>Notes you write in patient records appear here.</Text>
              ) : (
                notes.data.items.map((r, index) => (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.note, index === 0 && styles.noteLatest]}
                    onPress={() => navigation.navigate('ClinicPatientDetail', { patientId: r.patient_id })}
                    accessibilityRole="button"
                  >
                    <View style={[styles.noteDot, index === 0 && styles.noteDotLatest]} />
                    <Text style={[styles.noteHead, index === 0 && styles.noteHeadLatest]}>
                      {r.patient?.name ?? 'Patient'}
                      <Text style={styles.noteTime}>  {recordTypeLabel(r.record_type)} · {r.created_at ? relative(r.created_at, now) : ''}</Text>
                    </Text>
                    <Text style={styles.noteText} numberOfLines={2}>{recordSummary(r)}</Text>
                  </TouchableOpacity>
                ))
              )}
              <TouchableOpacity style={styles.notesAll} onPress={() => open('ClinicRecords', { mine: true })} accessibilityRole="button">
                <Text style={styles.link}>View All Notes</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {recordAction && (
        <NewRecordSheet
          clinicId={clinicId}
          title={recordAction.title}
          recordType={recordAction.recordType}
          onClose={() => setRecordAction(null)}
          onSaved={(patient) => {
            setSaved(patient);
            notes.sync();
          }}
        />
      )}
    </ScrollView>
  );
}

/** "2h ago", "Yesterday", "3 days ago". */
function relative(iso: string, now: Date) {
  const minutes = Math.round((now.getTime() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.lg },
  flex: { flex: 1 },
  heading: { ...type.headlineLgMobile, color: palette.onSurface, marginBottom: spacing.xs },
  lead: { ...type.bodyLg, color: palette.onSurfaceVariant },
  overline: { ...type.labelMd, color: palette.onSurfaceVariant, textTransform: 'uppercase' },
  metric: { padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceContainerLowest, ...shadow.sm },
  metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md, gap: spacing.sm },
  metricIcon: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,63,135,0.1)' },
  metricIconSecondary: { backgroundColor: 'rgba(0,108,79,0.1)' },
  metricChange: { ...type.labelMd, color: palette.secondary, flexShrink: 1, textAlign: 'right' },
  down: { color: palette.error },
  flat: { color: palette.onSurfaceVariant },
  metricValue: { fontSize: 48, lineHeight: 58, fontWeight: '700', letterSpacing: -1, color: palette.onSurface },
  card: { borderRadius: radius.xl, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceContainerLowest, overflow: 'hidden', ...shadow.sm },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.outlineVariant },
  cardTitle: { ...type.titleLg, color: palette.onSurface, fontWeight: '600' },
  linkTouch: { minHeight: 44, justifyContent: 'center' },
  link: { ...type.labelMd, color: palette.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: palette.surfaceContainerHigh },
  rowMuted: { opacity: 0.6 },
  rowTime: { width: 56, alignItems: 'center' },
  rowClock: { fontSize: 18, fontWeight: '500', color: palette.onSurface },
  rowPeriod: { ...type.labelMd, color: palette.onSurfaceVariant },
  rowDivider: { width: 1, height: 44, backgroundColor: palette.outlineVariant },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, marginBottom: 2 },
  rowName: { ...type.bodyLg, fontWeight: '600', color: palette.onSurface, flexShrink: 1 },
  rowMeta: { ...type.bodyMd, color: palette.onSurfaceVariant },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.base, padding: spacing.md, backgroundColor: palette.surfaceContainerLow, borderTopWidth: 1, borderTopColor: palette.outlineVariant },
  moreText: { ...type.labelMd, color: palette.onSurfaceVariant },
  panel: { padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceContainerLow, gap: spacing.sm },
  panelTitle: { marginBottom: spacing.sm },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceContainerLowest },
  actionLabel: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  actionText: { ...type.bodyMd, color: palette.onSurface },
  saved: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, minHeight: 44 },
  savedText: { ...type.bodyMd, color: palette.secondary, flexShrink: 1 },
  notes: { padding: spacing.lg, gap: spacing.lg },
  notesHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  note: { paddingLeft: spacing.lg, borderLeftWidth: 2, borderLeftColor: palette.outlineVariant, marginLeft: spacing.base },
  noteLatest: { borderLeftColor: palette.primaryFixed },
  noteDot: { position: 'absolute', left: -9, top: 0, width: 16, height: 16, borderRadius: 8, borderWidth: 4, borderColor: palette.surfaceContainerLowest, backgroundColor: palette.outlineVariant },
  noteDotLatest: { backgroundColor: palette.primary },
  noteHead: { ...type.labelMd, color: palette.onSurface, marginBottom: spacing.xs },
  noteHeadLatest: { color: palette.primary },
  noteTime: { fontWeight: '400', color: palette.onSurfaceVariant },
  noteText: { ...type.bodyMd, color: palette.onSurface },
  notesAll: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(0,63,135,0.2)' },
});
