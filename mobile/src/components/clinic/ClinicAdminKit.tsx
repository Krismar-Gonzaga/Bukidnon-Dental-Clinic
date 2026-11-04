// Pieces shared by the clinic admin screens from the second design set (web:
// components/clinic/ClinicAdminUi.jsx).
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useOpenSection } from './ClinicChrome';
import { useClinicPortal } from './ClinicPortalContext';
import { Button, Card, Chips, Field, FormError, LoadState, SelectField, Sheet, Toggle, ui, useLoader } from './ClinicUi';
import { ClinicRoute } from '../../config/clinicSections';
import { can, fetchSpecializationOptions, inviteStaff, serverMessage } from '../../services/clinicPortal';
import { fetchNotificationPreferences, updateNotificationPreferences } from '../../services/notifications';
import { palette, radius, spacing, type } from '../../theme/tokens';

// Matches backend config/permissions.php (staff_positions).
export const STAFF_POSITIONS = [
  { id: 'receptionist', label: 'Receptionist' },
  { id: 'dental_assistant', label: 'Dental Assistant' },
  { id: 'dental_hygienist', label: 'Dental Hygienist' },
  { id: 'office_manager', label: 'Office Manager' },
];

export const positionLabel = (position?: string | null) => STAFF_POSITIONS.find(({ id }) => id === position)?.label;

export const initialsOf = (name = '') =>
  name
    .replace(/^(dr|dra|mr|mrs|ms)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('') || '?';

export const InitialsTile = ({ name, large }: { name?: string; large?: boolean }) => (
  <View style={[styles.tile, large && styles.tileLarge]}>
    <Text style={[styles.tileText, large && styles.tileTextLarge]}>{initialsOf(name)}</Text>
  </View>
);

/** Small labelled block used on the details pages. */
export const DetailTile = ({ icon, label, value }: { icon?: string; label: string; value?: string | number | null }) => (
  <View style={styles.detail}>
    {icon ? <Icon name={icon} size={18} color={palette.onSurfaceVariant} /> : null}
    <View style={ui.flex}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value || value === 0 ? value : '—'}</Text>
    </View>
  </View>
);

export const StatRow = ({ label, value }: { label: string; value?: string | number | null }) => (
  <View style={styles.statRow}>
    <Text style={ui.muted}>{label}</Text>
    <Text style={styles.statValue}>{value || value === 0 ? value : '—'}</Text>
  </View>
);

export const NoteBox = ({ tone = 'warning', title, children }: { tone?: 'warning' | 'info' | 'success' | 'danger'; title?: string; children: React.ReactNode }) => (
  <View style={[styles.note, styles[`note_${tone}`]]}>
    {title ? <Text style={[styles.noteTitle, styles[`noteText_${tone}`]]}>{title}</Text> : null}
    <Text style={[styles.noteText, styles[`noteText_${tone}`]]}>{children}</Text>
  </View>
);

export const SuccessBlock = ({ title, children, action, navy }: { title: string; children?: React.ReactNode; action?: React.ReactNode; navy?: boolean }) => (
  <View style={styles.success} accessibilityRole="alert">
    <View style={[styles.successIcon, navy && styles.successIconNavy]}>
      <Icon name="checkmark-circle-outline" size={40} color={navy ? palette.primary : '#00a35c'} />
    </View>
    <Text style={styles.successTitle}>{title}</Text>
    {children}
    {action}
  </View>
);

/** Clinic Profile | Services & Pricing | Branches (only the ones the member may open). */
export function ClinicProfileTabs({ active }: { active: ClinicRoute }) {
  const { membership } = useClinicPortal();
  const open = useOpenSection(active);
  const tabs: { id: ClinicRoute; label: string; show: boolean }[] = [
    { id: 'ClinicSettings', label: 'Clinic Profile', show: can(membership, 'clinic.profile.manage') },
    { id: 'ClinicServices', label: 'Services & Pricing', show: can(membership, 'clinic.services.manage') },
    { id: 'ClinicBranches', label: 'Branches', show: can(membership, 'clinic.branches.manage', 'clinic.schedules.manage') },
  ];
  return <Chips options={tabs.filter((tab) => tab.show).map(({ id, label }) => ({ id, label }))} value={active} onChange={(route) => open(route)} />;
}

/** "Invite by Email" for dentists and staff, with the design's confirmation step. */
export function InviteSheet({ clinicId, clinicName, role, title, onClose, onSent }: { clinicId: number; clinicName?: string; role: 'dentist' | 'staff'; title: string; onClose: () => void; onSent: () => void }) {
  const isDentist = role === 'dentist';
  const specializations = useLoader(async () => (isDentist ? fetchSpecializationOptions() : []), [isDentist]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [specializationId, setSpecializationId] = useState<number | null>(null);
  const [position, setPosition] = useState('receptionist');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await inviteStaff(clinicId, {
        email: email.trim(),
        name: name.trim() || undefined,
        role,
        ...(isDentist ? { specialization_id: specializationId ?? undefined } : { position }),
      });
      setSent(true);
      onSent();
    } catch (err) {
      setError(serverMessage(err, 'The invitation could not be sent.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={title} onClose={onClose}>
      {sent ? (
        <SuccessBlock title="Invitation Sent!" action={<Button label="Done" style={styles.fullWidth} onPress={onClose} />}>
          <Text style={[ui.muted, styles.center]}>They will receive an email with instructions to join {clinicName ?? 'your clinic'}.</Text>
        </SuccessBlock>
      ) : (
        <>
          <Field label="Email address" required keyboardType="email-address" autoCapitalize="none" maxLength={255} value={email} onChangeText={setEmail} />
          <Field label="Full name (optional)" autoCapitalize="words" maxLength={255} value={name} onChangeText={setName} />
          {isDentist ? (
            <SelectField label="Specialization" value={specializationId} onChange={setSpecializationId} options={(specializations.data ?? []).map((s) => ({ id: s.id, label: s.name }))} />
          ) : (
            <SelectField label="Role / position" required value={position} onChange={setPosition} options={STAFF_POSITIONS} />
          )}
          <NoteBox tone="info">An invitation email will be sent with a secure link to join your clinic and set up their account.</NoteBox>
          <FormError message={error} />
          <Button label="Send Invitation" style={ui.spacedTop} busy={busy} disabled={!email.trim()} onPress={send} />
        </>
      )}
    </Sheet>
  );
}

const PREFERENCE_GROUPS = [
  {
    title: 'Appointments',
    items: [
      { key: 'appointment_requests', label: 'New appointment requests' },
      { key: 'appointment_confirmations', label: 'Appointment confirmations' },
      { key: 'appointment_cancellations', label: 'Appointment cancellations' },
      { key: 'appointment_reminders', label: 'Appointment reminders (24 hrs before)' },
      { key: 'daily_summary', label: 'Daily appointment summary (7:00 AM)' },
    ],
  },
  {
    title: 'Inventory',
    items: [
      { key: 'inventory_low_stock', label: 'Low stock alerts' },
      { key: 'inventory_critical', label: 'Critical stock alerts' },
      { key: 'inventory_expiry', label: 'Expiry date alerts (30 days)' },
    ],
  },
  {
    title: 'Team',
    items: [
      { key: 'team_dentists', label: 'Dentist account changes' },
      { key: 'team_staff', label: 'Staff account changes' },
      { key: 'team_password_resets', label: 'Password reset requests' },
    ],
  },
  {
    title: 'System',
    items: [
      { key: 'subscription_renewal', label: 'Subscription renewal reminders' },
      { key: 'new_reviews', label: 'New patient reviews' },
      { key: 'monthly_reports', label: 'Monthly report summaries' },
      { key: 'system_announcements', label: 'System announcements' },
    ],
  },
];

/** A member's own notification choices. Everything starts on. */
export function NotificationPreferences() {
  const prefs = useLoader(fetchNotificationPreferences, [], 'Your preferences could not be loaded.');
  const [draft, setDraft] = useState<Record<string, boolean> | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (prefs.data && !draft) setDraft(prefs.data.categories ?? {});
  }, [prefs.data, draft]);

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      await updateNotificationPreferences({ categories: draft });
      setSaved(true);
    } catch (err) {
      setError(serverMessage(err, 'Your preferences could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Notification Preferences">
      <LoadState loading={prefs.loading} error={prefs.data ? null : prefs.error} onRetry={prefs.reload} />
      {draft &&
        PREFERENCE_GROUPS.map((group) => (
          <View key={group.title}>
            <Text style={styles.groupLabel}>{group.title}</Text>
            {group.items.map((item) => (
              <Toggle
                key={item.key}
                label={item.label}
                value={draft[item.key] !== false}
                onChange={(value) => {
                  setSaved(false);
                  setDraft((d) => ({ ...d, [item.key]: value }));
                }}
              />
            ))}
          </View>
        ))}
      <FormError message={error} />
      {saved && <NoteBox tone="success">Preferences saved.</NoteBox>}
      {draft && <Button label="Save Preferences" busy={busy} onPress={save} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  tile: { width: 44, height: 44, borderRadius: radius.xl, backgroundColor: palette.primary, alignItems: 'center', justifyContent: 'center' },
  tileLarge: { width: 72, height: 72, borderRadius: radius.xxl },
  tileText: { color: palette.onPrimary, fontWeight: '700', fontSize: 15 },
  tileTextLarge: { fontSize: 24 },
  detail: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.xl, backgroundColor: palette.surface },
  detailLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', color: palette.onSurfaceVariant },
  detailValue: { ...type.bodyMd, fontWeight: '500', color: palette.onSurface },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.base, borderBottomWidth: 1, borderBottomColor: palette.surfaceContainerHigh },
  statValue: { ...type.bodyMd, fontWeight: '600', color: palette.onSurface, flexShrink: 1, textAlign: 'right' },
  note: { padding: spacing.sm, borderRadius: radius.xl, borderWidth: 1 },
  note_warning: { backgroundColor: '#fff8e1', borderColor: '#f4d774' },
  note_info: { backgroundColor: '#eef4ff', borderColor: palette.primaryFixedDim },
  note_success: { backgroundColor: '#e7f8ef', borderColor: '#a8e6c6' },
  note_danger: { backgroundColor: '#fdeaea', borderColor: '#f5c2c2' },
  noteText_danger: { color: '#b3261e' },
  noteTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  noteText: { fontSize: 13 },
  noteText_warning: { color: '#8a6100' },
  noteText_info: { color: palette.primary },
  noteText_success: { color: '#007a46' },
  success: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  successIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#e1f8ec', alignItems: 'center', justifyContent: 'center' },
  successIconNavy: { backgroundColor: palette.primaryFixed },
  successTitle: { ...type.titleLg, fontWeight: '700', color: palette.onSurface, textAlign: 'center' },
  center: { textAlign: 'center' },
  fullWidth: { alignSelf: 'stretch' },
  groupLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', color: palette.onSurfaceVariant, marginTop: spacing.sm },
});
