// Branches & hours (web: ClinicBranchesPage): branches, opening hours per
// branch, clinic holidays and blocked time (leave, meetings, downtime).
import React, { useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { Badge, Button, Card, EmptyState, Field, FormError, LoadState, SelectField, Sheet, Toggle, ui, useLoader } from '../../components/clinic/ClinicUi';
import { ClinicProfileTabs, NoteBox } from '../../components/clinic/ClinicAdminKit';
import { DateField } from '../../components/clinic/DateField';
import { hoursAreValid, WeeklyHours, WeeklyHoursEditor } from '../../components/clinic/WeeklyHoursEditor';
import {
  can,
  ClinicBranch,
  createBranch,
  createHoliday,
  createScheduleBlock,
  DAYS,
  deleteHoliday,
  deleteScheduleBlock,
  fetchClinicBranches,
  fetchDentists,
  fetchHolidays,
  fetchScheduleBlocks,
  formatDateTime,
  OperatingHour,
  removeBranch,
  serverMessage,
  toClinicIso,
  updateBranch,
  updateBranchHours,
  WEEK_ORDER,
} from '../../services/clinicPortal';
import { formatClockTime, formatDateKey } from '../../services/booking';
import { palette, radius } from '../../theme/tokens';

const summarizeHours = (hours: OperatingHour[] = []) =>
  WEEK_ORDER.map((day) => hours.find((h) => h.day_of_week === day))
    .filter((h): h is OperatingHour => Boolean(h))
    .map((h) => `${DAYS[h.day_of_week].slice(0, 3)} ${formatClockTime(h.opens_at)}–${formatClockTime(h.closes_at)}`)
    .join(', ');

const toNumberOrNull = (v: string) => (v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v));

function BranchSheet({ clinicId, branch, onClose, onSaved }: { clinicId: number; branch: ClinicBranch | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: branch?.name ?? '',
    contact_number: branch?.contact_number ?? '',
    address: branch?.address ?? '',
    city: branch?.city ?? '',
    latitude: branch?.latitude != null ? String(branch.latitude) : '',
    longitude: branch?.longitude != null ? String(branch.longitude) : '',
  });
  const [active, setActive] = useState(branch?.is_active ?? true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bind = (name: keyof typeof form) => ({ value: form[name], onChangeText: (v: string) => setForm((f) => ({ ...f, [name]: v })) });

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = { ...form, latitude: toNumberOrNull(form.latitude), longitude: toNumberOrNull(form.longitude), is_active: active };
    try {
      if (branch) await updateBranch(clinicId, branch.id, body);
      else await createBranch(clinicId, body);
      onSaved();
    } catch (err) {
      setError(serverMessage(err, 'The branch could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={branch ? `Edit ${branch.name}` : 'Add branch'} onClose={onClose}>
      <Field label="Name" required {...bind('name')} />
      <Field label="Contact number" keyboardType="phone-pad" {...bind('contact_number')} />
      <Field label="Street address" required {...bind('address')} />
      <Field label="City / municipality" required {...bind('city')} />
      <Field label="Latitude" keyboardType="numbers-and-punctuation" hint="For the map, e.g. 8.1575" {...bind('latitude')} />
      <Field label="Longitude" keyboardType="numbers-and-punctuation" hint="e.g. 125.1278" {...bind('longitude')} />
      <Toggle label="Open for bookings" value={active} onChange={setActive} />
      <FormError message={error} />
      <Button label="Save" style={ui.spacedTop} busy={busy} disabled={!form.name.trim() || !form.address.trim() || !form.city.trim()} onPress={save} />
    </Sheet>
  );
}

function HoursSheet({ clinicId, branch, onClose, onSaved }: { clinicId: number; branch: ClinicBranch; onClose: () => void; onSaved: () => void }) {
  const [hours, setHours] = useState<WeeklyHours>(() =>
    Object.fromEntries((branch.operating_hours ?? []).map((h) => [h.day_of_week, { start: h.opens_at, end: h.closes_at }])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateBranchHours(clinicId, branch.id, Object.entries(hours).map(([day, h]) => ({ day_of_week: Number(day), opens_at: h.start, closes_at: h.end })));
      onSaved();
    } catch (err) {
      setError(serverMessage(err, 'The hours could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={`Opening hours — ${branch.name}`} onClose={onClose}>
      <WeeklyHoursEditor value={hours} onChange={setHours} />
      <FormError message={error} />
      <Button label="Save hours" style={ui.spacedTop} busy={busy} disabled={!hoursAreValid(hours)} onPress={save} />
    </Sheet>
  );
}

function ClosedDates({ clinicId, canManage }: { clinicId: number; canManage: boolean }) {
  const data = useLoader(
    () => Promise.all([fetchHolidays(clinicId), fetchScheduleBlocks(clinicId), fetchDentists(clinicId)]),
    [clinicId],
    'Holidays and blocked time could not be loaded.',
  );
  const [holidays, blocks, dentists] = data.data ?? [[], [], []];
  const [holiday, setHoliday] = useState({ date: '', name: '' });
  const [block, setBlock] = useState({ fromDate: '', fromTime: '08:00', toDate: '', toTime: '17:00', dentistId: 0, reason: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<{ holiday?: string; block?: string }>({});

  const run = async (key: string, action: () => Promise<unknown>, after?: () => void) => {
    setBusy(key);
    setError({});
    try {
      await action();
      after?.();
      await data.sync();
    } catch (err) {
      const message = serverMessage(err, 'That could not be saved.');
      if (key === 'holiday' || key === 'block') setError({ [key]: message });
      else Alert.alert('Not removed', message);
    } finally {
      setBusy(null);
    }
  };

  const confirmRemove = (title: string, key: string, action: () => Promise<unknown>) =>
    Alert.alert(title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => run(key, action) },
    ]);

  const blockStarts = block.fromDate ? toClinicIso(block.fromDate, block.fromTime) : '';
  const blockEnds = block.toDate ? toClinicIso(block.toDate, block.toTime) : '';

  return (
    <>
      <Card title="Holidays" subtitle="No bookings on these dates (all branches).">
        <LoadState loading={data.loading} error={data.error} onRetry={data.reload} />
        {data.data && holidays.length === 0 && <Text style={ui.muted}>No holidays set.</Text>}
        {holidays.map((h) => (
          <View key={h.id} style={[ui.between, ui.stackItem]}>
            <View style={ui.flex}>
              <Text style={ui.title}>{h.name}</Text>
              <Text style={ui.small}>{formatDateKey(h.date, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</Text>
            </View>
            {canManage && <Button small variant="outline" label="Remove" busy={busy === `h${h.id}`} onPress={() => confirmRemove(`Remove ${h.name}?`, `h${h.id}`, () => deleteHoliday(clinicId, h.id))} />}
          </View>
        ))}
        {canManage && (
          <>
            <DateField label="Date" required value={holiday.date} onChange={(date) => setHoliday((s) => ({ ...s, date }))} />
            <Field label="Name" required value={holiday.name} onChangeText={(name) => setHoliday((s) => ({ ...s, name }))} />
            <FormError message={error.holiday} />
            <Button
              label="Add holiday"
              variant="tonal"
              style={ui.spacedTop}
              busy={busy === 'holiday'}
              disabled={!holiday.date || !holiday.name.trim()}
              onPress={() => run('holiday', () => createHoliday(clinicId, { date: holiday.date, name: holiday.name.trim() }), () => setHoliday({ date: '', name: '' }))}
            />
          </>
        )}
      </Card>

      <Card title="Blocked time" subtitle="Leave, meetings or equipment downtime. Existing appointments are not moved.">
        {data.data && blocks.length === 0 && <Text style={ui.muted}>No blocked time.</Text>}
        {blocks.map((b) => (
          <View key={b.id} style={[ui.between, ui.stackItem]}>
            <View style={ui.flex}>
              <Text style={ui.title}>{b.dentist_id ? dentists.find((d) => d.id === b.dentist_id)?.name ?? 'Dentist' : 'Whole clinic'}</Text>
              <Text style={ui.small}>
                {formatDateTime(b.starts_at)} – {formatDateTime(b.ends_at)}
              </Text>
              {b.reason ? <Text style={ui.muted}>{b.reason}</Text> : null}
            </View>
            {canManage && <Button small variant="outline" label="Remove" busy={busy === `b${b.id}`} onPress={() => confirmRemove('Remove this block?', `b${b.id}`, () => deleteScheduleBlock(clinicId, b.id))} />}
          </View>
        ))}
        {canManage && (
          <>
            <DateField label="From date" required value={block.fromDate} onChange={(fromDate) => setBlock((s) => ({ ...s, fromDate, toDate: s.toDate || fromDate }))} />
            <DateField label="From time" mode="time" value={block.fromTime} onChange={(fromTime) => fromTime && setBlock((s) => ({ ...s, fromTime }))} />
            <DateField label="To date" required value={block.toDate} onChange={(toDate) => setBlock((s) => ({ ...s, toDate }))} />
            <DateField label="To time" mode="time" value={block.toTime} onChange={(toTime) => toTime && setBlock((s) => ({ ...s, toTime }))} />
            <SelectField
              label="Dentist"
              value={block.dentistId}
              onChange={(dentistId) => setBlock((s) => ({ ...s, dentistId }))}
              options={[{ id: 0, label: 'Whole clinic' }, ...dentists.map((d) => ({ id: d.id, label: d.name }))]}
            />
            <Field label="Reason" value={block.reason} onChangeText={(reason) => setBlock((s) => ({ ...s, reason }))} />
            {blockStarts && blockEnds && blockEnds <= blockStarts ? <FormError message="The end must be after the start." /> : null}
            <FormError message={error.block} />
            <Button
              label="Block time"
              variant="tonal"
              style={ui.spacedTop}
              busy={busy === 'block'}
              disabled={!blockStarts || !blockEnds || blockEnds <= blockStarts}
              onPress={() =>
                run(
                  'block',
                  () => createScheduleBlock(clinicId, { starts_at: blockStarts, ends_at: blockEnds, dentist_id: block.dentistId || null, reason: block.reason.trim() || null }),
                  () => setBlock({ fromDate: '', fromTime: '08:00', toDate: '', toTime: '17:00', dentistId: 0, reason: '' }),
                )
              }
            />
          </>
        )}
      </Card>
    </>
  );
}

type Props = { route?: { params?: { new?: boolean; branchId?: number } } };

const ClinicBranchesScreen = ({ route }: Props) => {
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const canBranches = can(membership, 'clinic.branches.manage');
  const canSchedules = can(membership, 'clinic.schedules.manage');
  const branches = useLoader(() => fetchClinicBranches(clinicId), [clinicId], 'Branches could not be loaded.');
  const focusId = route?.params?.branchId;
  // "Add New Branch" from the drawer opens the form straight away.
  const [removing, setRemoving] = useState<ClinicBranch | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ type: 'branch' | 'hours'; branch: ClinicBranch | null } | null>(() =>
    route?.params?.new && canBranches ? { type: 'branch', branch: null } : null,
  );
  const done = () => {
    setSheet(null);
    branches.sync();
  };
  const confirmRemove = async () => {
    if (!removing) return;
    setRemoveBusy(true);
    setRemoveError(null);
    try {
      await removeBranch(clinicId, removing.id);
      setRemoving(null);
      branches.sync();
    } catch (err) {
      setRemoveError(serverMessage(err, 'The branch could not be removed.'));
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <ClinicScreen title="Clinic Profile" active="ClinicBranches">
      <ScrollView
        contentContainerStyle={ui.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={branches.refreshing} onRefresh={branches.refresh} colors={[palette.primary]} />}
      >
        <ClinicProfileTabs active="ClinicBranches" />
        <Card
          title="Branches"
          subtitle={branches.data ? `${branches.data.length} ${branches.data.length === 1 ? 'branch' : 'branches'} registered under this account.` : undefined}
          action={canBranches ? <Button small variant="tonal" icon="add" label="Add branch" onPress={() => setSheet({ type: 'branch', branch: null })} /> : undefined}
        >
          <LoadState loading={branches.loading} error={branches.data ? null : branches.error} onRetry={branches.reload} />
          {branches.data && branches.data.length === 0 && <EmptyState icon="business-outline" text="No branches yet." />}
          {(branches.data ?? []).map((b) => (
            <View key={b.id} style={[ui.listItem, b.id === focusId && styles.focus]}>
              <View style={ui.between}>
                <Text style={[ui.title, ui.flex]}>{b.name}</Text>
                {b.is_main ? <Badge tone="info" label="Main Branch" /> : null}
                {!b.is_active ? <Badge tone="neutral" label="Inactive" /> : null}
              </View>
              <Text style={ui.muted}>
                {b.address}, {b.city}
              </Text>
              {b.contact_number ? <Text style={ui.small}>{b.contact_number}</Text> : null}
              <Text style={ui.small}>{summarizeHours(b.operating_hours) || 'Closed — no opening hours set'}</Text>
              <View style={ui.rowWrap}>
                {canBranches && <Button small variant="outline" icon="create-outline" label="Edit" onPress={() => setSheet({ type: 'branch', branch: b })} />}
                {canSchedules && <Button small variant="outline" icon="time-outline" label="Hours" onPress={() => setSheet({ type: 'hours', branch: b })} />}
                {canBranches && !b.is_main && (
                  <Button
                    small
                    variant="danger"
                    icon="trash-outline"
                    label="Remove"
                    onPress={() => {
                      setRemoveError(null);
                      setRemoving(b);
                    }}
                  />
                )}
              </View>
            </View>
          ))}
        </Card>

        <ClosedDates clinicId={clinicId} canManage={canSchedules} />
      </ScrollView>

      {removing && (
        <Sheet title={`Remove ${removing.name}?`} onClose={() => setRemoving(null)}>
          <NoteBox>Patients can no longer book at this branch. A branch with upcoming appointments cannot be removed.</NoteBox>
          <FormError message={removeError} />
          <Button label="Remove" variant="danger" style={ui.spacedTop} busy={removeBusy} onPress={confirmRemove} />
        </Sheet>
      )}
      {sheet?.type === 'branch' && <BranchSheet clinicId={clinicId} branch={sheet.branch} onClose={() => setSheet(null)} onSaved={done} />}
      {sheet?.type === 'hours' && sheet.branch && <HoursSheet clinicId={clinicId} branch={sheet.branch} onClose={() => setSheet(null)} onSaved={done} />}
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  focus: { borderColor: palette.primary, borderWidth: 2, borderRadius: radius.xl },
});

export default ClinicBranchesScreen;
