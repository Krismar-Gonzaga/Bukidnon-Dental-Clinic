// My Profile for clinic staff (web: FrontDeskProfilePage): details, working
// schedule, password and notification choices.
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { InitialsTile, StatRow } from '../../components/clinic/ClinicAdminKit';
import { Badge, Button, Card, Chips, Field, FormError, LoadState, Sheet, Toggle, ui, useLoader } from '../../components/clinic/ClinicUi';
import { useAuth } from '../../context/AuthContext';
import { formatClockTime } from '../../services/booking';
import { DAYS, fetchMyClinicDetails, MyClinicDetails, serverMessage, updateAccount, updateMyClinicDetails, WEEK_ORDER } from '../../services/clinicPortal';
import { fetchNotificationPreferences, updateNotificationPreferences } from '../../services/notifications';
import { palette, radius, spacing, type } from '../../theme/tokens';
import { AccountSecurity } from '../../components/AccountSecurity';
import { PasswordForm } from './ClinicAccountScreen';

type Tab = 'profile' | 'schedule' | 'security' | 'preferences';

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'security', label: 'Security' },
  { id: 'preferences', label: 'Preferences' },
];

const PREFERENCES = [
  { key: 'appointment_reminders', label: 'Appointment Reminders', hint: 'Get notified before appointments' },
  { key: 'check_in_alerts', label: 'Check-in Alerts', hint: 'Alert when a patient is due but not checked in' },
  { key: 'system_announcements', label: 'System Announcements', hint: 'Platform-wide notices' },
];

function EditSheet({ clinicId, details, onClose, onSaved }: { clinicId: number; details: MyClinicDetails; onClose: () => void; onSaved: () => void }) {
  const { updateUser } = useAuth();
  const [form, setForm] = useState({ name: details.name ?? '', email: details.email ?? '', phone: details.phone ?? '', address: details.address ?? '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bind = (name: keyof typeof form) => ({ value: form[name], onChangeText: (v: string) => setForm((f) => ({ ...f, [name]: v })) });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await updateAccount({ name: form.name.trim(), email: form.email.trim() });
      updateUser({ name: form.name.trim(), email: form.email.trim() });
      await updateMyClinicDetails(clinicId, { phone: form.phone.trim() || null, address: form.address.trim() || null });
      onSaved();
    } catch (err) {
      setError(serverMessage(err, 'Your profile could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Edit Profile" onClose={onClose}>
      <Field label="Full name" required autoCapitalize="words" maxLength={255} {...bind('name')} />
      <Field label="Email" required keyboardType="email-address" autoCapitalize="none" maxLength={255} {...bind('email')} />
      <Field label="Phone" keyboardType="phone-pad" maxLength={30} {...bind('phone')} />
      <Field label="Address" maxLength={255} {...bind('address')} />
      <FormError message={error} />
      <Button label="Save" style={ui.spacedTop} busy={busy} disabled={!form.name.trim() || !form.email.trim()} onPress={save} />
    </Sheet>
  );
}

function Preferences() {
  const prefs = useLoader(fetchNotificationPreferences, [], 'Your preferences could not be loaded.');
  const [categories, setCategories] = useState<Record<string, boolean> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (prefs.data && !categories) setCategories(prefs.data.categories ?? {});
  }, [prefs.data, categories]);

  const change = async (key: string, value: boolean) => {
    const before = categories ?? {};
    const next = { ...before, [key]: value };
    setCategories(next);
    setError(null);
    try {
      await updateNotificationPreferences({ categories: next });
    } catch (err) {
      setCategories(before);
      setError(serverMessage(err, 'Your choice could not be saved.'));
    }
  };

  return (
    <Card title="Notification Preferences">
      <LoadState loading={prefs.loading} error={prefs.data ? null : prefs.error} onRetry={prefs.reload} />
      {categories && PREFERENCES.map(({ key, label, hint }) => <Toggle key={key} label={label} hint={hint} value={categories[key] !== false} onChange={(value) => change(key, value)} />)}
      <FormError message={error} />
    </Card>
  );
}

const FrontDeskProfile = ({ initialTab }: { initialTab?: Tab }) => {
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const details = useLoader(() => fetchMyClinicDetails(clinicId), [clinicId], 'Your profile could not be loaded.');
  const [tab, setTab] = useState<Tab>(initialTab ?? 'profile');
  const [editing, setEditing] = useState(false);
  const d = details.data;
  const schedule = d?.work_schedule;

  return (
    <ClinicScreen title="My Profile" active="ClinicAccount" back>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={details.refreshing} onRefresh={details.refresh} colors={[palette.primary]} />}>
        <LoadState loading={details.loading} error={d ? null : details.error} onRetry={details.reload} />
        {d && (
          <>
            <Card>
              <View style={ui.row}>
                <InitialsTile name={d.name} large />
                <View style={ui.flex}>
                  <Text style={ui.heading}>{d.name}</Text>
                  <Text style={ui.small}>
                    {d.position_label} · {d.clinic_name}
                  </Text>
                  <View style={ui.rowWrap}>
                    <Badge tone="success" label={d.status === 'active' ? 'Active' : d.status} />
                  </View>
                </View>
              </View>
            </Card>
            <Chips options={TABS} value={tab} onChange={setTab} />
            {tab === 'profile' && (
              <Card action={<Button small icon="create-outline" label="Edit" onPress={() => setEditing(true)} />}>
                <StatRow label="Name" value={d.name} />
                <StatRow label="Position" value={d.position_label} />
                <StatRow label="Clinic" value={d.clinic_name} />
                <StatRow label="Email" value={d.email} />
                <StatRow label="Phone" value={d.phone} />
                <StatRow label="Address" value={d.address} />
              </Card>
            )}
            {tab === 'schedule' && (
              <Card title="Working Schedule">
                {schedule ? (
                  <>
                    <View style={styles.week}>
                      {WEEK_ORDER.map((day) => {
                        const on = schedule.days.includes(day);
                        return (
                          <View key={day} style={[styles.day, on && styles.dayOn]} accessible accessibilityLabel={`${DAYS[day]}: ${on ? 'working' : 'off'}`}>
                            <Text style={[styles.dayText, on && styles.dayTextOn]}>{DAYS[day].slice(0, 3)}</Text>
                          </View>
                        );
                      })}
                    </View>
                    <Text style={ui.muted}>
                      Working hours: <Text style={styles.strong}>{`${formatClockTime(schedule.starts_at)} – ${formatClockTime(schedule.ends_at)}`}</Text>
                    </Text>
                  </>
                ) : (
                  <Text style={ui.muted}>Your clinic admin has not set your working schedule yet.</Text>
                )}
                <Text style={ui.small}>Schedule changes must be requested through Clinic Admin.</Text>
              </Card>
            )}
            {tab === 'security' && <>
            <PasswordForm />
            <AccountSecurity />
          </>}
            {tab === 'preferences' && <Preferences />}
          </>
        )}
      </ScrollView>
      {editing && d && (
        <EditSheet
          clinicId={clinicId}
          details={d}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            details.sync();
          }}
        />
      )}
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  week: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.base },
  day: { width: 42, height: 42, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.surfaceContainerLow },
  dayOn: { backgroundColor: palette.primary },
  dayText: { fontSize: 13, fontWeight: '600', color: palette.outline },
  dayTextOn: { color: palette.onPrimary },
  strong: { ...type.bodyMd, fontWeight: '700', color: palette.onSurface },
});

export default FrontDeskProfile;
