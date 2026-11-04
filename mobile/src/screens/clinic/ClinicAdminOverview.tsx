// Clinic admin dashboard sections (web: pages/clinic/ClinicAdminOverview.jsx).
// Every figure comes from the API. There is no chart library in the app, so
// the charts are drawn with plain views; revenue is shown as monthly bars.
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useOpenSection } from '../../components/clinic/ClinicChrome';
import { Button, Field, FormError, Sheet, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import { useAuth } from '../../context/AuthContext';
import { can, ClinicAppointment, fetchAppointments, formatCount, formatDateTime, formatPeso, Membership, runAppointmentAction, serverMessage } from '../../services/clinicPortal';
import {
  businessMinutesNow,
  ChartDay,
  ClinicActivity,
  ClinicInsights,
  fetchAppointmentCalendar,
  fetchClinicInsights,
  greetingFor,
  monthCells,
  moveMonth,
  revenueChange,
  todayNote,
} from '../../services/clinicInsights';
import { palette, radius, shadow, spacing, type } from '../../theme/tokens';

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const SERIES = [
  { key: 'confirmed', label: 'Confirmed', color: '#1f6fd0' },
  { key: 'pending', label: 'Pending', color: '#c98500' },
  { key: 'cancelled', label: 'Cancelled', color: '#e5484d' },
] as const;
const CHART_HEIGHT = 140;

/** Today's YYYY-MM-DD in Philippine time (UTC+8), whatever the device zone. */
const todayKey = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
const dayLabel = (date: string) => SHORT_DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()];
const plural = (n: number, word: string) => `${formatCount(n)} ${word}${n === 1 ? '' : 's'}`;

function Tile({ icon, color, bg, value, label, note, onPress }: { icon: string; color: string; bg: string; value: string; label: string; note: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}. ${note}`}>
      <View style={[styles.tileIcon, { backgroundColor: bg }]}>
        <Icon name={icon} size={20} color={color} />
      </View>
      <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.tileNote} numberOfLines={1}>{note}</Text>
    </TouchableOpacity>
  );
}

function AppointmentChart({ days }: { days: ChartDay[] }) {
  const [active, setActive] = useState<string | null>(null);
  const highest = Math.max(1, ...days.map((d) => d.confirmed + d.pending + d.cancelled));
  const selected = days.find((d) => d.date === active);

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Appointments Overview</Text>
      <Text style={styles.muted}>Last 7 days</Text>
      <View style={styles.legend}>
        {SERIES.map((s) => (
          <View key={s.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: s.color }]} />
            <Text style={styles.small}>{s.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.bars}>
        {days.map((day, index) => {
          const summary = `${index === days.length - 1 ? 'Today' : dayLabel(day.date)}: ${day.confirmed} confirmed, ${day.pending} pending, ${day.cancelled} cancelled`;
          return (
            <Pressable key={day.date} style={styles.barColumn} onPress={() => setActive(active === day.date ? null : day.date)} accessibilityRole="button" accessibilityLabel={summary}>
              <View style={styles.barStack}>
                {SERIES.map((s) =>
                  day[s.key] > 0 ? <View key={s.key} style={[styles.barSegment, { height: (day[s.key] / highest) * CHART_HEIGHT, backgroundColor: s.color }]} /> : null,
                )}
              </View>
              <Text style={[styles.barLabel, active === day.date && styles.barLabelActive]}>{index === days.length - 1 ? 'Today' : dayLabel(day.date)}</Text>
            </Pressable>
          );
        })}
      </View>
      {selected ? (
        <Text style={styles.small}>
          {selected.date}: {selected.confirmed} confirmed, {selected.pending} pending, {selected.cancelled} cancelled
        </Text>
      ) : (
        <Text style={styles.small}>Tap a day to see its numbers.</Text>
      )}
    </View>
  );
}

function RevenueChart({ revenue }: { revenue: ClinicInsights['revenue'] }) {
  const [active, setActive] = useState<string | null>(null);
  const change = revenueChange(revenue.this_month, revenue.last_month);
  const highest = Math.max(1, ...revenue.by_month.map((m) => m.total));
  const selected = revenue.by_month.find((m) => m.month === active) ?? revenue.by_month[revenue.by_month.length - 1];

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Revenue Overview</Text>
      <Text style={styles.muted}>Year to date · {revenue.year} · estimated from completed visits</Text>
      {change && (
        <View style={[styles.trend, !change.up && styles.trendDown]}>
          <Icon name={change.up ? 'trending-up' : 'trending-down'} size={14} color={change.up ? '#0a7d45' : palette.error} />
          <Text style={[styles.trendText, !change.up && styles.trendTextDown]}>{change.text}</Text>
        </View>
      )}
      <View style={styles.bars}>
        {revenue.by_month.map((m) => {
          const name = MONTHS[Number(m.month.slice(5)) - 1];
          return (
            <Pressable key={m.month} style={styles.barColumn} onPress={() => setActive(m.month)} accessibilityRole="button" accessibilityLabel={`${name}: ${formatPeso(m.total)}`}>
              <View style={styles.barStack}>
                {m.total > 0 ? <View style={[styles.barSegment, { height: (m.total / highest) * CHART_HEIGHT, backgroundColor: selected?.month === m.month ? palette.primary : '#1f6fd0' }]} /> : null}
              </View>
              <Text style={[styles.barLabel, selected?.month === m.month && styles.barLabelActive]}>{name}</Text>
            </Pressable>
          );
        })}
      </View>
      {selected && (
        <Text style={styles.small}>
          {LONG_MONTHS[Number(selected.month.slice(5)) - 1]}: {formatPeso(selected.total)}
        </Text>
      )}
    </View>
  );
}

function PendingApprovals({ clinicId, canDecide, onChanged, onViewAll, reloadKey }: { clinicId: number; canDecide: boolean; onChanged: () => void; onViewAll: () => void; reloadKey: number }) {
  const list = useLoader(() => fetchAppointments(clinicId, { status: 'pending', from: todayKey(), per_page: 4 }), [clinicId, reloadKey], 'Requests could not be loaded.');
  const [declining, setDeclining] = useState<ClinicAppointment | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = () => {
    list.sync();
    onChanged();
  };

  const confirm = (a: ClinicAppointment) =>
    Alert.alert('Confirm appointment', `Confirm this appointment? ${a.patient?.name ?? 'The patient'} will be notified.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            await runAppointmentAction(clinicId, a.id, 'confirm');
            done();
          } catch (err) {
            Alert.alert('Not confirmed', serverMessage(err, 'Please try again.'));
          }
        },
      },
    ]);

  const decline = async () => {
    if (!declining) return;
    setBusy(true);
    setError(null);
    try {
      await runAppointmentAction(clinicId, declining.id, 'reject', { reason: reason.trim() });
      setDeclining(null);
      setReason('');
      done();
    } catch (err) {
      setError(serverMessage(err, 'The request could not be declined.'));
    } finally {
      setBusy(false);
    }
  };

  const rows = list.data?.items ?? [];
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>Pending Approvals</Text>
        <TouchableOpacity onPress={onViewAll} accessibilityRole="link">
          <Text style={styles.link}>View all</Text>
        </TouchableOpacity>
      </View>
      {list.loading ? <Text style={styles.muted}>Loading requests…</Text> : null}
      {list.error ? <Text style={styles.errorText}>{list.error}</Text> : null}
      {list.data && rows.length === 0 ? <Text style={styles.muted}>No requests waiting.</Text> : null}
      {rows.map((a) => (
        <View key={a.id} style={styles.pending}>
          <Icon name="time-outline" size={20} color="#b7791f" />
          <View style={styles.flex}>
            <Text style={styles.pendingName} numberOfLines={1}>{a.patient?.name}</Text>
            <Text style={styles.small} numberOfLines={1}>
              {a.service?.name} · {formatDateTime(a.starts_at)}
            </Text>
          </View>
          {canDecide && (
            <>
              <TouchableOpacity style={[styles.pendingButton, styles.accept]} onPress={() => confirm(a)} accessibilityRole="button" accessibilityLabel={`Confirm ${a.patient?.name}`}>
                <Icon name="checkmark" size={18} color="#0a7d45" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pendingButton, styles.reject]}
                onPress={() => {
                  setError(null);
                  setReason('');
                  setDeclining(a);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Decline ${a.patient?.name}`}
              >
                <Icon name="close" size={18} color={palette.error} />
              </TouchableOpacity>
            </>
          )}
        </View>
      ))}
      {declining && (
        <Sheet title="Decline request" onClose={busy ? () => undefined : () => setDeclining(null)}>
          <Text style={styles.muted}>{declining.patient?.name ?? 'The patient'} will be told the reason.</Text>
          <Field label="Reason" required multiline maxLength={500} value={reason} onChangeText={setReason} />
          <FormError message={error} />
          <Button label="Decline request" variant="danger" busy={busy} disabled={!reason.trim()} onPress={decline} />
        </Sheet>
      )}
    </View>
  );
}

function MonthCalendar({ clinicId, todayCount, onOpenDay, reloadKey }: { clinicId: number; todayCount: number; onOpenDay: (date: string) => void; reloadKey: number }) {
  const today = todayKey();
  const [month, setMonth] = useState(today.slice(0, 7));
  const calendar = useLoader(() => fetchAppointmentCalendar(clinicId, month), [clinicId, month, reloadKey], 'The calendar could not be loaded.');
  const counts = Object.fromEntries((calendar.data?.days ?? []).map((d) => [d.date, d.total]));
  const cells = monthCells(month);

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>
          {LONG_MONTHS[Number(month.slice(5)) - 1]} {month.slice(0, 4)}
        </Text>
        <View style={styles.row}>
          <TouchableOpacity style={styles.navButton} onPress={() => setMonth(moveMonth(month, -1))} accessibilityRole="button" accessibilityLabel="Previous month">
            <Icon name="chevron-back" size={18} color={palette.onSurfaceVariant} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navButton} onPress={() => setMonth(moveMonth(month, 1))} accessibilityRole="button" accessibilityLabel="Next month">
            <Icon name="chevron-forward" size={18} color={palette.onSurfaceVariant} />
          </TouchableOpacity>
        </View>
      </View>
      {calendar.error ? <Text style={styles.errorText}>{calendar.error}</Text> : null}
      <View style={styles.calendar}>
        {WEEKDAYS.map((d) => (
          <Text key={d} style={styles.weekday}>{d}</Text>
        ))}
        {cells.map((key, index) => {
          if (!key) return <View key={`gap-${index}`} style={styles.day} />;
          const total = counts[key] ?? 0;
          const isToday = key === today;
          return (
            <Pressable
              key={key}
              style={styles.day}
              disabled={!total && !isToday}
              onPress={() => onOpenDay(key)}
              accessibilityRole="button"
              accessibilityLabel={`${key}: ${plural(total, 'appointment')}`}
            >
              <View style={[styles.dayInner, total > 0 && styles.dayBooked, isToday && styles.dayToday]}>
                <Text style={[styles.dayText, total > 0 && styles.dayTextBooked, isToday && styles.dayTextToday]}>{Number(key.slice(8))}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.calendarNote}>
        <View style={[styles.legendDot, { backgroundColor: palette.primary }]} />
        <Text style={styles.small}>Today: {plural(todayCount, 'appointment')}</Text>
      </View>
    </View>
  );
}

const ACTIVITY_ICONS: Record<string, string> = { appointment: 'checkmark-circle-outline', patient: 'person-outline', membership: 'people-outline', inventory: 'cube-outline', review: 'star-outline' };

function Activity({ activity }: { activity: ClinicActivity[] }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Recent Activity</Text>
      {activity.length === 0 ? <Text style={styles.muted}>Nothing recorded yet.</Text> : null}
      {activity.map((entry) => (
        <View key={entry.id} style={styles.activity}>
          <Icon name={ACTIVITY_ICONS[entry.kind] ?? 'time-outline'} size={20} color={palette.primary} />
          <View style={styles.flex}>
            <Text style={styles.activityText}>{entry.subject ? `${entry.title}: ${entry.subject}` : entry.title}</Text>
            <Text style={styles.small}>
              {formatDateTime(entry.created_at)}
              {entry.actor ? ` · ${entry.actor}` : ''}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** The design's sections, above the existing branch and alert cards. */
export function ClinicAdminOverview({ membership, reloadKey }: { membership: Membership; reloadKey: number }) {
  const { user } = useAuth();
  const open = useOpenSection('ClinicDashboard');
  const navigation = useNavigation<any>();
  const clinicId = membership.clinic_id;
  const key = reloadKey;
  const insightsLoader = useLoader(() => fetchClinicInsights(clinicId), [clinicId, key], 'The dashboard figures could not be loaded.');
  useRefreshOnFocus(insightsLoader.sync);
  const insights = insightsLoader.data;
  const canWalkIn = can(membership, 'appointments.manage');
  const change = insights ? revenueChange(insights.revenue.this_month, insights.revenue.last_month) : null;

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <Text style={styles.heroGreeting}>{greetingFor(businessMinutesNow())}</Text>
        <Text style={styles.heroName}>{user?.name}</Text>
        <Text style={styles.heroSummary}>
          {insights ? (
            <>
              You have <Text style={styles.heroStrong}>{plural(insights.today.appointments, 'appointment')}</Text> today and{' '}
              <Text style={styles.heroAccent}>{formatCount(insights.today.pending_requests)} pending {insights.today.pending_requests === 1 ? 'approval' : 'approvals'}</Text>.
            </>
          ) : (
            "Loading today's figures…"
          )}
        </Text>
        <View style={styles.heroActions}>
          {canWalkIn && (
            <TouchableOpacity style={[styles.heroButton, styles.heroButtonSolid]} onPress={() => navigation.navigate('ClinicWalkIn')} accessibilityRole="button">
              <Icon name="calendar-outline" size={18} color={palette.primary} />
              <Text style={styles.heroButtonSolidText}>Walk-in Appointment</Text>
            </TouchableOpacity>
          )}
          {can(membership, 'clinic.staff.manage') && (
            <TouchableOpacity style={styles.heroButton} onPress={() => navigation.navigate('ClinicAddDentist')} accessibilityRole="button">
              <Icon name="person-add-outline" size={18} color={palette.onPrimary} />
              <Text style={styles.heroButtonText}>Invite Dentist</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {insightsLoader.error && !insights ? (
        <View style={styles.card}>
          <Text style={styles.errorText}>{insightsLoader.error}</Text>
          <Button small variant="outline" label="Try again" onPress={insightsLoader.reload} />
        </View>
      ) : null}

      {insights && (
        <View style={styles.tiles}>
          <Tile icon="calendar-outline" color="#1d5fd1" bg="#e8f0fe" value={formatCount(insights.today.appointments)} label="Today's Appointments" note={todayNote(insights.today.appointments, insights.today.yesterday)} onPress={() => open('ClinicAppointments', { date: insights.today.date })} />
          <Tile icon="time-outline" color="#b7791f" bg="#fff7e0" value={formatCount(insights.today.pending_requests)} label="Pending Requests" note={insights.today.pending_requests ? 'Needs approval' : 'All caught up'} onPress={() => open('ClinicAppointments', { status: 'pending' })} />
          <Tile icon="people-outline" color="#0f9d58" bg="#e6f8ef" value={formatCount(insights.patients.total)} label="Total Patients" note={`+${formatCount(insights.patients.new_this_month)} this month`} onPress={() => open('ClinicPatients')} />
          <Tile icon="medkit-outline" color="#7e22ce" bg="#f3e8ff" value={formatCount(insights.dentists.active)} label="Active Dentists" note={insights.dentists.inactive ? `${insights.dentists.inactive} inactive` : 'All active'} onPress={() => open('ClinicDentists')} />
          <Tile icon="person-outline" color="#0e8fa3" bg="#e3f8fb" value={formatCount(insights.staff.total)} label="Clinic Staff" note={`${formatCount(insights.staff.active)} active`} onPress={() => open('ClinicStaff')} />
          <Tile icon="trending-up-outline" color="#0f9d58" bg="#e6f8ef" value={formatPeso(insights.revenue.this_month)} label="Monthly Revenue" note={change ? `${change.up ? '+' : '-'}${change.text}` : 'Estimate'} onPress={() => open('ClinicReports')} />
        </View>
      )}

      <PendingApprovals clinicId={clinicId} canDecide={canWalkIn} reloadKey={key} onChanged={insightsLoader.sync} onViewAll={() => open('ClinicAppointments', { status: 'pending' })} />
      {insights && <AppointmentChart days={insights.appointments_by_day} />}
      <MonthCalendar clinicId={clinicId} todayCount={insights?.today.appointments ?? 0} reloadKey={key} onOpenDay={(date) => open('ClinicAppointments', { date })} />
      {insights && <RevenueChart revenue={insights.revenue} />}
      {insights && <Activity activity={insights.activity} />}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          {canWalkIn && (
            <TouchableOpacity style={styles.quick} onPress={() => navigation.navigate('ClinicWalkIn')} accessibilityRole="button">
              <Icon name="calendar-outline" size={24} color={palette.primary} />
              <Text style={styles.quickText}>Walk-in Appt</Text>
            </TouchableOpacity>
          )}
          {can(membership, 'patients.manage') && (
            <TouchableOpacity style={styles.quick} onPress={() => open('ClinicPatients', { register: true })} accessibilityRole="button">
              <Icon name="person-add-outline" size={24} color={palette.primary} />
              <Text style={styles.quickText}>Add Patient</Text>
            </TouchableOpacity>
          )}
          {can(membership, 'inventory.manage') && (
            <TouchableOpacity style={styles.quick} onPress={() => open('ClinicInventory', { addItem: true })} accessibilityRole="button">
              <Icon name="cube-outline" size={24} color={palette.primary} />
              <Text style={styles.quickText}>Add Inventory</Text>
            </TouchableOpacity>
          )}
          {can(membership, 'reports.view') && (
            <TouchableOpacity style={styles.quick} onPress={() => open('ClinicReports')} accessibilityRole="button">
              <Icon name="bar-chart-outline" size={24} color={palette.primary} />
              <Text style={styles.quickText}>View Reports</Text>
            </TouchableOpacity>
          )}
          {can(membership, 'clinic.staff.manage') && (
            <TouchableOpacity style={styles.quick} onPress={() => navigation.navigate('ClinicAddDentist')} accessibilityRole="button">
              <Icon name="medkit-outline" size={24} color={palette.primary} />
              <Text style={styles.quickText}>Invite Dentist</Text>
            </TouchableOpacity>
          )}
          {can(membership, 'clinic.settings.manage') && (
            <TouchableOpacity style={styles.quick} onPress={() => open('ClinicAdminSettings')} accessibilityRole="button">
              <Icon name="settings-outline" size={24} color={palette.primary} />
              <Text style={styles.quickText}>Settings</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md, marginBottom: spacing.md },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: spacing.xs },
  muted: { ...type.bodyMd, color: palette.onSurfaceVariant },
  small: { fontSize: 12, lineHeight: 17, color: palette.onSurfaceVariant },
  link: { fontWeight: '600', color: palette.primary },
  errorText: { ...type.bodyMd, color: palette.error },
  hero: { padding: spacing.lg, borderRadius: radius.xxl, backgroundColor: palette.primary },
  heroGreeting: { ...type.bodyMd, color: palette.primaryFixedDim },
  heroName: { ...type.headlineMd, color: palette.onPrimary, marginVertical: 2 },
  heroSummary: { ...type.bodyMd, color: palette.primaryFixed },
  heroStrong: { fontWeight: '700', color: palette.onPrimary },
  heroAccent: { fontWeight: '700', color: '#ffe066' },
  heroActions: { gap: spacing.base, marginTop: spacing.md },
  heroButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.base, minHeight: 44, borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  heroButtonSolid: { backgroundColor: palette.onPrimary, borderColor: palette.onPrimary },
  heroButtonText: { fontWeight: '600', color: palette.onPrimary },
  heroButtonSolidText: { fontWeight: '600', color: palette.primary },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { flexBasis: '47%', flexGrow: 1, padding: spacing.md, borderRadius: radius.xxl, backgroundColor: palette.surfaceContainerLowest, ...shadow.sm },
  tileIcon: { alignSelf: 'flex-start', padding: spacing.base, borderRadius: radius.xl },
  tileValue: { ...type.headlineMd, color: palette.onSurface, marginTop: spacing.base },
  tileLabel: { fontSize: 13, fontWeight: '600', color: palette.onSurface },
  tileNote: { fontSize: 12, color: palette.onSurfaceVariant },
  card: { gap: spacing.base, padding: spacing.md, borderRadius: radius.xxl, backgroundColor: palette.surfaceContainerLowest, ...shadow.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { ...type.titleLg, color: palette.onSurface },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.base },
  barColumn: { flex: 1, alignItems: 'center' },
  barStack: { height: CHART_HEIGHT, justifyContent: 'flex-end', gap: 2, width: 20 },
  barSegment: { minHeight: 2, borderRadius: 3 },
  barLabel: { marginTop: spacing.xs, fontSize: 11, color: palette.onSurfaceVariant },
  barLabelActive: { fontWeight: '700', color: palette.primary },
  trend: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: '#ecfbf3' },
  trendDown: { backgroundColor: palette.errorContainer },
  trendText: { fontSize: 12, fontWeight: '600', color: '#0a7d45' },
  trendTextDown: { color: palette.error },
  pending: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, padding: spacing.sm, borderWidth: 1, borderColor: '#f6e3a1', borderRadius: radius.xl, backgroundColor: '#fffbeb' },
  pendingName: { fontWeight: '600', color: palette.onSurface },
  pendingButton: { padding: spacing.base, borderRadius: radius.lg },
  accept: { backgroundColor: '#d5f5e3' },
  reject: { backgroundColor: palette.errorContainer },
  navButton: { padding: spacing.base },
  calendar: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, paddingBottom: spacing.xs, fontSize: 11, fontWeight: '600', textAlign: 'center', color: palette.onSurfaceVariant },
  day: { width: `${100 / 7}%`, padding: 2 },
  dayInner: { alignItems: 'center', justifyContent: 'center', height: 34, borderRadius: radius.lg },
  dayBooked: { backgroundColor: '#dbe8fb' },
  dayToday: { backgroundColor: palette.primary },
  dayText: { fontSize: 13, color: palette.onSurface },
  dayTextBooked: { fontWeight: '600', color: palette.primary },
  dayTextToday: { fontWeight: '700', color: palette.onPrimary },
  calendarNote: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: palette.surfaceContainerHigh },
  activity: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.xs },
  activityText: { ...type.bodyMd, color: palette.onSurface },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.base },
  quick: { flexBasis: '47%', flexGrow: 1, alignItems: 'center', gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: palette.surfaceContainerHigh, borderRadius: radius.xl },
  quickText: { fontSize: 12, fontWeight: '600', color: palette.onSurface },
});
