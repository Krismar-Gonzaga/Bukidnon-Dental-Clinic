// My Appointments (web: DentistAppointments): by day or by week, and an answer to a request.
import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { ClinicScreen } from '../../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../../components/clinic/ClinicPortalContext';
import { Badge, Button, Card, Chips, EmptyState, FormError, LoadState, Pager, Sheet, ui, useLoader, useRefreshOnFocus } from '../../../components/clinic/ClinicUi';
import { toBusinessDateKey } from '../../../services/booking';
import { ClinicAppointment, fetchAppointments, runAppointmentAction, serverMessage } from '../../../services/clinicPortal';
import { palette, radius, spacing } from '../../../theme/tokens';
import { addDays, dayKey, formatDay, mondayOf, statusBadge, timeOf, weekdayName } from './dentistKit';

const PER_PAGE = 50;
const DAYS_BACK = 7;
const DAYS_IN_WEEK = 7;

const FILTERS = [
  { id: '', label: 'All' },
  { id: 'pending,reschedule_requested', label: 'Pending' },
  { id: 'confirmed,checked_in', label: 'Confirmed' },
  { id: 'in_progress', label: 'Ongoing' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled,rejected,no_show', label: 'Cancelled' },
];

type Row = { kind: 'day'; key: string; count: number } | { kind: 'visit'; key: string; appointment: ClinicAppointment };

const DentistAppointments = ({ route }: { route?: { params?: { date?: string } } }) => {
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const today = toBusinessDateKey(new Date());
  const startOn = route?.params?.date;
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [status, setStatus] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [monday, setMonday] = useState(() => mondayOf(today));
  const [confirming, setConfirming] = useState<ClinicAppointment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const list = useLoader(
    () =>
      view === 'calendar'
        ? fetchAppointments(clinicId, { from: monday, to: addDays(monday, DAYS_IN_WEEK - 1), status: status || undefined, per_page: 100 })
        : fetchAppointments(clinicId, { from: startOn ?? (dateFilter ? undefined : addDays(today, -DAYS_BACK)), to: startOn, status: status || undefined, page, per_page: PER_PAGE }),
    [clinicId, view, monday, status, page, startOn, Boolean(dateFilter), today],
    'Appointments could not be loaded.',
  );
  useRefreshOnFocus(list.sync);

  const items = list.data?.items ?? [];
  const term = dateFilter.trim().toLowerCase();
  const shown = term ? items.filter((a) => a.starts_at && formatDay(dayKey(a.starts_at)).toLowerCase().includes(term)) : items;
  const rows: Row[] = [];
  shown.forEach((appointment) => {
    const key = appointment.starts_at ? dayKey(appointment.starts_at) : '';
    const header = rows.find((row) => row.kind === 'day' && row.key === `day-${key}`);
    if (header && header.kind === 'day') header.count += 1;
    else rows.push({ kind: 'day', key: `day-${key}`, count: 1 });
    rows.push({ kind: 'visit', key: String(appointment.id), appointment });
  });

  const openVisit = (id: number) => navigation.navigate('ClinicAppointmentDetail', { appointmentId: id });

  const confirm = async () => {
    if (!confirming) return;
    setBusy(true);
    setError(null);
    try {
      await runAppointmentAction(clinicId, confirming.id, 'confirm');
      setConfirming(null);
      list.sync();
    } catch (err) {
      setError(serverMessage(err, 'The appointment could not be confirmed.'));
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <View style={styles.header}>
      <Chips
        options={[
          { id: 'list' as const, label: 'List' },
          { id: 'calendar' as const, label: 'Calendar' },
        ]}
        value={view}
        onChange={setView}
        scroll={false}
      />
      <Chips
        options={FILTERS}
        value={status}
        onChange={(value) => {
          setStatus(value);
          setPage(1);
        }}
      />
      {view === 'list' && (
        <TextInput
          style={styles.filter}
          placeholder="Filter by date (e.g. July)"
          placeholderTextColor={palette.onSurfaceVariant}
          value={dateFilter}
          maxLength={40}
          onChangeText={setDateFilter}
          accessibilityLabel="Filter by date"
        />
      )}
      {list.data?.meta?.total != null && <Text style={ui.small}>{list.data.meta.total} appointments</Text>}
      <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
    </View>
  );

  return (
    <ClinicScreen title="My Appointments" active="ClinicAppointments">
      {view === 'calendar' ? (
        <FlatList
          data={Array.from({ length: DAYS_IN_WEEK }, (_, offset) => addDays(monday, offset))}
          keyExtractor={(day) => day}
          contentContainerStyle={ui.content}
          ListHeaderComponent={
            <>
              {header}
              <View style={ui.between}>
                <Button small variant="outline" icon="chevron-back" label="Previous" onPress={() => setMonday(addDays(monday, -DAYS_IN_WEEK))} />
                <Button small variant="outline" icon="chevron-forward" label="Next" onPress={() => setMonday(addDays(monday, DAYS_IN_WEEK))} />
              </View>
              <Text style={[ui.title, styles.weekTitle]}>
                Week of {formatDay(monday)} – {formatDay(addDays(monday, DAYS_IN_WEEK - 1))}
              </Text>
            </>
          }
          renderItem={({ item: day }) => {
            const visits = items.filter((a) => a.starts_at && dayKey(a.starts_at) === day);
            return (
              <Card style={day === today ? styles.todayCard : undefined} title={`${weekdayName(day)} ${Number(day.slice(8))}`}>
                {visits.length === 0 ? (
                  <Text style={ui.small}>No appts</Text>
                ) : (
                  visits.map((a) => (
                    <TouchableOpacity key={a.id} style={styles.chip} onPress={() => openVisit(a.id)} accessibilityRole="button" accessibilityLabel={`${timeOf(a.starts_at)} ${a.patient?.name}`}>
                      <Text style={styles.chipText} numberOfLines={1}>{timeOf(a.starts_at)} {String(a.patient?.name ?? '').split(' ')[0]}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </Card>
            );
          }}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(row) => row.key}
          contentContainerStyle={ui.content}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
          ListHeaderComponent={header}
          ListEmptyComponent={list.loading || list.error ? undefined : <EmptyState icon="calendar-outline" text="No appointments match these filters." />}
          ListFooterComponent={<View><Pager page={page} lastPage={list.data?.meta?.last_page ?? 1} onChange={setPage} /></View>}
          renderItem={({ item: row }) => {
            if (row.kind === 'day') {
              return (
                <View style={styles.dayHead}>
                  <Text style={styles.dayText}>{formatDay(row.key.slice(4)).toUpperCase()}</Text>
                  <Text style={ui.small}>{row.count === 1 ? '1 appt' : `${row.count} appts`}</Text>
                </View>
              );
            }
            const a = row.appointment;
            const badge = statusBadge(a.status);
            return (
              <View style={styles.visit}>
                <TouchableOpacity style={styles.visitOpen} onPress={() => openVisit(a.id)} accessibilityRole="button" accessibilityLabel={`Open appointment for ${a.patient?.name}`}>
                  <View style={styles.hour}>
                    <Text style={styles.hourText}>{timeOf(a.starts_at).replace(':00', '')}</Text>
                  </View>
                  <View style={ui.flex}>
                    <View style={styles.nameLine}>
                      <Text style={ui.title} numberOfLines={1}>{a.patient?.name}</Text>
                      <Badge label={badge.label} tone={badge.tone} />
                    </View>
                    <Text style={ui.small} numberOfLines={1}>{a.service?.name}</Text>
                    {(a as { treatment_notes?: string }).treatment_notes ? <Text style={styles.note} numberOfLines={2}>{(a as { treatment_notes?: string }).treatment_notes}</Text> : null}
                  </View>
                  <Icon name="chevron-forward" size={18} color={palette.primary} />
                </TouchableOpacity>
                {a.status === 'pending' && <Button small variant="tonal" label="Confirm" onPress={() => setConfirming(a)} />}
              </View>
            );
          }}
        />
      )}

      {confirming && (
        <Sheet title="Confirm appointment" onClose={() => setConfirming(null)}>
          <Text style={ui.muted}>Confirm this appointment? {confirming.patient?.name} will be notified.</Text>
          <FormError message={error} />
          <Button label="Confirm appointment" style={ui.spacedTop} busy={busy} onPress={confirm} />
        </Sheet>
      )}
    </ClinicScreen>
  );
};

export default DentistAppointments;

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  filter: { paddingVertical: 10, paddingHorizontal: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.surfaceContainerHigh, backgroundColor: palette.surfaceContainerLowest, color: palette.onSurface, fontSize: 14 },
  weekTitle: { marginVertical: spacing.sm },
  todayCard: { borderColor: palette.primary, borderWidth: 1 },
  chip: { marginTop: spacing.xs, paddingVertical: 6, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: palette.primary },
  chipText: { fontSize: 12, fontWeight: '600', color: '#ffffff' },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  dayText: { fontSize: 12, fontWeight: '700', color: palette.onSurfaceVariant },
  visit: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: palette.surfaceContainerLowest, borderWidth: 1, borderColor: palette.surfaceContainerHigh },
  visitOpen: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hour: { width: 56, height: 44, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surfaceContainerLow },
  hourText: { fontSize: 12, fontWeight: '600', color: palette.onSurfaceVariant, textAlign: 'center' },
  nameLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  note: { fontSize: 11, color: palette.onSurfaceVariant, marginTop: 2 },
});
