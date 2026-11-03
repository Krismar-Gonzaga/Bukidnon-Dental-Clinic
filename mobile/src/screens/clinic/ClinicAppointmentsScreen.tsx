// Appointment queue (web: ClinicAppointmentsPage): day / week / month view
// from a start date, status and dentist filters, patient search and paging.
// Dentists with assigned-only access see their own appointments (server rule).
import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { Badge, Chips, EmptyState, LoadState, Pager, SearchBox, SelectField, ui, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import { DateField } from '../../components/clinic/DateField';
import {
  can,
  CLINIC_APPOINTMENT_STATUSES,
  ClinicAppointment,
  fetchAppointments,
  fetchDentists,
  formatDateTime,
} from '../../services/clinicPortal';
import { toBusinessDateKey, formatDateKey } from '../../services/booking';
import { palette, radius, spacing, type } from '../../theme/tokens';

const VIEWS = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
] as const;
const VIEW_DAYS = { day: 0, week: 6, month: 29 };
const STATUS_OPTIONS = [{ id: '', label: 'All statuses' }, ...CLINIC_APPOINTMENT_STATUSES];

export const addDays = (key: string, days: number) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};

function useDebounced<T>(value: T, ms = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

type Props = { route?: { params?: { status?: string; date?: string } } };

const ClinicAppointmentsScreen = ({ route }: Props) => {
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const initialStatus = route?.params?.status ?? '';
  // A status from a dashboard alert opens the list over 30 days; a date
  // (the dashboard calendar) opens that day.
  const initialDate = route?.params?.date;
  const [view, setView] = useState<(typeof VIEWS)[number]['id']>(initialDate ? 'day' : initialStatus ? 'month' : 'week');
  const [from, setFrom] = useState(initialDate ?? toBusinessDateKey(new Date()));
  const [status, setStatus] = useState(initialStatus);
  const [dentistId, setDentistId] = useState<number | 0>(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const term = useDebounced(search.trim());
  const to = addDays(from, VIEW_DAYS[view]);
  const canFilterDentist = can(membership, 'appointments.view_all');

  useEffect(() => setStatus(initialStatus), [initialStatus]);
  useEffect(() => setPage(1), [view, from, status, dentistId, term]);

  const dentists = useLoader(() => (canFilterDentist ? fetchDentists(clinicId) : Promise.resolve([])), [clinicId, canFilterDentist]);
  const list = useLoader(
    () =>
      fetchAppointments(clinicId, {
        from,
        to,
        status: status || undefined,
        dentist_id: dentistId || undefined,
        search: term || undefined,
        page,
        per_page: 20,
      }),
    [clinicId, from, to, status, dentistId, term, page],
    'Appointments could not be loaded.',
  );

  // Back from an appointment: show its new status.
  useRefreshOnFocus(list.sync);

  const header = (
    <View style={styles.header}>
      <Text style={ui.muted}>
        {formatDateKey(from)}
        {view !== 'day' ? ` – ${formatDateKey(to)}` : ''} · Philippine time
      </Text>
      <Chips options={[...VIEWS]} value={view} onChange={setView} />
      <DateField label="Starting" value={from} onChange={(v) => v && setFrom(v)} />
      <SearchBox value={search} onChangeText={setSearch} placeholder="Search patient name, phone or email…" />
      <Chips options={STATUS_OPTIONS} value={status} onChange={setStatus} />
      {canFilterDentist && (
        <SelectField
          label="Dentist"
          value={dentistId}
          onChange={setDentistId}
          options={[{ id: 0, label: 'All dentists' }, ...(dentists.data ?? []).map((d) => ({ id: d.id, label: d.name }))]}
        />
      )}
      {list.data && <Text style={ui.small}>{list.data.meta.total} appointment{list.data.meta.total === 1 ? '' : 's'}</Text>}
    </View>
  );

  return (
    <ClinicScreen title="Appointments" active="ClinicAppointments">
      <FlatList
        data={list.loading ? [] : list.data?.items ?? []}
        keyExtractor={(a) => String(a.id)}
        ListHeaderComponent={
          <>
            {header}
            <LoadState loading={list.loading} error={list.data ? null : list.error} onRetry={list.reload} />
          </>
        }
        ListEmptyComponent={list.loading || list.error ? undefined : <EmptyState icon="calendar-outline" text="No appointments match these filters." />}
        ListFooterComponent={list.data ? <Pager page={page} lastPage={list.data.meta.last_page} onChange={setPage} /> : undefined}
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} colors={[palette.primary]} />}
        renderItem={({ item }) => <AppointmentRow appointment={item} onPress={() => navigation.navigate('ClinicAppointmentDetail', { appointmentId: item.id })} />}
      />
    </ClinicScreen>
  );
};

export function AppointmentRow({ appointment: a, onPress, showPatient = true }: { appointment: ClinicAppointment; onPress: () => void; showPatient?: boolean }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${a.patient?.name ?? 'Patient'}, ${formatDateTime(a.starts_at)}`}>
      <View style={ui.between}>
        <Text style={styles.when}>{formatDateTime(a.starts_at)}</Text>
        <Badge status={a.status} />
      </View>
      {showPatient && <Text style={ui.title}>{a.patient?.name ?? 'Patient'}</Text>}
      <Text style={ui.muted}>
        {a.service?.name ?? 'Service'}
        {a.dentist?.name ? ` · ${a.dentist.name}` : ''}
      </Text>
      {a.branch?.name ? <Text style={ui.small}>{a.branch.name}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.xs },
  row: {
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: palette.outlineVariant,
    backgroundColor: palette.surfaceContainerLowest,
    gap: 2,
  },
  when: { ...type.labelMd, color: palette.primary },
});

export default ClinicAppointmentsScreen;
