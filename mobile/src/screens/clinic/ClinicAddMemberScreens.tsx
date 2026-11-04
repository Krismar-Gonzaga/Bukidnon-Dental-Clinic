// Add Dentist and Add Staff (web: ClinicAddDentistPage, ClinicAddStaffPage).
// Both create an invitation; the person sets their own password from the email.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { NoteBox, positionLabel, STAFF_POSITIONS } from '../../components/clinic/ClinicAdminKit';
import { Button, Card, Field, FormError, SelectField, ui, useLoader } from '../../components/clinic/ClinicUi';
import { fetchSpecializationOptions, inviteStaff, serverMessage } from '../../services/clinicPortal';
import { palette, radius, spacing } from '../../theme/tokens';

const DAYS = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
];

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

// Matches backend config/permissions.php (staff_assignable). Clinical records are not offered.
export const STAFF_PERMISSIONS = [
  { key: 'appointments.view_all', label: 'View Appointments' },
  { key: 'appointments.manage', label: 'Manage Appointments' },
  { key: 'patients.view', label: 'View Patients' },
  { key: 'patients.manage', label: 'Manage Patients' },
  { key: 'patients.medical_alerts', label: 'See Medical Alerts' },
  { key: 'inventory.view', label: 'View Inventory' },
  { key: 'inventory.manage', label: 'Manage Inventory' },
  { key: 'reports.view', label: 'View Reports' },
  { key: 'clinic.staff.manage', label: 'Manage Staff' },
];

const FRONT_DESK = ['appointments.view_all', 'appointments.manage', 'patients.view', 'patients.manage', 'patients.medical_alerts'];
const WITH_STOCK = [...FRONT_DESK, 'inventory.view', 'inventory.manage'];
export const POSITION_DEFAULTS: Record<string, string[]> = {
  receptionist: FRONT_DESK,
  dental_assistant: WITH_STOCK,
  dental_hygienist: FRONT_DESK,
  office_manager: [...WITH_STOCK, 'reports.view', 'clinic.staff.manage'],
};

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((item) => b.includes(item));

function useInvite() {
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await inviteStaff(membership?.clinic_id ?? 0, body);
      navigation.goBack();
    } catch (err) {
      setError(serverMessage(err, 'The invitation could not be sent.'));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, send };
}

export const ClinicAddDentistScreen = () => {
  const { busy, error, send } = useInvite();
  const specializations = useLoader(() => fetchSpecializationOptions(), []);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', years: '', education: '', startsAt: '08:00', endsAt: '17:00' });
  const [specializationId, setSpecializationId] = useState<number | null>(null);
  const [days, setDays] = useState([1, 2, 3, 4, 5]);
  const bind = (name: keyof typeof form) => ({ value: form[name], onChangeText: (v: string) => setForm((f) => ({ ...f, [name]: v })) });
  const hoursValid = days.length === 0 || (CLOCK.test(form.startsAt) && CLOCK.test(form.endsAt) && form.startsAt < form.endsAt);
  const valid = form.firstName.trim() && form.lastName.trim() && form.email.trim() && hoursValid;

  return (
    <ClinicScreen title="Add Dentist" active="ClinicDentists" back>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <Card title="Invite a Dentist" subtitle="Fill in the details or send an email invitation">
          <Field label="First name" required autoCapitalize="words" maxLength={120} {...bind('firstName')} />
          <Field label="Last name" required autoCapitalize="words" maxLength={120} {...bind('lastName')} />
          <Field label="Email address" required keyboardType="email-address" autoCapitalize="none" maxLength={255} placeholder="dentist@example.com" {...bind('email')} />
          <Field label="Phone number" keyboardType="phone-pad" maxLength={30} {...bind('phone')} />
          <SelectField label="Specialization" value={specializationId} onChange={setSpecializationId} options={(specializations.data ?? []).map((s) => ({ id: s.id, label: s.name }))} />
          <Field label="Years of experience" keyboardType="number-pad" maxLength={2} placeholder="e.g. 7" {...bind('years')} />
          <Field label="Educational background" maxLength={2000} placeholder="e.g. UST College of Dentistry" {...bind('education')} />
          <Text style={ui.small}>Working days</Text>
          <View style={ui.rowWrap}>
            {DAYS.map(({ day, label }) => {
              const on = days.includes(day);
              return (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayChip, on && styles.dayChipOn]}
                  onPress={() => setDays((list) => (on ? list.filter((d) => d !== day) : [...list, day]))}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.dayChipText, on && styles.dayChipTextOn]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={ui.row}>
            <View style={ui.flex}>
              <Field label="Start time (HH:MM)" keyboardType="numbers-and-punctuation" maxLength={5} {...bind('startsAt')} />
            </View>
            <View style={ui.flex}>
              <Field label="End time (HH:MM)" keyboardType="numbers-and-punctuation" maxLength={5} {...bind('endsAt')} />
            </View>
          </View>
          {!hoursValid && <FormError message="Enter times as HH:MM, with the end after the start." />}
          <NoteBox tone="info" title="Send Email Invitation">
            An invitation link will be sent to the dentist's email to set up their account and complete onboarding.
          </NoteBox>
          <FormError message={error} />
          <Button
            label="Send Invitation"
            busy={busy}
            disabled={!valid}
            onPress={() =>
              send({
                role: 'dentist',
                name: `${form.firstName.trim()} ${form.lastName.trim()}`,
                email: form.email.trim(),
                phone: form.phone.trim() || undefined,
                specialization_id: specializationId ?? undefined,
                years_experience: form.years === '' ? undefined : Number(form.years),
                qualifications: form.education.trim() || undefined,
                ...(days.length > 0 ? { working_days: days, starts_at: form.startsAt, ends_at: form.endsAt } : {}),
              })
            }
          />
        </Card>
      </ScrollView>
    </ClinicScreen>
  );
};

export const ClinicAddStaffScreen = () => {
  const { membership } = useClinicPortal();
  const { busy, error, send } = useInvite();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [position, setPosition] = useState('receptionist');
  const [permissions, setPermissions] = useState(POSITION_DEFAULTS.receptionist);
  const bind = (name: keyof typeof form) => ({ value: form[name], onChangeText: (v: string) => setForm((f) => ({ ...f, [name]: v })) });
  // Choosing what someone may do is for clinic administrators.
  const canChoose = membership?.role === 'clinic_admin';
  const valid = form.firstName.trim() && form.lastName.trim() && form.email.trim();

  return (
    <ClinicScreen title="Add Staff Member" active="ClinicStaff" back>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <Card title="Staff Information">
          <Field label="First name" required autoCapitalize="words" maxLength={120} {...bind('firstName')} />
          <Field label="Last name" required autoCapitalize="words" maxLength={120} {...bind('lastName')} />
          <Field label="Email address" required keyboardType="email-address" autoCapitalize="none" maxLength={255} {...bind('email')} />
          <Field label="Phone number" keyboardType="phone-pad" maxLength={30} {...bind('phone')} />
          <SelectField
            label="Role / position"
            required
            value={position}
            options={STAFF_POSITIONS}
            onChange={(value) => {
              setPosition(value);
              setPermissions(POSITION_DEFAULTS[value]);
            }}
          />
          {canChoose && (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionTitle}>Permissions for {positionLabel(position)}</Text>
              {STAFF_PERMISSIONS.map(({ key, label }) => {
                const on = permissions.includes(key);
                return (
                  <TouchableOpacity
                    key={key}
                    style={styles.permission}
                    onPress={() => setPermissions((list) => (on ? list.filter((p) => p !== key) : [...list, key]))}
                    accessibilityRole="checkbox"
                    accessibilityLabel={label}
                    accessibilityState={{ checked: on }}
                  >
                    <Icon name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? palette.primary : palette.outline} />
                    <Text style={ui.muted}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          <NoteBox tone="info">An invitation email will be sent to the staff member with instructions to set up their account.</NoteBox>
          <FormError message={error} />
          <Button
            label="Send Invitation"
            busy={busy}
            disabled={!valid}
            onPress={() =>
              send({
                role: 'staff',
                name: `${form.firstName.trim()} ${form.lastName.trim()}`,
                email: form.email.trim(),
                phone: form.phone.trim() || undefined,
                position,
                ...(canChoose && !sameList(permissions, POSITION_DEFAULTS[position]) ? { permissions } : {}),
              })
            }
          />
        </Card>
      </ScrollView>
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  dayChip: { minWidth: 48, minHeight: 40, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, borderWidth: 1, borderColor: palette.outlineVariant },
  dayChipOn: { backgroundColor: palette.primary, borderColor: palette.primary },
  dayChipText: { fontSize: 13, color: palette.onSurface },
  dayChipTextOn: { color: palette.onPrimary, fontWeight: '600' },
  permissionBox: { padding: spacing.sm, borderRadius: radius.xl, borderWidth: 1, borderColor: palette.surfaceContainerHigh, backgroundColor: palette.surface, marginTop: spacing.sm },
  permissionTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', color: palette.onSurfaceVariant, marginBottom: spacing.xs },
  permission: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 40 },
});
