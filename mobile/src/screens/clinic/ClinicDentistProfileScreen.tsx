// One dentist (web: ClinicDentistProfilePage): details, stats, the working week
// and recent appointments, with edit, schedule and deactivate.
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { InitialsTile, StatRow } from '../../components/clinic/ClinicAdminKit';
import { Badge, Button, Card, EmptyState, FormError, LoadState, Sheet, ui, useLoader } from '../../components/clinic/ClinicUi';
import ScheduleApprovals from '../../components/clinic/ScheduleApprovals';
import { ProfileSheet, ScheduleSheet } from './ClinicDentistsScreen';
import { formatClockTime } from '../../services/booking';
import { can, DentistSchedule, fetchClinicBranches, fetchDentist, formatDateTime, serverMessage, updateDentist } from '../../services/clinicPortal';
import { palette, radius, spacing } from '../../theme/tokens';

const WEEK = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
];

// Earliest start to latest end across the week.
const hoursLabel = (schedules: DentistSchedule[]) => {
  if (schedules.length === 0) return 'No hours set';
  const starts = schedules.map((s) => s.starts_at).sort();
  const ends = schedules.map((s) => s.ends_at).sort();
  return `${formatClockTime(starts[0])} – ${formatClockTime(ends[ends.length - 1])}`;
};

const ClinicDentistProfileScreen = ({ route }: { route: { params: { dentistId: number } } }) => {
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const { dentistId } = route.params;
  const data = useLoader(() => Promise.all([fetchDentist(clinicId, dentistId), fetchClinicBranches(clinicId)]), [clinicId, dentistId], 'This dentist could not be loaded.');
  const [sheet, setSheet] = useState<'profile' | 'schedule' | 'toggle' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dentist = data.data?.[0];
  const branches = data.data?.[1] ?? [];
  const schedules = dentist?.schedules ?? [];

  const done = () => {
    setSheet(null);
    data.sync();
  };

  const toggle = async () => {
    if (!dentist) return;
    setBusy(true);
    setError(null);
    try {
      await updateDentist(clinicId, dentist.id, { is_active: !dentist.is_active });
      done();
    } catch (err) {
      setError(serverMessage(err, 'The change could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ClinicScreen title={dentist?.name ?? 'Dentist'} active="ClinicDentists" back>
      <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={data.refresh} colors={[palette.primary]} />}>
        <LoadState loading={data.loading} error={dentist ? null : data.error} onRetry={data.reload} />
        {dentist && (
          <>
            <Card>
              <View style={styles.identity}>
                <InitialsTile name={dentist.name} large />
                <Text style={ui.heading}>{dentist.name}</Text>
                <Text style={ui.muted}>{dentist.specialization ?? 'General Dentist'}</Text>
                <Badge tone={dentist.is_active ? 'success' : 'neutral'} label={dentist.is_active ? 'Active' : 'Inactive'} />
              </View>
              {dentist.email ? <StatRow label="Email" value={dentist.email} /> : null}
              {dentist.phone ? <StatRow label="Phone" value={dentist.phone} /> : null}
              <StatRow label="Hours" value={hoursLabel(schedules)} />
              {dentist.qualifications ? <StatRow label="Education" value={dentist.qualifications} /> : null}
              {can(membership, 'clinic.dentists.manage') && (
                <View style={ui.rowWrap}>
                  <Button small icon="create-outline" label="Edit Profile" onPress={() => setSheet('profile')} />
                  <Button small variant={dentist.is_active ? 'danger' : 'outline'} label={dentist.is_active ? 'Deactivate' : 'Activate'} onPress={() => setSheet('toggle')} />
                </View>
              )}
            </Card>

            <Card title="Stats">
              <StatRow label="Today's Appointments" value={dentist.appointments_today} />
              <StatRow label="Total Appointments" value={dentist.appointments_total} />
              <StatRow label="Experience" value={`${dentist.years_experience ?? 0} yrs`} />
              <StatRow label="Joined" value={dentist.joined_at ? formatDateTime(dentist.joined_at).split(',').slice(0, 2).join(',') : null} />
            </Card>

            {can(membership, 'clinic.schedules.manage') && <ScheduleApprovals clinicId={clinicId} dentistId={dentist.id} onDecided={data.sync} />}

            <Card
              title="Weekly Schedule"
              subtitle={`Hours: ${hoursLabel(schedules)}`}
              action={can(membership, 'clinic.schedules.manage') ? <Button small variant="outline" label="Edit" disabled={branches.length === 0} onPress={() => setSheet('schedule')} /> : undefined}
            >
              <View style={styles.week}>
                {WEEK.map(({ day, label }) => {
                  const working = schedules.some((s) => s.day_of_week === day);
                  return (
                    <View key={day} style={[styles.day, working && styles.dayOn]} accessible accessibilityLabel={`${label}: ${working ? 'working' : 'off'}`}>
                      <Text style={[styles.dayName, working && styles.dayTextOn]}>{label}</Text>
                      <Text style={[styles.dayState, working && styles.dayTextOn]}>{working ? 'Working' : 'Off'}</Text>
                    </View>
                  );
                })}
              </View>
            </Card>

            <Card title="Assigned Appointments" subtitle={`${dentist.appointments_total ?? 0} total`}>
              {dentist.appointments.length === 0 && <EmptyState icon="calendar-outline" text="No appointments yet." />}
              {dentist.appointments.map((a) => (
                <View key={a.id} style={ui.listItem}>
                  <View style={ui.between}>
                    <Text style={[ui.title, ui.flex]}>{a.patient}</Text>
                    <Badge status={a.status} />
                  </View>
                  <Text style={ui.muted}>{a.service}</Text>
                  <Text style={ui.small}>{formatDateTime(a.starts_at)}</Text>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>

      {sheet === 'profile' && dentist && <ProfileSheet clinicId={clinicId} dentist={dentist} onClose={() => setSheet(null)} onSaved={done} />}
      {sheet === 'schedule' && dentist && <ScheduleSheet clinicId={clinicId} dentist={dentist} branches={branches} onClose={() => setSheet(null)} onSaved={done} />}
      {sheet === 'toggle' && dentist && (
        <Sheet title={`${dentist.is_active ? 'Deactivate' : 'Activate'} ${dentist.name}?`} onClose={() => setSheet(null)}>
          <Text style={ui.muted}>
            {dentist.is_active ? 'Patients will no longer be able to book with this dentist. Existing appointments stay as they are.' : 'Patients will be able to book with this dentist again.'}
          </Text>
          <FormError message={error} />
          <Button label={dentist.is_active ? 'Deactivate' : 'Activate'} variant={dentist.is_active ? 'danger' : 'primary'} style={ui.spacedTop} busy={busy} onPress={toggle} />
        </Sheet>
      )}
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  identity: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  week: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.base },
  day: { width: '22%', flexGrow: 1, paddingVertical: spacing.sm, borderRadius: radius.xl, backgroundColor: palette.surfaceContainerLow, alignItems: 'center' },
  dayOn: { backgroundColor: palette.primary },
  dayName: { fontSize: 13, fontWeight: '700', color: palette.outline },
  dayState: { fontSize: 11, color: palette.outline },
  dayTextOn: { color: palette.onPrimary },
});

export default ClinicDentistProfileScreen;
