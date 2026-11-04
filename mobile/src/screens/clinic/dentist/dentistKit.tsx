// What the dentist screens share (web: pages/clinic/dentist/dentistUi).
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { InitialsTile } from '../../../components/clinic/ClinicAdminKit';
import { SelectField, useLoader } from '../../../components/clinic/ClinicUi';
import { useClinicPortal } from '../../../components/clinic/ClinicPortalContext';
import { DAYS, formatDateTime, frontDeskStatus } from '../../../services/clinicPortal';
import { DentistPatient, fetchDentistPatients } from '../../../services/dentistPortal';
import { palette, radius, spacing } from '../../../theme/tokens';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PATIENT_OPTIONS_LIMIT = 100;

/** "July 15, 2026" from a stored day (YYYY-MM-DD). */
export const formatDay = (day?: string | null) => {
  if (!day) return '';
  const [year, month, date] = day.split('-').map(Number);
  return `${MONTHS[month - 1]} ${date}, ${year}`;
};

/** "July 15" */
export const monthDay = (day: string) => formatDay(day).replace(/,.*$/, '');

/** The Philippine calendar day of a timestamp. */
export const dayKey = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3600000).toISOString().slice(0, 10);
export const dayOfIso = (iso?: string | null) => (iso ? formatDay(dayKey(iso)) : '');
export const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();
export const weekdayName = (day: string) => DAYS[weekdayOf(day)].slice(0, 3);

export const addDays = (day: string, days: number) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export const mondayOf = (day: string) => {
  const weekday = weekdayOf(day);
  return addDays(day, weekday === 0 ? -6 : 1 - weekday);
};

export const hasText = (text?: string | null) => Boolean(String(text ?? '').trim());
export const capitalize = (text?: string | null) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : '');
export const timeOf = (iso?: string | null) => formatDateTime(iso).split(', ').pop() ?? '';
export const statusBadge = (status: string) => frontDeskStatus(status);

export const FILE_CATEGORIES = [
  { id: 'panoramic_xray', label: 'Panoramic X-ray' },
  { id: 'periapical_xray', label: 'Periapical X-ray' },
  { id: 'intraoral_photo', label: 'Intraoral Photo' },
  { id: 'lab_result', label: 'Lab Result' },
  { id: 'other', label: 'Other' },
];
export const fileTitle = (file: { category: string | null; name: string }) => FILE_CATEGORIES.find(({ id }) => id === file.category)?.label ?? file.name;
export const fileSize = (bytes: number) => (bytes >= 102400 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function usePatientOptions() {
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const list = useLoader(() => fetchDentistPatients(clinicId, { per_page: PATIENT_OPTIONS_LIMIT }), [clinicId], 'Your patients could not be loaded.');
  return { ...list, patients: (list.data?.items ?? []) as DentistPatient[] };
}

export function PatientPicker({ value, onChange, label = 'Patient' }: { value: number | null; onChange: (id: number) => void; label?: string }) {
  const { patients } = usePatientOptions();
  return <SelectField<number> label={label} required placeholder="Select a patient" options={patients.map((p) => ({ id: p.id, label: p.name }))} value={value} onChange={onChange} />;
}

/** One line of a list of records: a label in bold, then its value. */
export const LabelledText = ({ label, children }: { label: string; children?: React.ReactNode }) => (
  <Text style={styles.line}>
    <Text style={styles.lineLabel}>{label}: </Text>
    {children || '—'}
  </Text>
);

export const PatientLine = ({ name, sub, right }: { name?: string | null; sub?: string; right?: React.ReactNode }) => (
  <View style={styles.patientLine}>
    <InitialsTile name={name ?? undefined} />
    <View style={styles.flex}>
      <Text style={styles.title} numberOfLines={2}>{name}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
    {right}
  </View>
);

export const LinkText = ({ label, icon, onPress }: { label: string; icon?: string; onPress: () => void }) => (
  <TouchableOpacity style={styles.link} onPress={onPress} accessibilityRole="link" accessibilityLabel={label}>
    {icon ? <Icon name={icon} size={15} color={palette.primary} /> : null}
    <Text style={styles.linkText}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  line: { fontSize: 13, color: palette.onSurfaceVariant, marginTop: 2 },
  lineLabel: { fontWeight: '600', color: palette.onSurface },
  patientLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  title: { fontSize: 15, fontWeight: '600', color: palette.onSurface },
  sub: { fontSize: 12, color: palette.onSurfaceVariant },
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: spacing.xs, borderRadius: radius.sm },
  linkText: { fontSize: 13, fontWeight: '600', color: palette.primary },
});
