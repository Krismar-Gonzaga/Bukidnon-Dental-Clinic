// System Settings (web: pages/admin/AdminSettingsPage.jsx). Saving needs the password (423).
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { AdminScreen } from '../../components/admin/AdminChrome';
import { actionError, PasswordPrompt, useSensitiveAction } from '../../components/admin/AdminSecurity';
import { Badge, Button, Card, Chips, Field, FormError, LoadState, Toggle, ui, useLoader } from '../../components/clinic/ClinicUi';
import { DOCUMENT_LABELS, fetchPlatformSettings, fetchSystemHealth, formatMonthly, PlatformSettings, savePlatformSettings } from '../../services/admin';
import { formatDateTime } from '../../services/clinicPortal';
import { palette, radius, spacing } from '../../theme/tokens';

const TABS = [
  { id: 'platform', label: 'Platform' },
  { id: 'security', label: 'Security' },
  { id: 'verification', label: 'Verification' },
  { id: 'subscription', label: 'Subscription' },
  { id: 'health', label: 'Health' },
] as const;
type TabId = (typeof TABS)[number]['id'];

const CHECK = { ok: { tone: 'success', label: 'OK' }, warn: { tone: 'warning', label: 'Attention' }, fail: { tone: 'danger', label: 'Failing' } } as const;

function Health() {
  const health = useLoader(fetchSystemHealth, [], 'Health checks could not run.');
  const data = health.data;
  return (
    <Card title="Platform Health" subtitle={data ? `Checked ${formatDateTime(data.checked_at)} · ${data.environment}` : 'Live checks of the services the platform needs.'}>
      {!data ? (
        <LoadState loading={health.loading} error={health.error} onRetry={health.reload} />
      ) : (
        data.checks.map((check) => (
          <View key={check.key} style={ui.stackItem}>
            <View style={ui.between}>
              <Text style={[ui.title, ui.flex]}>{check.label}</Text>
              <Badge tone={CHECK[check.status].tone} label={CHECK[check.status].label} />
            </View>
            <Text style={ui.small}>{check.detail}</Text>
          </View>
        ))
      )}
      {data && <Button small variant="outline" icon="refresh" label="Run Checks Again" busy={health.refreshing} onPress={health.refresh} />}
    </Card>
  );
}

const AdminSettingsScreen = () => {
  const sensitive = useSensitiveAction();
  const settings = useLoader(fetchPlatformSettings, [], 'Settings could not be loaded.');
  const [tab, setTab] = useState<TabId>('platform');
  const [draft, setDraft] = useState<PlatformSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data && !draft) setDraft(settings.data);
  }, [settings.data, draft]);

  const set = <K extends keyof PlatformSettings>(name: K, value: PlatformSettings[K]) => setDraft((current) => (current ? { ...current, [name]: value } : current));
  const setNumber = (name: 'session_timeout_minutes' | 'payment_grace_days') => (text: string) => set(name, Number(text.replace(/\D/g, '')));

  const save = async () => {
    if (!draft) return;
    setBusy(true);
    setSaved(false);
    setError(null);
    const values = {
      platform_name: draft.platform_name,
      support_email: draft.support_email,
      maintenance_mode: draft.maintenance_mode,
      allow_self_registration: draft.allow_self_registration,
      session_timeout_minutes: draft.session_timeout_minutes,
      require_verification: draft.require_verification,
      required_documents: draft.required_documents,
      payment_grace_days: draft.payment_grace_days,
    };
    try {
      setDraft(await sensitive.run(() => savePlatformSettings(values)));
      setSaved(true);
    } catch (err) {
      setError(actionError(err, 'The settings could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const toggleDocument = (type: string) => {
    if (!draft) return;
    const has = draft.required_documents.includes(type);
    set('required_documents', has ? draft.required_documents.filter((item) => item !== type) : [...draft.required_documents, type]);
  };

  return (
    <AdminScreen title="System Settings" active="AdminSettings">
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={settings.refreshing} onRefresh={settings.refresh} />}>
        <Chips options={[...TABS]} value={tab} onChange={setTab} />
        {tab === 'health' ? (
          <Health />
        ) : !draft ? (
          <LoadState loading={settings.loading} error={settings.error} onRetry={settings.reload} />
        ) : (
          <>
            {tab === 'platform' && (
              <Card title="Platform Information">
                <Field label="Platform Name" required maxLength={80} value={draft.platform_name} onChangeText={(text) => set('platform_name', text)} />
                <Field label="Support Email" required keyboardType="email-address" autoCapitalize="none" maxLength={255} value={draft.support_email} onChangeText={(text) => set('support_email', text)} />
                <Toggle label="Maintenance Mode" hint="Temporarily disable access to the platform" value={draft.maintenance_mode} onChange={(value) => set('maintenance_mode', value)} />
                <Toggle label="Allow Self-Registration" hint="Allow patients to register without admin invitation" value={draft.allow_self_registration} onChange={(value) => set('allow_self_registration', value)} />
              </Card>
            )}
            {tab === 'security' && (
              <Card title="Security Settings">
                <Field
                  label="Session Timeout (minutes)"
                  required
                  keyboardType="number-pad"
                  hint="Applies to every web sign-in and to clinic staff and administrators on the app. Patients stay signed in on their phones."
                  value={String(draft.session_timeout_minutes)}
                  onChangeText={setNumber('session_timeout_minutes')}
                />
                <Text style={[ui.small, ui.spacedTop]}>Password policies are enforced at login. Minimum 8 characters with at least one letter and one number.</Text>
              </Card>
            )}
            {tab === 'verification' && (
              <Card title="Clinic Verification Requirements">
                <Toggle label="Require Verification Before Activation" hint="New clinics must be verified before they can use the platform" value={draft.require_verification} onChange={(value) => set('require_verification', value)} />
                <Text style={[ui.title, ui.spacedTop]}>Required Documents</Text>
                {draft.document_types.map((type) => {
                  const on = draft.required_documents.includes(type);
                  return (
                    <TouchableOpacity key={type} style={styles.document} onPress={() => toggleDocument(type)} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                      <Icon name={on ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={on ? palette.secondary : palette.outline} />
                      <Text style={ui.muted}>{DOCUMENT_LABELS[type] ?? type}</Text>
                    </TouchableOpacity>
                  );
                })}
              </Card>
            )}
            {tab === 'subscription' && (
              <Card title="Subscription Configuration">
                <Field label="Payment Grace Period (days)" required keyboardType="number-pad" value={String(draft.payment_grace_days)} onChangeText={setNumber('payment_grace_days')} />
                <Text style={[ui.small, ui.spacedTop]}>
                  {draft.platform_name} does not process online payments. All payments are handled externally via GCash, Maya, or bank transfer. Clinic admins submit proof of payment for manual verification.
                </Text>
                <Text style={[ui.title, ui.spacedTop]}>Available Plans</Text>
                {draft.plans.map((plan) => (
                  <View key={plan.key} style={styles.plan}>
                    <View style={ui.flex}>
                      <Text style={ui.title}>{plan.name}</Text>
                      <Text style={ui.small}>{plan.limits}</Text>
                    </View>
                    <Text style={styles.price}>{formatMonthly(plan.price)}</Text>
                  </View>
                ))}
              </Card>
            )}
            <FormError message={error} />
            {saved && <Text style={ui.success}>Settings saved.</Text>}
            <Button icon="checkmark-circle-outline" label="Save Settings" busy={busy} onPress={save} />
          </>
        )}
      </ScrollView>
      <PasswordPrompt sensitive={sensitive} />
    </AdminScreen>
  );
};

const styles = StyleSheet.create({
  document: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginTop: spacing.xs, borderRadius: radius.lg, backgroundColor: palette.surfaceContainerLow },
  plan: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginTop: spacing.xs, borderRadius: radius.lg, backgroundColor: palette.surfaceContainerLow },
  price: { fontWeight: '700', color: palette.primary },
});

export default AdminSettingsScreen;
