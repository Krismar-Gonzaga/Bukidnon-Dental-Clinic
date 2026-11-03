// Platform health and security safeguards (web: pages/admin/AdminSettingsPage.jsx).
import React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AdminScreen } from '../../components/admin/AdminChrome';
import { Badge, Button, Card, LoadState, ui, useLoader } from '../../components/clinic/ClinicUi';
import { fetchSystemHealth } from '../../services/admin';
import { formatDateTime } from '../../services/clinicPortal';

const CHECK = { ok: { tone: 'success', label: 'OK' }, warn: { tone: 'warning', label: 'Attention' }, fail: { tone: 'danger', label: 'Failing' } } as const;
const OVERALL = { healthy: { tone: 'success', label: 'Healthy' }, degraded: { tone: 'warning', label: 'Needs attention' }, down: { tone: 'danger', label: 'Service down' } } as const;

const SAFEGUARDS = [
  'Approving or returning clinic registrations, suspending or reactivating clinics and accounts, changing account types and moderating reviews ask for your password again. A confirmation lasts 15 minutes and only on this device.',
  'Verification documents open through links that expire after 5 minutes; every view and download is recorded.',
  'Administrators cannot change their own account type or status, and cannot read patients’ clinical records.',
  'Sign-ins, failed sign-ins and every administrative action are written to the audit log, which cannot be edited.',
];

const AdminSettingsScreen = () => {
  const navigation = useNavigation<any>();
  const health = useLoader(fetchSystemHealth, [], 'Health checks could not run.');
  const data = health.data;

  return (
    <AdminScreen title="Settings" active="AdminSettings">
      <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={health.refreshing} onRefresh={health.refresh} />}>
        <Card
          title="Platform health"
          subtitle={data ? `Checked ${formatDateTime(data.checked_at)} · ${data.environment}` : 'Live checks of the services the platform needs.'}
          action={data ? <Badge tone={OVERALL[data.status].tone} label={OVERALL[data.status].label} /> : undefined}
        >
          {!data ? (
            <LoadState loading={health.loading} error={health.error} onRetry={health.reload} />
          ) : (
            data.checks.map((c) => (
              <View key={c.key} style={ui.listItem}>
                <View style={ui.between}>
                  <Text style={[ui.title, ui.flex]}>{c.label}</Text>
                  <Badge tone={CHECK[c.status].tone} label={CHECK[c.status].label} />
                </View>
                <Text style={ui.muted}>{c.detail}</Text>
              </View>
            ))
          )}
          {data && <Button small variant="outline" icon="refresh" label="Run checks again" busy={health.refreshing} onPress={health.refresh} />}
        </Card>

        <Card title="Security safeguards" subtitle="How the platform protects administrative actions.">
          {SAFEGUARDS.map((point) => (
            <Text key={point} style={[ui.muted, ui.stackItem]}>
              • {point}
            </Text>
          ))}
        </Card>

        <Card title="Your account">
          <View style={ui.rowWrap}>
            <Button small variant="outline" label="My Profile" onPress={() => navigation.navigate('AdminAccount', { tab: 'profile' })} />
            <Button small variant="outline" label="Change Password" onPress={() => navigation.navigate('AdminAccount', { tab: 'password' })} />
          </View>
        </Card>
      </ScrollView>
    </AdminScreen>
  );
};

export default AdminSettingsScreen;
