// The front desk's appointment list (web: FrontDeskAppointments): today and
// ahead or one day, search and status filter, confirm and check in from the row.
import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { Badge, Button, Chips, EmptyState, FormError, LoadState, Pager, SearchBox, Sheet, ui, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import { formatClockTime, toBusinessDateKey } from '../../services/booking';
import {
  can,
  CLINIC_APPOINTMENT_STATUSES,
  ClinicAppointment,
  clinicClock,
  clinicDateKey,
  fetchAppointments,
  formatDateTime,
  frontDeskStatus,
  runAppointmentAction,
  serverMessage,
} from '../../services/clinicPortal';
import { palette, radius, spacing } from '../../theme/tokens';

const FILTERS = [{ id: '', label: 'All' }, ...CLINIC_APPOINTMENT_STATUSES];
const PER_PAGE = 20;

type Pending = { appointment: ClinicAppointment; action: 'confirm' | 'check-in' };

const FrontDeskAppointments = ({ date }: { date?: string }) => {
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const today = toBusinessDateKey(new Date());
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManage = can(membership, 'appointments.manage');

  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const list = useLoader(
    () => fetchAppointments(clinicId, { from: date ?? today, to: date, status: status || undefined, search: term || undefined, page, per_page: PER_PAGE }),
    [clinicId, date, today, status, term, page],
    'Appointments could not be loaded.',
  );
  useRefreshOnFocus(list.sync);

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await runAppointmentAction(clinicId, pending.appointment.id, pending.action);
      setPending(null);
      await list.sync();
    } catch (err) {
      setError(serverMessage(err, 'That step could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ClinicScreen title="Appointments" active="ClinicAppointments">
      <FlatList
        data={list.loading ? [] : list.data?.items ?? []}
        keyExtractor={(a) => String(a.id)}
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} colors={[palette.primary]} />}
        ListHeaderComponent={
          <View style={ui.stack}>
            {list.data ? <Text style={ui.muted}>{list.data.meta.total} total</Text> : null}
            <SearchBox value={search} onChangeText={setSearch} placeholder="Search patient..." />
            <Chips
              options={FILTERS}
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            />
            <LoadState loading={list.loading} error={list.data ? null : list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.loading || list.error ? undefined : <EmptyState icon="calendar-outline" text="No appointments match." />}
        ListFooterComponent={list.data ? <Pager page={page} lastPage={list.data.meta.last_page} onChange={setPage} /> : undefined}
        renderItem={({ item: a }) => {
          const label = frontDeskStatus(a.status);
          const [clock, period] = a.starts_at ? formatClockTime(clinicClock(a.starts_at)).split(' ') : ['', ''];
          const arrived = a.status === 'checked_in' || a.status === 'in_progress';
          // Only on the day: a patient cannot arrive for tomorrow's visit.
          const canCheckIn = canManage && a.status === 'confirmed' && Boolean(a.starts_at) && clinicDateKey(a.starts_at as string) === today;
          return (
            <View style={styles.row}>
              <TouchableOpacity style={styles.body} onPress={() => navigation.navigate('ClinicAppointmentDetail', { appointmentId: a.id })} accessibilityRole="button" accessibilityLabel={`Open appointment for ${a.patient?.name}`}>
                <View style={styles.hour}>
                  <Text style={styles.hourText}>{clock.replace(':00', '')}</Text>
                  <Text style={styles.period}>{period}</Text>
                </View>
                <View style={ui.flex}>
                  <Text style={ui.title}>{a.patient?.name}</Text>
                  <View style={ui.rowWrap}>
                    <Badge tone={label.tone} label={label.label} />
                    {arrived ? <Badge tone="info" label="Checked In" /> : null}
                  </View>
                  <Text style={ui.small}>
                    {a.service?.name} · {a.dentist?.name} · {formatDateTime(a.starts_at)}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} color={palette.primary} />
              </TouchableOpacity>
              {canManage && a.status === 'pending' && (
                <Button
                  small
                  variant="outline"
                  label="Confirm"
                  onPress={() => {
                    setError(null);
                    setPending({ appointment: a, action: 'confirm' });
                  }}
                />
              )}
              {canCheckIn && (
                <Button
                  small
                  label="Check In"
                  onPress={() => {
                    setError(null);
                    setPending({ appointment: a, action: 'check-in' });
                  }}
                />
              )}
            </View>
          );
        }}
      />
      {pending && (
        <Sheet title={pending.action === 'confirm' ? 'Confirm Appointment' : 'Check In Patient'} onClose={() => setPending(null)}>
          <Text style={ui.muted}>
            {pending.action === 'confirm' ? `Confirm this appointment? ${pending.appointment.patient?.name} will be notified.` : `Check in ${pending.appointment.patient?.name} for ${pending.appointment.service?.name}?`}
          </Text>
          <FormError message={error} />
          <Button label={pending.action === 'confirm' ? 'Confirm' : 'Check In'} style={ui.spacedTop} busy={busy} onPress={run} />
        </Sheet>
      )}
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  row: { padding: spacing.sm, borderRadius: radius.xl, borderWidth: 1, borderColor: palette.outlineVariant, backgroundColor: palette.surfaceContainerLowest, gap: spacing.sm },
  body: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hour: { width: 48, height: 48, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primaryFixed },
  hourText: { fontSize: 13, fontWeight: '700', color: palette.primary },
  period: { fontSize: 10, color: palette.primary },
});

export default FrontDeskAppointments;
