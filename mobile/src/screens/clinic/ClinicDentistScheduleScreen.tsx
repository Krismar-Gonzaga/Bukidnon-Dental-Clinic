// Dentist Schedule (web: ClinicDentistSchedulePage). View only: schedules are
// set by the clinic admin. The day, the dentist's availability and open times.
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { StatRow } from '../../components/clinic/ClinicAdminKit';
import { Badge, Card, Chips, EmptyState, LoadState, ui, useLoader } from '../../components/clinic/ClinicUi';
import { fetchSlots, formatClockTime, formatDateKey, toBusinessDateKey } from '../../services/booking';
import { clinicClock, DAYS, DentistSchedule, fetchAppointments, fetchDentists, fetchServices, frontDeskStatus, hasCheckedIn, WEEK_ORDER } from '../../services/clinicPortal';
import { palette, radius, spacing } from '../../theme/tokens';
import { addDays } from './ClinicAppointmentsScreen';

// Yesterday, today and the three days ahead, as in the design.
const DAY_OFFSETS = [-1, 0, 1, 2, 3];
const MAX_SLOTS = 8;

const daysLabel = (schedules: DentistSchedule[]) => {
  const order = WEEK_ORDER.filter((day) => schedules.some((s) => s.day_of_week === day));
  if (order.length === 0) return 'Not set';
  const first = WEEK_ORDER.indexOf(order[0]);
  const isRun = order.every((day, index) => WEEK_ORDER.indexOf(day) === first + index);
  const short = (day: number) => DAYS[day].slice(0, 3);
  return isRun && order.length > 1 ? `${short(order[0])} – ${short(order[order.length - 1])}` : order.map(short).join(', ');
};

const hoursLabel = (schedules: DentistSchedule[]) => {
  if (schedules.length === 0) return 'Not set';
  const starts = schedules.map((s) => s.starts_at).sort();
  const ends = schedules.map((s) => s.ends_at).sort();
  return `${formatClockTime(starts[0])} – ${formatClockTime(ends[ends.length - 1])}`;
};

const ClinicDentistScheduleScreen = () => {
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const today = toBusinessDateKey(new Date());
  const [date, setDate] = useState(today);
  const [dentistId, setDentistId] = useState<number | null>(null);

  const staff = useLoader(() => Promise.all([fetchDentists(clinicId), fetchServices(clinicId)]), [clinicId], 'Dentists could not be loaded.');
  const active = (staff.data?.[0] ?? []).filter((d) => d.is_active);
  const dentist = active.find((d) => d.id === dentistId);
  // Open times depend on length, so the shortest service shows every time that could be booked.
  const shortest = (staff.data?.[1] ?? []).filter((s) => s.is_available).sort((a, b) => a.duration_minutes - b.duration_minutes)[0];
  const firstId = active[0]?.id;

  useEffect(() => {
    if (!dentistId && firstId) setDentistId(firstId);
  }, [dentistId, firstId]);

  const day = useLoader(
    async () => (dentistId ? fetchAppointments(clinicId, { from: date, to: date, dentist_id: dentistId, per_page: 100 }) : null),
    [clinicId, date, dentistId],
    'The schedule could not be loaded.',
  );
  const slots = useLoader(
    async () => (dentistId && shortest ? fetchSlots({ clinicId, serviceRateId: shortest.id, dentistId, date }) : []),
    [clinicId, date, dentistId, shortest?.id],
    'Open times could not be loaded.',
  );
  const isToday = date === today;

  return (
    <ClinicScreen title="Dentist Schedule" active="ClinicDentistSchedule">
      <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={day.refreshing} onRefresh={day.refresh} colors={[palette.primary]} />}>
        <Text style={ui.muted}>View-only — cannot be modified by staff</Text>
        <Chips options={DAY_OFFSETS.map((offset) => ({ id: addDays(today, offset), label: formatDateKey(addDays(today, offset), { month: 'short', day: 'numeric' }) }))} value={date} onChange={setDate} />
        {active.length > 1 && <Chips options={active.map((d) => ({ id: d.id, label: d.name }))} value={dentistId ?? 0} onChange={setDentistId} />}
        <LoadState loading={staff.loading} error={staff.data ? null : staff.error} onRetry={staff.reload} />
        {staff.data && active.length === 0 && <EmptyState icon="medkit-outline" text="No active dentists yet." />}

        {dentistId && (
          <Card title={`${formatDateKey(date, { month: 'long', day: 'numeric', year: 'numeric' })} — Schedule`} subtitle={day.data ? `${day.data.meta.total} ${day.data.meta.total === 1 ? 'appointment' : 'appointments'}` : undefined}>
            <LoadState loading={day.loading} error={day.data ? null : day.error} onRetry={day.reload} />
            {day.data?.items.length === 0 && <Text style={ui.muted}>No appointments on this day.</Text>}
            {day.data?.items.map((a) => {
              const status = frontDeskStatus(a.status);
              const [clock, period] = a.starts_at ? formatClockTime(clinicClock(a.starts_at)).split(' ') : ['', ''];
              return (
                <View key={a.id} style={styles.row}>
                  <View style={styles.time}>
                    <Text style={styles.timeText}>{clock}</Text>
                    <Text style={styles.timeText}>{period}</Text>
                  </View>
                  <View style={ui.flex}>
                    <Text style={ui.title}>{a.patient?.name}</Text>
                    <Text style={ui.small}>{a.service?.name}</Text>
                    <View style={ui.rowWrap}>
                      <Badge tone={status.tone} label={status.label} />
                      {hasCheckedIn(a.status) && a.status !== 'completed' ? <Badge tone="info" label="Checked In" /> : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </Card>
        )}

        {dentist && (
          <Card title={`${dentist.name} — Availability`}>
            <StatRow label="Working Days" value={daysLabel(dentist.schedules ?? [])} />
            <StatRow label="Hours" value={hoursLabel(dentist.schedules ?? [])} />
            <StatRow label="Clinic" value={membership?.clinic_name} />
            <StatRow label="Status" value="Active" />
          </Card>
        )}

        {dentistId && (
          <Card title={isToday ? 'Available Slots Today' : `Available Slots — ${formatDateKey(date, { month: 'long', day: 'numeric' })}`}>
            <LoadState loading={slots.loading} error={slots.data ? null : slots.error} onRetry={slots.reload} />
            {slots.data?.length === 0 && <Text style={ui.muted}>No open times on this day.</Text>}
            {slots.data?.slice(0, MAX_SLOTS).map((slot) => (
              <View key={slot.startsAt} style={styles.slot}>
                <Text style={styles.slotTime}>{formatClockTime(slot.time)}</Text>
                <Text style={styles.slotNote}>Available</Text>
              </View>
            ))}
            {(slots.data?.length ?? 0) > 0 && <Text style={ui.small}>Use these slots when scheduling new appointments{isToday ? ' for today' : ''}.</Text>}
          </Card>
        )}
      </ScrollView>
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.xl, borderWidth: 1, borderColor: palette.surfaceContainerHigh, backgroundColor: palette.surface },
  time: { width: 56, alignItems: 'center' },
  timeText: { fontSize: 13, fontWeight: '700', color: palette.primary },
  slot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.primaryFixedDim, backgroundColor: palette.primaryFixed },
  slotTime: { fontSize: 14, fontWeight: '600', color: palette.primary },
  slotNote: { fontSize: 11, color: palette.primary },
});

export default ClinicDentistScheduleScreen;
