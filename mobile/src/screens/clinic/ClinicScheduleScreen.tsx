// Dentist schedule for phones (dentist design "Schedule", web
// ClinicSchedulePage): Week / Month / Day calendar, then the chosen day's
// agenda with what is happening now and the day's status.
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { Badge, EmptyState, LoadState, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import { formatClockTime, toBusinessDateKey } from '../../services/booking';
import { can, ClinicAppointment, clinicClock, clinicDateKey, fetchAppointmentsInRange, formatCount, statusLabel } from '../../services/clinicPortal';
import { palette, radius, shadow, spacing, type } from '../../theme/tokens';
import { addDays } from './ClinicAppointmentsScreen';

type CalendarView = 'week' | 'month' | 'day';
const VIEWS: { id: CalendarView; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'day', label: 'Day' },
];
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Cancelled and declined requests are not on the calendar.
const OFF_CALENDAR = ['cancelled', 'rejected'];
const REMAINING = ['pending', 'confirmed', 'reschedule_requested', 'checked_in', 'in_progress'];
const DEFAULT_MINUTES = 30;

type Tone = 'active' | 'confirmed' | 'pending' | 'done' | 'missed';
const TONES: Record<string, Tone> = {
  in_progress: 'active',
  confirmed: 'confirmed',
  checked_in: 'confirmed',
  pending: 'pending',
  reschedule_requested: 'pending',
  completed: 'done',
  no_show: 'missed',
};
const TONE_COLORS: Record<Tone, { border: string; bg: string; fg: string }> = {
  active: { border: palette.primary, bg: 'rgba(0,86,179,0.12)', fg: palette.primary },
  confirmed: { border: palette.secondary, bg: 'rgba(103,252,198,0.2)', fg: palette.onSecondaryContainer },
  pending: { border: '#b7791f', bg: '#fdf8e8', fg: '#a16207' },
  done: { border: palette.outlineVariant, bg: palette.surfaceContainer, fg: palette.onSurfaceVariant },
  missed: { border: palette.error, bg: 'rgba(255,218,214,0.4)', fg: palette.error },
};

const weekdayOf = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay();
const mondayOf = (key: string) => addDays(key, -((weekdayOf(key) + 6) % 7));
const monthStart = (key: string) => `${key.slice(0, 7)}-01`;
const shiftMonth = (key: string, months: number) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 10);
};
const monthTitle = (key: string) => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
const dayTitle = (key: string) => `${WEEKDAYS[weekdayOf(key)].charAt(0)}${WEEKDAYS[weekdayOf(key)].slice(1).toLowerCase()}, ${MONTHS[Number(key.slice(5, 7)) - 1].slice(0, 3)} ${Number(key.slice(8))}`;

/** Dates fetched and shown for a view around the selected day. */
export function viewRange(view: CalendarView, anchor: string) {
  if (view === 'day') return { from: anchor, to: anchor, days: [anchor] };
  if (view === 'week') {
    const from = mondayOf(anchor);
    return { from, to: addDays(from, 6), days: Array.from({ length: 7 }, (_, i) => addDays(from, i)) };
  }
  const from = mondayOf(monthStart(anchor));
  const last = addDays(shiftMonth(anchor, 1), -1);
  const to = addDays(mondayOf(last), 6);
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return { from, to, days };
}

const endOf = (a: ClinicAppointment) =>
  a.ends_at ? new Date(a.ends_at) : new Date(new Date(a.starts_at ?? 0).getTime() + (a.service?.duration_minutes ?? DEFAULT_MINUTES) * 60000);

/** Happening now: in progress, or started and not over yet. */
const isNow = (a: ClinicAppointment, now: Date) =>
  a.status === 'in_progress' ||
  (['confirmed', 'checked_in'].includes(a.status) && Boolean(a.starts_at) && new Date(a.starts_at!) <= now && now < endOf(a));

function AgendaItem({ appointment: a, now, onPress }: { appointment: ClinicAppointment; now: Date; onPress: () => void }) {
  const tone = TONE_COLORS[TONES[a.status] ?? 'done'];
  const live = isNow(a, now);
  const time = a.starts_at ? `${formatClockTime(clinicClock(a.starts_at))} – ${formatClockTime(clinicClock(endOf(a).toISOString()))}` : '';
  return (
    <TouchableOpacity
      style={[styles.item, { borderLeftColor: tone.border, backgroundColor: tone.bg }, live && styles.itemNow]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${time}, ${a.service?.name ?? 'Visit'} with ${a.patient?.name ?? 'patient'}, ${statusLabel(a.status)}${live ? ', happening now' : ''}`}
    >
      {live && <Text style={styles.nowBadge}>NOW</Text>}
      <View style={styles.itemHead}>
        <Text style={[styles.itemService, { color: tone.fg }]} numberOfLines={1}>{a.service?.name ?? 'Visit'}</Text>
        <Badge status={a.status} label={statusLabel(a.status)} />
      </View>
      <Text style={styles.itemPatient}>{a.patient?.name ?? 'Patient'}</Text>
      <View style={styles.itemMeta}>
        <Icon name="time-outline" size={14} color={palette.onSurfaceVariant} />
        <Text style={styles.itemMetaText}>{time}</Text>
        {a.branch?.name ? (
          <>
            <Icon name="location-outline" size={14} color={palette.onSurfaceVariant} />
            <Text style={styles.itemMetaText} numberOfLines={1}>{a.branch.name}</Text>
          </>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const ClinicScheduleScreen = () => {
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const today = toBusinessDateKey(new Date());
  const [view, setView] = useState<CalendarView>('week');
  const [selected, setSelected] = useState(today);
  const [now, setNow] = useState(() => new Date());
  const { from, to, days } = viewRange(view, selected);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const calendar = useLoader(() => fetchAppointmentsInRange(clinicId, from, to), [clinicId, from, to], 'The schedule could not be loaded.');
  useRefreshOnFocus(calendar.sync);

  const appointments = (calendar.data?.appointments ?? []).filter((a) => a.starts_at && !OFF_CALENDAR.includes(a.status));
  const byDay: Record<string, ClinicAppointment[]> = {};
  appointments.forEach((a) => {
    const key = clinicDateKey(a.starts_at!);
    (byDay[key] = byDay[key] ?? []).push(a);
  });
  const dayList = (byDay[selected] ?? []).slice().sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? ''));
  const inPeriod = view === 'month' ? appointments.filter((a) => clinicDateKey(a.starts_at!).startsWith(selected.slice(0, 7))) : view === 'day' ? dayList : appointments;
  const completed = dayList.filter((a) => a.status === 'completed').length;
  const remaining = dayList.filter((a) => REMAINING.includes(a.status)).length;

  const step = (direction: number) =>
    setSelected((key) => (view === 'day' ? addDays(key, direction) : view === 'week' ? addDays(key, 7 * direction) : shiftMonth(key, direction)));
  const period = { day: selected === today ? 'today' : 'on this day', week: 'this week', month: 'this month' }[view];

  return (
    <ClinicScreen title="Schedule" active="ClinicSchedule">
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={calendar.refreshing} onRefresh={calendar.refresh} colors={[palette.primary]} />}
      >
        <View>
          <Text style={styles.title} accessibilityRole="header">{view === 'day' ? dayTitle(selected) : monthTitle(view === 'week' ? from : selected)}</Text>
          <Text style={styles.subtitle}>
            {calendar.data
              ? `${formatCount(inPeriod.length)} ${inPeriod.length === 1 ? 'appointment' : 'appointments'} scheduled ${period}${can(membership, 'appointments.view_all') ? '' : ' with you'}`
              : 'Loading appointments…'}
          </Text>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.segments} accessibilityRole="tablist">
            {VIEWS.map((v) => (
              <TouchableOpacity
                key={v.id}
                style={[styles.segment, view === v.id && styles.segmentActive]}
                onPress={() => setView(v.id)}
                accessibilityRole="tab"
                accessibilityState={{ selected: view === v.id }}
              >
                <Text style={[styles.segmentText, view === v.id && styles.segmentTextActive]}>{v.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.nav}>
            <TouchableOpacity style={styles.navArrow} onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel={`Previous ${view}`}>
              <Icon name="chevron-back" size={20} color={palette.onSurface} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.todayButton} onPress={() => setSelected(today)} accessibilityRole="button">
              <Text style={styles.todayText}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.navArrow} onPress={() => step(1)} accessibilityRole="button" accessibilityLabel={`Next ${view}`}>
              <Icon name="chevron-forward" size={20} color={palette.onSurface} />
            </TouchableOpacity>
          </View>
        </View>

        {view === 'week' && (
          <View style={styles.week}>
            {days.map((day) => {
              const count = byDay[day]?.length ?? 0;
              const active = day === selected;
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.weekDay, active && styles.weekDayActive]}
                  onPress={() => setSelected(day)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${dayTitle(day)}, ${count} ${count === 1 ? 'appointment' : 'appointments'}`}
                >
                  <Text style={[styles.weekDayName, active && styles.onPrimary, day === today && !active && styles.primaryText]}>{WEEKDAYS[weekdayOf(day)]}</Text>
                  <Text style={[styles.weekDayDate, active && styles.onPrimary, day === today && !active && styles.primaryText]}>{Number(day.slice(8))}</Text>
                  <View style={[styles.dot, count === 0 && styles.dotEmpty, active && styles.dotActive]} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {view === 'month' && (
          <View style={styles.month}>
            {days.slice(0, 7).map((day) => (
              <Text key={`h-${day}`} style={styles.monthHead}>{WEEKDAYS[weekdayOf(day)].charAt(0)}</Text>
            ))}
            {days.map((day) => {
              const count = byDay[day]?.length ?? 0;
              const active = day === selected;
              const outside = !day.startsWith(selected.slice(0, 7));
              return (
                <TouchableOpacity
                  key={day}
                  style={styles.monthCell}
                  onPress={() => setSelected(day)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${dayTitle(day)}, ${count} ${count === 1 ? 'appointment' : 'appointments'}`}
                >
                  <View style={[styles.monthDate, day === today && styles.monthToday, active && styles.monthSelected]}>
                    <Text style={[styles.monthDateText, outside && styles.outside, (active || day === today) && styles.onPrimary, day === today && !active && styles.primaryText]}>
                      {Number(day.slice(8))}
                    </Text>
                  </View>
                  {count > 0 ? <Text style={styles.monthCount}>{count}</Text> : <Text style={styles.monthCountEmpty}> </Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {!calendar.data ? (
          <LoadState loading={calendar.loading} error={calendar.error} onRetry={calendar.reload} />
        ) : (
          <View style={styles.agenda}>
            {!calendar.data.complete && <Text style={styles.warning}>Only the first 500 appointments in this period are shown.</Text>}
            <View style={styles.agendaHeader}>
              <Text style={styles.agendaTitle}>{selected === today ? "Today's Agenda" : dayTitle(selected)}</Text>
              {view !== 'day' && (
                <TouchableOpacity onPress={() => setView('day')} accessibilityRole="button" style={styles.linkTouch}>
                  <Text style={styles.link}>View All</Text>
                </TouchableOpacity>
              )}
            </View>
            {dayList.length === 0 ? (
              <EmptyState icon="calendar-clear-outline" text="No appointments on this day." />
            ) : (
              dayList.map((a) => (
                <AgendaItem key={a.id} appointment={a} now={now} onPress={() => navigation.navigate('ClinicAppointmentDetail', { appointmentId: a.id })} />
              ))
            )}
            <Text style={styles.statusTitle}>Daily Status</Text>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Completed</Text>
                <Text style={[styles.statValue, styles.primaryText]}>{String(completed).padStart(2, '0')}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Remaining</Text>
                <Text style={styles.statValue}>{String(remaining).padStart(2, '0')}</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  title: { ...type.headlineMd, color: palette.onSurface },
  subtitle: { ...type.bodyMd, color: palette.onSurfaceVariant },
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  segments: { flexDirection: 'row', padding: spacing.xs, borderRadius: radius.xl, backgroundColor: palette.surfaceContainerHigh },
  segment: { paddingHorizontal: spacing.md, minHeight: 36, justifyContent: 'center', borderRadius: radius.lg },
  segmentActive: { backgroundColor: palette.surfaceContainerLowest, ...shadow.sm },
  segmentText: { ...type.labelMd, color: palette.onSurfaceVariant },
  segmentTextActive: { color: palette.primary },
  nav: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  navArrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full },
  todayButton: { paddingHorizontal: spacing.md, minHeight: 36, justifyContent: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: palette.outlineVariant },
  todayText: { ...type.labelMd, color: palette.onSurface },
  week: { flexDirection: 'row', gap: spacing.xs },
  weekDay: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.xl, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceContainerLowest, gap: 2 },
  weekDayActive: { backgroundColor: palette.primary, borderColor: palette.primary },
  weekDayName: { fontSize: 10, fontWeight: '600', color: palette.onSurfaceVariant },
  weekDayDate: { fontSize: 18, fontWeight: '700', color: palette.onSurface },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.secondary },
  dotEmpty: { backgroundColor: 'transparent' },
  dotActive: { backgroundColor: palette.secondaryContainer },
  onPrimary: { color: palette.onPrimary },
  primaryText: { color: palette.primary },
  month: { flexDirection: 'row', flexWrap: 'wrap', padding: spacing.sm, borderRadius: radius.xxl, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceContainerLowest },
  monthHead: { width: `${100 / 7}%`, textAlign: 'center', ...type.labelMd, color: palette.onSurfaceVariant, paddingBottom: spacing.xs },
  monthCell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: spacing.xs, minHeight: 52 },
  monthDate: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  monthToday: { backgroundColor: palette.primaryFixed },
  monthSelected: { backgroundColor: palette.primary },
  monthDateText: { ...type.bodyMd, fontWeight: '600', color: palette.onSurface },
  outside: { color: palette.outlineVariant },
  monthCount: { fontSize: 10, fontWeight: '700', color: palette.secondary },
  monthCountEmpty: { fontSize: 10 },
  agenda: { padding: spacing.md, borderRadius: radius.xxl, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceContainerLowest, gap: spacing.sm },
  agendaHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  agendaTitle: { ...type.titleLg, fontWeight: '700', color: palette.onSurface },
  linkTouch: { minHeight: 44, justifyContent: 'center' },
  link: { ...type.labelMd, color: palette.primary },
  warning: { ...type.bodyMd, color: palette.onErrorContainer, backgroundColor: palette.errorContainer, padding: spacing.sm, borderRadius: radius.lg },
  item: { padding: spacing.sm, borderRadius: radius.lg, borderLeftWidth: 4, gap: 2 },
  itemNow: { borderWidth: 2, borderColor: palette.primary, borderLeftWidth: 4 },
  nowBadge: { position: 'absolute', top: -8, right: -4, paddingHorizontal: spacing.base, paddingVertical: 2, borderRadius: radius.full, overflow: 'hidden', backgroundColor: palette.primary, color: palette.onPrimary, fontSize: 9, fontWeight: '800' },
  itemHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  itemService: { ...type.labelMd, fontWeight: '700', flexShrink: 1 },
  itemPatient: { ...type.bodyLg, fontWeight: '600', color: palette.onSurface },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  itemMetaText: { fontSize: 12, color: palette.onSurfaceVariant, marginRight: spacing.sm },
  statusTitle: { ...type.labelMd, fontWeight: '700', color: palette.onSurfaceVariant, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: palette.outlineVariant },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, padding: spacing.sm, borderRadius: radius.xl, backgroundColor: palette.surfaceContainerLow },
  statLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', color: palette.onSurfaceVariant },
  statValue: { ...type.headlineMd, fontWeight: '700', color: palette.onSurface },
});

export default ClinicScheduleScreen;
