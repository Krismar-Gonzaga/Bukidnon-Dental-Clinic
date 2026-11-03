// Dentists & schedules (web: ClinicDentistsPage). Dentists join through
// Staff (role: Dentist); here owners set their profile and weekly hours per
// branch. Bookings are offered only inside these hours and branch hours.
import React, { useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import { ClinicScreen, useOpenSection } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { Badge, Button, Chips, EmptyState, Field, FormError, LoadState, SelectField, Sheet, Toggle, ui, useLoader } from '../../components/clinic/ClinicUi';
import { hoursAreValid, WeeklyHours, WeeklyHoursEditor } from '../../components/clinic/WeeklyHoursEditor';
import {
  can,
  ClinicBranch,
  ClinicDentist,
  DAYS,
  DentistSchedule,
  fetchClinicBranches,
  fetchDentists,
  fetchSpecializationOptions,
  serverMessage,
  updateDentist,
  updateDentistSchedules,
} from '../../services/clinicPortal';
import { formatClockTime } from '../../services/booking';
import { palette } from '../../theme/tokens';

const summarize = (schedules: DentistSchedule[], branches: ClinicBranch[]) =>
  branches
    .map((branch) => {
      const days = schedules.filter((s) => s.branch_id === branch.id).sort((a, b) => a.day_of_week - b.day_of_week);
      if (days.length === 0) return null;
      return `${branch.name}: ${days.map((d) => `${DAYS[d.day_of_week].slice(0, 3)} ${formatClockTime(d.starts_at)}–${formatClockTime(d.ends_at)}`).join(', ')}`;
    })
    .filter(Boolean)
    .join('\n') || 'No schedule — not bookable';

function ProfileSheet({ clinicId, dentist, onClose, onSaved }: { clinicId: number; dentist: ClinicDentist; onClose: () => void; onSaved: () => void }) {
  const specializations = useLoader(() => fetchSpecializationOptions(), []);
  const [specializationId, setSpecializationId] = useState<number>(dentist.specialization_id ?? 0);
  const [form, setForm] = useState({
    license_number: dentist.license_number ?? '',
    years_experience: String(dentist.years_experience ?? 0),
    qualifications: dentist.qualifications ?? '',
    bio: dentist.bio ?? '',
  });
  const [active, setActive] = useState(dentist.is_active);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bind = (name: keyof typeof form) => ({ value: form[name], onChangeText: (v: string) => setForm((f) => ({ ...f, [name]: v })) });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateDentist(clinicId, dentist.id, {
        ...form,
        specialization_id: specializationId || null,
        years_experience: Number(form.years_experience) || 0,
        is_active: active,
      });
      onSaved();
    } catch (err) {
      setError(serverMessage(err, 'The profile could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={`Profile — ${dentist.name}`} onClose={onClose}>
      <SelectField
        label="Specialization"
        value={specializationId}
        onChange={setSpecializationId}
        options={[{ id: 0, label: 'General' }, ...(specializations.data ?? []).map((s) => ({ id: s.id, label: s.name }))]}
      />
      <Field label="PRC license number" {...bind('license_number')} />
      <Field label="Years of experience" keyboardType="number-pad" {...bind('years_experience')} />
      <Field label="Qualifications" multiline {...bind('qualifications')} />
      <Field label="Public bio" multiline {...bind('bio')} />
      <Toggle label="Accepting bookings" value={active} onChange={setActive} />
      <FormError message={error} />
      <Button label="Save profile" style={ui.spacedTop} busy={busy} onPress={save} />
    </Sheet>
  );
}

function ScheduleSheet({ clinicId, dentist, branches, onClose, onSaved }: { clinicId: number; dentist: ClinicDentist; branches: ClinicBranch[]; onClose: () => void; onSaved: () => void }) {
  const [branchId, setBranchId] = useState<number>(branches[0]?.id ?? 0);
  const [byBranch, setByBranch] = useState<Record<number, WeeklyHours>>(() => {
    const initial: Record<number, WeeklyHours> = {};
    (dentist.schedules ?? []).forEach((s) => {
      initial[s.branch_id] = { ...(initial[s.branch_id] ?? {}), [s.day_of_week]: { start: s.starts_at, end: s.ends_at } };
    });
    return initial;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = Object.values(byBranch).every(hoursAreValid);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateDentistSchedules(
        clinicId,
        dentist.id,
        Object.entries(byBranch).flatMap(([branch, days]) =>
          Object.entries(days).map(([day, h]) => ({ branch_id: Number(branch), day_of_week: Number(day), starts_at: h.start, ends_at: h.end })),
        ),
      );
      onSaved();
    } catch (err) {
      setError(serverMessage(err, 'The schedule could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={`Weekly schedule — ${dentist.name}`} onClose={onClose}>
      {branches.length > 1 && <Chips options={branches.map((b) => ({ id: b.id, label: b.name }))} value={branchId} onChange={setBranchId} />}
      <Text style={ui.small}>Bookings are offered only inside both these hours and the branch's opening hours.</Text>
      <WeeklyHoursEditor value={byBranch[branchId] ?? {}} onChange={(days) => setByBranch((current) => ({ ...current, [branchId]: days }))} />
      <FormError message={error} />
      <Button label="Save schedule" style={ui.spacedTop} busy={busy} disabled={!valid} onPress={save} />
    </Sheet>
  );
}

const ClinicDentistsScreen = () => {
  const { membership } = useClinicPortal();
  const open = useOpenSection('ClinicDentists');
  const clinicId = membership?.clinic_id ?? 0;
  const data = useLoader(() => Promise.all([fetchDentists(clinicId), fetchClinicBranches(clinicId)]), [clinicId], 'Dentists could not be loaded.');
  const [sheet, setSheet] = useState<{ type: 'profile' | 'schedule'; dentist: ClinicDentist } | null>(null);
  const [dentists, branches] = data.data ?? [[], []];

  return (
    <ClinicScreen title="Dentists & Schedules" active="ClinicDentists">
      <FlatList
        data={dentists}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={data.refresh} colors={[palette.primary]} />}
        ListHeaderComponent={
          <View style={ui.stack}>
            <View style={ui.between}>
              <View style={ui.flex}>
                <Text style={ui.heading}>Dentists</Text>
                <Text style={ui.muted}>Dentists join through Staff (role: Dentist). Set their profile and weekly hours here.</Text>
              </View>
              {can(membership, 'clinic.staff.manage') && <Button small variant="tonal" icon="person-add-outline" label="Add" onPress={() => open('ClinicStaff')} />}
            </View>
            <LoadState loading={data.loading} error={data.data ? null : data.error} onRetry={data.reload} />
          </View>
        }
        ListEmptyComponent={data.loading || data.error ? undefined : <EmptyState icon="medkit-outline" text="No dentists yet." />}
        renderItem={({ item: d }) => (
          <View style={ui.listItem}>
            <View style={ui.between}>
              <Text style={[ui.title, ui.flex]}>{d.name}</Text>
              <Badge tone={d.is_active ? 'success' : 'neutral'} label={d.is_active ? 'Accepting bookings' : 'Inactive'} />
            </View>
            <Text style={ui.muted}>
              {d.specialization ?? 'General'} · {d.years_experience ?? 0} yrs{d.license_number ? ` · PRC ${d.license_number}` : ''}
            </Text>
            <Text style={ui.small}>{summarize(d.schedules ?? [], branches)}</Text>
            <View style={ui.rowWrap}>
              {can(membership, 'clinic.dentists.manage') && <Button small variant="outline" label="Edit profile" onPress={() => setSheet({ type: 'profile', dentist: d })} />}
              {can(membership, 'clinic.schedules.manage') && (
                <Button small variant="outline" label="Edit schedule" disabled={branches.length === 0} onPress={() => setSheet({ type: 'schedule', dentist: d })} />
              )}
            </View>
          </View>
        )}
      />
      {sheet?.type === 'profile' && (
        <ProfileSheet clinicId={clinicId} dentist={sheet.dentist} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); data.sync(); }} />
      )}
      {sheet?.type === 'schedule' && (
        <ScheduleSheet clinicId={clinicId} dentist={sheet.dentist} branches={branches} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); data.sync(); }} />
      )}
    </ClinicScreen>
  );
};

export default ClinicDentistsScreen;
