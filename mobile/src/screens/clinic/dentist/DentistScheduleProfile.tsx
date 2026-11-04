// My Schedule and My Profile (web: DentistSchedulePage, DentistProfilePage).
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AccountSecurity } from '../../../components/AccountSecurity';
import { ClinicScreen } from '../../../components/clinic/ClinicChrome';
import { DateField } from '../../../components/clinic/DateField';
import { useClinicPortal } from '../../../components/clinic/ClinicPortalContext';
import { DetailTile, NoteBox, StatRow } from '../../../components/clinic/ClinicAdminKit';
import { Badge, Button, Card, Chips, Field, FormError, InfoRow, LoadState, SelectField, Sheet, ui, useLoader, useRefreshOnFocus } from '../../../components/clinic/ClinicUi';
import { useAuth } from '../../../context/AuthContext';
import { formatClockTime } from '../../../services/booking';
import { DAYS, formatDateTime, serverMessage, WEEK_ORDER } from '../../../services/clinicPortal';
import { cancelScheduleChange, DentistProfileData, DentistScheduleData, fetchDentistProfile, fetchDentistSchedule, requestScheduleChange, ScheduleChangeSummary, submitScheduleChange, updateDentistProfile } from '../../../services/dentistPortal';
import { palette, radius, spacing } from '../../../theme/tokens';
import { PasswordForm } from '../ClinicAccountScreen';
import { monthDay, PatientLine, timeOf, weekdayOf } from './dentistKit';

const TIME_PATTERN = /^\d{2}:\d{2}$/;
const firstName = (name = '') => name.split(' ')[0];

function DayButtons({ days, onToggle }: { days: number[]; onToggle?: (day: number) => void }) {
  return (
    <View style={styles.days}>
      {WEEK_ORDER.map((day) => {
        const isOn = days.includes(day);
        const label = DAYS[day].slice(0, 3);
        return onToggle ? (
          <TouchableOpacity key={day} style={[styles.day, isOn && styles.dayOn]} onPress={() => onToggle(day)} accessibilityRole="checkbox" accessibilityState={{ checked: isOn }} accessibilityLabel={DAYS[day]}>
            <Text style={[styles.dayText, isOn && styles.dayTextOn]}>{label}</Text>
          </TouchableOpacity>
        ) : (
          <View key={day} style={[styles.day, isOn && styles.dayOn]} accessibilityLabel={`${DAYS[day]}: ${isOn ? 'working' : 'off'}`}>
            <Text style={[styles.dayText, isOn && styles.dayTextOn]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const dayNames = (days: number[]) => WEEK_ORDER.filter((day) => days.includes(day)).map((day) => DAYS[day].slice(0, 3)).join(', ') || 'No working days';
const changeSummary = (change: ScheduleChangeSummary) => `${change.branch ? `${change.branch}: ` : ''}${dayNames(change.days)} · ${formatClockTime(change.starts_at)} – ${formatClockTime(change.ends_at)}`;

function EditHoursSheet({ clinicId, schedule, onClose, onSaved }: { clinicId: number; schedule: DentistScheduleData; onClose: () => void; onSaved: () => void }) {
  // Hours are per branch: the form edits one branch, not the merged week shown on the screen.
  const branches = schedule.branches ?? [];
  const first = branches.find((branch) => branch.days.length > 0) ?? branches[0];
  const [branchId, setBranchId] = useState<number | null>(first?.id ?? null);
  const [days, setDays] = useState<number[]>(first?.days ?? schedule.days);
  const [start, setStart] = useState(first?.starts_at ?? '08:00');
  const [end, setEnd] = useState(first?.ends_at ?? '17:00');
  const [note, setNote] = useState('');

  const chooseBranch = (id: number) => {
    const branch = branches.find((item) => item.id === id);
    setBranchId(id);
    setDays(branch?.days ?? []);
    setStart(branch?.starts_at ?? '08:00');
    setEnd(branch?.ends_at ?? '17:00');
  };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await submitScheduleChange(clinicId, { days, starts_at: start, ends_at: end, note: note.trim() || undefined, branch_id: branchId ?? undefined });
      onSaved();
    } catch (err) {
      setError(serverMessage(err, 'Your change could not be sent.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Edit Schedule" onClose={onClose}>
      {branches.length > 1 && <SelectField<number> label="Branch" options={branches.map(({ id, name }) => ({ id, label: name }))} value={branchId} onChange={chooseBranch} />}
      <DayButtons days={days} onToggle={(day) => setDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]))} />
      <DateField mode="time" label="Start Time" required value={start} onChange={setStart} />
      <DateField mode="time" label="End Time" required value={end} onChange={setEnd} />
      <Field label="Note to your administrator" multiline maxLength={500} value={note} onChangeText={setNote} />
      <Text style={ui.small}>Your clinic administrator approves changes before patients can book the new hours.</Text>
      <FormError message={error} />
      <Button label="Submit for Approval" style={ui.spacedTop} busy={busy} disabled={!TIME_PATTERN.test(start) || !TIME_PATTERN.test(end)} onPress={save} />
    </Sheet>
  );
}

export const DentistScheduleScreen = () => {
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const schedule = useLoader(() => fetchDentistSchedule(clinicId), [clinicId], 'Your schedule could not be loaded.');
  useRefreshOnFocus(schedule.sync);
  const [isEditing, setIsEditing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const data = schedule.data;
  const hours = data?.starts_at ? `${formatClockTime(data.starts_at)} – ${formatClockTime(data.ends_at ?? '')}` : 'Not set';
  const week = data?.week.filter((day) => day.appointments.length > 0 || data.days.includes(weekdayOf(day.date))) ?? [];

  const cancelChange = async () => {
    if (!data?.pending_change) return;
    setIsCancelling(true);
    setCancelError(null);
    try {
      await cancelScheduleChange(clinicId, data.pending_change.id);
      schedule.sync();
    } catch (err) {
      setCancelError(serverMessage(err, 'The request could not be cancelled.'));
    } finally {
      setIsCancelling(false);
    }
  };

  const send = async () => {
    setBusy(true);
    setError(null);
    setSent(false);
    try {
      await requestScheduleChange(clinicId, message.trim());
      setMessage('');
      setSent(true);
    } catch (err) {
      setError(serverMessage(err, 'Your request could not be sent.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ClinicScreen title="My Schedule" active="ClinicMySchedule">
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={schedule.refreshing} onRefresh={schedule.refresh} />}>
        <LoadState loading={schedule.loading} error={schedule.error} onRetry={schedule.reload} />
        {data && (
          <>
            <Card title="Working Days & Hours" action={data.pending_change ? undefined : <Button small icon="pencil-outline" label="Edit" onPress={() => setIsEditing(true)} />}>
              <DayButtons days={data.days} />
              <DetailTile label="Start Time" value={data.starts_at ? formatClockTime(data.starts_at) : 'Not set'} />
              <DetailTile label="End Time" value={data.ends_at ? formatClockTime(data.ends_at) : 'Not set'} />
              {(data.branches ?? []).length > 1 &&
                data.branches.map((branch) => (
                  <StatRow
                    key={branch.id}
                    label={branch.name}
                    value={branch.days.length > 0 && branch.starts_at && branch.ends_at ? `${dayNames(branch.days)} · ${formatClockTime(branch.starts_at)} – ${formatClockTime(branch.ends_at)}` : 'No hours here'}
                  />
                ))}
              {data.pending_change && (
                <>
                  <NoteBox title="Waiting for approval">
                    {changeSummary(data.pending_change)}
                    {`\nSent ${formatDateTime(data.pending_change.created_at)}. Your current hours stay in effect until your clinic administrator approves.`}
                  </NoteBox>
                  <FormError message={cancelError} />
                  <Button small variant="outline" label="Cancel Request" busy={isCancelling} onPress={cancelChange} />
                </>
              )}
              {!data.pending_change && data.last_decision?.status === 'rejected' && (
                <NoteBox tone="danger" title="Your last change was not approved">
                  {`${changeSummary(data.last_decision)}\nReason: ${data.last_decision.review_note}`}
                </NoteBox>
              )}
            </Card>

            <Card title="This Week">
              {week.length === 0 ? (
                <Text style={ui.muted}>No working days or visits this week.</Text>
              ) : (
                week.map((day) => (
                  <View key={day.date} style={styles.weekRow}>
                    <View style={ui.between}>
                      <Text style={styles.weekDate}>{monthDay(day.date)}</Text>
                      <Text style={ui.small}>{day.appointments.length === 1 ? '1 appt' : `${day.appointments.length} appts`}</Text>
                    </View>
                    <View style={styles.chips}>
                      {day.appointments.length === 0 ? (
                        <Text style={ui.small}>No appointments</Text>
                      ) : (
                        day.appointments.map((a) => (
                          <TouchableOpacity key={a.id} style={styles.chip} onPress={() => navigation.navigate('ClinicAppointmentDetail', { appointmentId: a.id })} accessibilityRole="button">
                            <Text style={styles.chipText}>{timeOf(a.starts_at)} — {firstName(a.patient)}</Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                  </View>
                ))
              )}
            </Card>

            <Card title="Availability Summary">
              <StatRow label="Working days" value={`${data.summary.working_days} days/week`} />
              <StatRow label="Daily hours" value={hours} />
              <StatRow label="Max daily slots" value={`${data.summary.max_daily_slots} slots`} />
              <StatRow label="Clinic" value={data.summary.clinic} />
              <StatRow label="Status" value={data.summary.status === 'active' ? 'Active' : 'Inactive'} />
            </Card>

            <Card title="Request Schedule Change" subtitle="Need to update your availability? Send a request to the clinic administrator.">
              <Field label="Your request" required multiline maxLength={1000} placeholder="Describe your schedule change request…" value={message} onChangeText={(text) => { setMessage(text); setSent(false); }} />
              <FormError message={error} />
              {sent && <NoteBox tone="info">Request sent to the clinic administrator.</NoteBox>}
              <Button label="Send Request" style={ui.spacedTop} busy={busy} disabled={!message.trim()} onPress={send} />
            </Card>
          </>
        )}
      </ScrollView>
      {isEditing && data && (
        <EditHoursSheet
          clinicId={clinicId}
          schedule={data}
          onClose={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            schedule.sync();
          }}
        />
      )}
    </ClinicScreen>
  );
};

type ProfileTab = 'profile' | 'license' | 'availability' | 'security';
const TABS: { id: ProfileTab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'license', label: 'License & Credentials' },
  { id: 'availability', label: 'Availability' },
  { id: 'security', label: 'Security' },
];

function EditProfileSheet({ clinicId, profile, onClose, onSaved }: { clinicId: number; profile: DentistProfileData; onClose: () => void; onSaved: () => void }) {
  const { updateUser } = useAuth();
  const [form, setForm] = useState({
    name: profile.name ?? '',
    phone: profile.phone ?? '',
    address: profile.address ?? '',
    website: profile.website ?? '',
    secondary_specialization: profile.secondary_specialization ?? '',
    education: profile.education ?? '',
    years_experience: profile.years_experience != null ? String(profile.years_experience) : '',
    bio: profile.bio ?? '',
  });
  const [specialization, setSpecialization] = useState<number | null>(profile.specialization_id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bind = (name: keyof typeof form) => ({ value: form[name], onChangeText: (value: string) => setForm((f) => ({ ...f, [name]: value })) });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateDentistProfile(clinicId, { ...form, specialization_id: specialization, years_experience: form.years_experience === '' ? null : Number(form.years_experience) });
      updateUser({ name: form.name.trim() });
      onSaved();
    } catch (err) {
      setError(serverMessage(err, 'Your profile could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Edit Profile" onClose={onClose}>
      <Field label="Full Name" required autoCapitalize="words" maxLength={255} {...bind('name')} />
      <Field label="Phone" keyboardType="phone-pad" maxLength={30} {...bind('phone')} />
      <Field label="Address" maxLength={255} {...bind('address')} />
      <Field label="Website" autoCapitalize="none" maxLength={255} {...bind('website')} />
      <SelectField<number> label="Specialization" placeholder="Not set" options={profile.specializations.map((s) => ({ id: s.id, label: s.name }))} value={specialization} onChange={setSpecialization} />
      <Field label="Secondary" maxLength={255} {...bind('secondary_specialization')} />
      <Field label="Education" maxLength={255} {...bind('education')} />
      <Field label="Years of Experience" keyboardType="number-pad" maxLength={2} {...bind('years_experience')} />
      <Field label="Biography" multiline maxLength={2000} {...bind('bio')} />
      <Text style={ui.small}>Your sign-in email and licence numbers are changed through your clinic administrator.</Text>
      <FormError message={error} />
      <Button label="Save Changes" style={ui.spacedTop} busy={busy} disabled={!form.name.trim()} onPress={save} />
    </Sheet>
  );
}

const Credential = ({ label, value }: { label: string; value: string | null }) => (
  <View style={styles.credential}>
    <View style={ui.flex}>
      <Text style={styles.credentialLabel}>{label}</Text>
      <Text style={ui.title}>{value || 'Not on file'}</Text>
    </View>
    <Badge label={value ? 'On file' : 'Missing'} tone={value ? 'success' : 'neutral'} />
  </View>
);

export const DentistProfileScreen = ({ initialTab }: { initialTab?: ProfileTab }) => {
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const [tab, setTab] = useState<ProfileTab>(initialTab ?? 'profile');
  const [isEditing, setIsEditing] = useState(false);
  const profile = useLoader(() => fetchDentistProfile(clinicId), [clinicId], 'Your profile could not be loaded.');
  const schedule = useLoader(() => fetchDentistSchedule(clinicId), [clinicId], 'Your schedule could not be loaded.');
  useRefreshOnFocus(profile.sync);
  const data = profile.data;

  useEffect(() => {
    if (initialTab) setTab(initialTab);
  }, [initialTab]);

  return (
    <ClinicScreen title="My Profile" active="ClinicAccount" back>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={profile.refreshing} onRefresh={profile.refresh} />}>
        <LoadState loading={profile.loading} error={profile.error} onRetry={profile.reload} />
        {data && (
          <>
            <Card>
              <PatientLine name={data.name} sub={[data.specialization, data.secondary_specialization].filter(Boolean).join(' · ') || 'Dentist'} />
              <Text style={[ui.small, styles.clinicLine]}>{data.clinic_name}</Text>
              <View style={styles.pills}>
                <Badge label={data.status === 'active' ? 'Active' : 'Inactive'} tone={data.status === 'active' ? 'success' : 'neutral'} />
                {data.years_experience != null && <Badge label={`${data.years_experience} years experience`} tone="info" />}
              </View>
            </Card>
            <Chips options={TABS} value={tab} onChange={setTab} />

            {tab === 'profile' && (
              <>
                <Button icon="pencil-outline" label="Edit Profile" onPress={() => setIsEditing(true)} />
                <Card title="Personal Information">
                  <InfoRow label="Full Name" value={data.name} />
                  <InfoRow label="Email" value={data.email} />
                  <InfoRow label="Phone" value={data.phone || '—'} />
                  <InfoRow label="Address" value={data.address || '—'} />
                  <InfoRow label="Website" value={data.website || '—'} />
                </Card>
                <Card title="Professional Details">
                  <InfoRow label="Specialization" value={data.specialization || '—'} />
                  <InfoRow label="Secondary" value={data.secondary_specialization || '—'} />
                  <InfoRow label="Education" value={data.education || '—'} />
                  <InfoRow label="Experience" value={data.years_experience != null ? `${data.years_experience} years` : '—'} />
                  <Text style={[styles.credentialLabel, ui.spacedTop]}>BIOGRAPHY</Text>
                  <Text style={ui.muted}>{data.bio || 'No biography yet.'}</Text>
                </Card>
              </>
            )}

            {tab === 'license' && (
              <Card title="License & Professional Credentials">
                <Credential label="PRC LICENSE NUMBER" value={data.license_number} />
                <Credential label="PTR NUMBER" value={data.ptr_number} />
                <Credential label="S2 NUMBER" value={data.s2_number} />
                <NoteBox tone="info">License and credential updates require clinic administrator verification. Contact your admin to update these details.</NoteBox>
              </Card>
            )}

            {tab === 'availability' && (
              <Card title="Working Schedule">
                <LoadState loading={schedule.loading} error={schedule.error} onRetry={schedule.reload} />
                {schedule.data && (
                  <>
                    <DayButtons days={schedule.data.days} />
                    <DetailTile label="Start Time" value={schedule.data.starts_at ? formatClockTime(schedule.data.starts_at) : 'Not set'} />
                    <DetailTile label="End Time" value={schedule.data.ends_at ? formatClockTime(schedule.data.ends_at) : 'Not set'} />
                    {schedule.data.pending_change && <NoteBox tone="info">A change to these hours is waiting for your clinic administrator&apos;s approval.</NoteBox>}
                    <Button icon="time-outline" label="Manage Full Schedule" style={ui.spacedTop} onPress={() => navigation.navigate('ClinicMySchedule')} />
                  </>
                )}
              </Card>
            )}

            {tab === 'security' && (
              <>
                <PasswordForm />
                <AccountSecurity />
              </>
            )}
          </>
        )}
      </ScrollView>
      {isEditing && data && (
        <EditProfileSheet
          clinicId={clinicId}
          profile={data}
          onClose={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            profile.sync();
          }}
        />
      )}
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  days: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  day: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: palette.surfaceContainerHigh, backgroundColor: palette.surfaceContainerLowest },
  dayOn: { backgroundColor: palette.primary, borderColor: palette.primary },
  dayText: { fontSize: 12, fontWeight: '600', color: palette.onSurfaceVariant },
  dayTextOn: { color: '#ffffff' },
  weekRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.surfaceContainerHigh },
  weekDate: { fontSize: 13, fontWeight: '600', color: palette.onSurface },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  chip: { paddingVertical: 4, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: palette.primaryFixed },
  chipText: { fontSize: 11, fontWeight: '600', color: palette.primary },
  clinicLine: { marginTop: spacing.xs },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  credential: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginBottom: spacing.sm, borderRadius: radius.lg, backgroundColor: palette.surfaceContainerLow },
  credentialLabel: { fontSize: 11, fontWeight: '600', color: palette.onSurfaceVariant },
});
