// System > Settings (web: ClinicAdminSettingsPage): booking settings, the role
// permission matrix, password and two-factor sign-in, notifications, audit log.
import React, { useEffect, useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { AccountSecurity } from '../../components/AccountSecurity';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { NoteBox, NotificationPreferences, StatRow } from '../../components/clinic/ClinicAdminKit';
import { Badge, Button, Card, Chips, EmptyState, Field, FormError, LoadState, Pager, SelectField, Toggle, ui, useLoader } from '../../components/clinic/ClinicUi';
import {
  auditExportUrl,
  can,
  ClinicSettings,
  changePassword,
  fetchAuditLogs,
  fetchClinicSettings,
  fetchRolePermissions,
  formatDateTime,
  serverMessage,
  updateClinicSettings,
  updateRolePermissions,
} from '../../services/clinicPortal';
import { palette, radius, spacing } from '../../theme/tokens';

type Tab = 'general' | 'permissions' | 'security' | 'notifications' | 'audit';

function GeneralTab({ clinicId }: { clinicId: number }) {
  const settings = useLoader(() => fetchClinicSettings(clinicId), [clinicId], 'Settings could not be loaded.');
  const [form, setForm] = useState<ClinicSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data && !form) setForm(settings.data);
  }, [settings.data, form]);

  const set = <K extends keyof ClinicSettings>(name: K, value: ClinicSettings[K]) => {
    setSaved(false);
    setForm((f) => (f ? { ...f, [name]: value } : f));
  };

  const save = async () => {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      await updateClinicSettings(clinicId, {
        slot_minutes: form.slot_minutes,
        allow_online_booking: form.allow_online_booking,
        require_approval: form.require_approval,
        send_reminders: form.send_reminders,
        allow_patient_cancel: form.allow_patient_cancel,
      });
      setSaved(true);
    } catch (err) {
      setError(serverMessage(err, 'Settings could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Clinic Settings">
      <LoadState loading={settings.loading} error={settings.data ? null : settings.error} onRetry={settings.reload} />
      {form && (
        <>
          <StatRow label="Timezone" value={form.timezone} />
          <StatRow label="Language" value="English" />
          <StatRow label="Date format" value="July 15, 2026" />
          <SelectField label="Appointment slot duration" value={form.slot_minutes} onChange={(value) => set('slot_minutes', value)} options={form.slot_options.map((minutes) => ({ id: minutes, label: `${minutes} minutes` }))} />
          <Text style={styles.group}>Booking Settings</Text>
          <Toggle label="Allow online appointment bookings" value={form.allow_online_booking} onChange={(value) => set('allow_online_booking', value)} />
          <Toggle label="Require appointment approval before confirming" value={form.require_approval} onChange={(value) => set('require_approval', value)} />
          <Toggle label="Send reminders 24 hrs before appointment" hint="By email and in-app notification." value={form.send_reminders} onChange={(value) => set('send_reminders', value)} />
          <Toggle label="Allow patients to cancel online" value={form.allow_patient_cancel} onChange={(value) => set('allow_patient_cancel', value)} />
          <FormError message={error} />
          {saved && <NoteBox tone="success">Settings saved.</NoteBox>}
          <Button label="Save Settings" busy={busy} onPress={save} />
        </>
      )}
    </Card>
  );
}

// One position at a time: a nine-by-five matrix does not fit a phone.
function PermissionsTab({ clinicId }: { clinicId: number }) {
  const roles = useLoader(() => fetchRolePermissions(clinicId), [clinicId], 'Permissions could not be loaded.');
  const [draft, setDraft] = useState<Record<string, string[]> | null>(null);
  const [position, setPosition] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const data = roles.data;
  const active = position ?? data?.positions[0]?.key ?? '';

  useEffect(() => {
    if (data && !draft) setDraft(Object.fromEntries(data.positions.map(({ key, modules }) => [key, modules])));
  }, [data, draft]);

  const toggle = (module: string) => {
    setSaved(false);
    setDraft((d) => (d ? { ...d, [active]: d[active].includes(module) ? d[active].filter((m) => m !== module) : [...d[active], module] } : d));
  };

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      await updateRolePermissions(clinicId, draft);
      setSaved(true);
    } catch (err) {
      setError(serverMessage(err, 'Permissions could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Role Permissions" subtitle="Control which modules each role can access. Clinical records stay with dentists and clinic administrators.">
      <LoadState loading={roles.loading} error={data ? null : roles.error} onRetry={roles.reload} />
      {data && draft && (
        <>
          <Chips options={data.positions.map(({ key, label }) => ({ id: key, label }))} value={active} onChange={setPosition} />
          {data.modules.map((module) => {
            const on = (draft[active] ?? []).includes(module.key);
            return (
              <TouchableOpacity
                key={module.key}
                style={styles.moduleRow}
                onPress={() => toggle(module.key)}
                accessibilityRole="checkbox"
                accessibilityLabel={module.label}
                accessibilityState={{ checked: on }}
              >
                <Text style={ui.muted}>{module.label}</Text>
                <Icon name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? palette.primary : palette.outline} />
              </TouchableOpacity>
            );
          })}
          <FormError message={error} />
          {saved && <NoteBox tone="success">Permissions saved.</NoteBox>}
          <Button label="Save Permissions" busy={busy} onPress={save} />
        </>
      )}
    </Card>
  );
}

function ChangePasswordCard() {
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bind = (name: keyof typeof form) => ({ value: form[name], onChangeText: (v: string) => setForm((f) => ({ ...f, [name]: v })) });

  const save = async () => {
    if (form.next !== form.confirm) {
      setError('The new passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await changePassword({ current_password: form.current, new_password: form.next, new_password_confirmation: form.confirm });
      setSaved(true);
    } catch (err) {
      setError(serverMessage(err, 'Your password could not be changed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Change Password">
      {saved ? (
        <NoteBox tone="success">Password updated successfully.</NoteBox>
      ) : (
        <>
          <Field label="Current password" required secureTextEntry autoCapitalize="none" {...bind('current')} />
          <Field label="New password" required secureTextEntry autoCapitalize="none" {...bind('next')} />
          <Field label="Confirm new password" required secureTextEntry autoCapitalize="none" {...bind('confirm')} />
          <FormError message={error} />
          <Button label="Update Password" busy={busy} disabled={!form.current || !form.next || !form.confirm} onPress={save} />
        </>
      )}
    </Card>
  );
}

function AuditLogTab({ clinicId }: { clinicId: number }) {
  const [page, setPage] = useState(1);
  const logs = useLoader(() => fetchAuditLogs(clinicId, { page }), [clinicId, page], 'The audit log could not be loaded.');
  const [error, setError] = useState<string | null>(null);

  const exportLog = async () => {
    setError(null);
    try {
      await Linking.openURL(await auditExportUrl(clinicId));
    } catch (err) {
      setError(serverMessage(err, 'The log could not be exported.'));
    }
  };

  return (
    <Card title="Audit Log" action={<Button small variant="outline" icon="download-outline" label="Export Log" onPress={exportLog} />}>
      <FormError message={error} />
      <LoadState loading={logs.loading} error={logs.data ? null : logs.error} onRetry={logs.reload} />
      {logs.data?.items.length === 0 && <EmptyState icon="list-outline" text="Nothing has been logged yet." />}
      {logs.data?.items.map((entry) => (
        <View key={entry.id} style={ui.listItem}>
          <Text style={ui.title}>{entry.detail ? `${entry.label}: ${entry.detail}` : entry.label}</Text>
          <Text style={ui.small}>{[entry.user_name, entry.user_role && `(${entry.user_role})`].filter(Boolean).join(' ')}</Text>
          <View style={ui.between}>
            <Text style={ui.small}>{formatDateTime(entry.created_at)}</Text>
            {entry.category ? <Badge tone="info" label={entry.category} /> : null}
          </View>
        </View>
      ))}
      {logs.data && <Pager page={page} lastPage={logs.data.meta.last_page} onChange={setPage} />}
    </Card>
  );
}

const ClinicAdminSettingsScreen = () => {
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const tabs = [
    ...(can(membership, 'clinic.settings.manage') ? [{ id: 'general' as Tab, label: 'General' }] : []),
    ...(can(membership, 'clinic.permissions.manage') ? [{ id: 'permissions' as Tab, label: 'Permissions' }] : []),
    { id: 'security' as Tab, label: 'Security' },
    { id: 'notifications' as Tab, label: 'Notifications' },
    ...(can(membership, 'clinic.audit.view') ? [{ id: 'audit' as Tab, label: 'Audit Log' }] : []),
  ];
  const [tab, setTab] = useState<Tab>(tabs[0].id);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <ClinicScreen title="Settings" active="ClinicAdminSettings">
      <ScrollView
        contentContainerStyle={ui.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => setRefreshKey((k) => k + 1)} colors={[palette.primary]} />}
      >
        <Chips options={tabs} value={tab} onChange={setTab} />
        <View key={refreshKey} style={styles.panel}>
          {tab === 'general' && <GeneralTab clinicId={clinicId} />}
          {tab === 'permissions' && <PermissionsTab clinicId={clinicId} />}
          {tab === 'security' && (
            <>
              <ChangePasswordCard />
              <AccountSecurity />
            </>
          )}
          {tab === 'notifications' && <NotificationPreferences />}
          {tab === 'audit' && <AuditLogTab clinicId={clinicId} />}
        </View>
      </ScrollView>
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  panel: { gap: spacing.md },
  group: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', color: palette.onSurfaceVariant, marginTop: spacing.sm },
  moduleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, borderBottomWidth: 1, borderBottomColor: palette.surfaceContainerHigh },
  code: { padding: spacing.sm, marginTop: spacing.xs, borderRadius: radius.lg, backgroundColor: palette.surfaceContainerLow, fontFamily: 'monospace', color: palette.onSurface },
});

export default ClinicAdminSettingsScreen;
