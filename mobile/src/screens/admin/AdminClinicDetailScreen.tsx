// Clinic Details (web: pages/admin/AdminClinicDetailPage.jsx): plan, renewal, activity (labels
// and dates only), and suspending or reactivating, which needs the password (423).
import React, { useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { AdminScreen } from '../../components/admin/AdminChrome';
import { actionError, PasswordPrompt, useSensitiveAction } from '../../components/admin/AdminSecurity';
import { DetailTiles } from '../../components/admin/AdminWidgets';
import { Badge, Button, Card, Field, FormError, LoadState, Sheet, ui, useLoader } from '../../components/clinic/ClinicUi';
import { AdminClinicDetail, CLINIC_STATUS, fetchAdminClinic, formatMonthYear, reactivateClinic, SUBSCRIPTION_STATUS, suspendClinic } from '../../services/admin';
import { formatDateTime } from '../../services/clinicPortal';

function ChangeSheet({ clinic, onClose, onDone }: { clinic: AdminClinicDetail; onClose: () => void; onDone: () => void }) {
  const sensitive = useSensitiveAction();
  const isSuspended = clinic.status === 'suspended';
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await sensitive.run<unknown>(() => (isSuspended ? reactivateClinic(clinic.id) : suspendClinic(clinic.id, reason.trim())));
      onDone();
    } catch (err) {
      setError(actionError(err, 'The clinic could not be updated.'));
      setBusy(false);
    }
  };

  return (
    <Sheet title={isSuspended ? 'Reactivate Clinic' : 'Suspend Clinic'} onClose={busy ? () => undefined : onClose}>
      <Text style={ui.muted}>Are you sure you want to {isSuspended ? 'reactivate' : 'suspend'} this clinic?</Text>
      {!isSuspended && <Field label="Reason (recorded in the audit log)" required multiline maxLength={1000} value={reason} onChangeText={setReason} />}
      <FormError message={error} />
      <PasswordPrompt sensitive={sensitive} inline />
      {!sensitive.asking && (
        <Button
          label={isSuspended ? 'Confirm Reactivate' : 'Confirm Suspend'}
          variant={isSuspended ? 'primary' : 'danger'}
          style={ui.spacedTop}
          busy={busy}
          disabled={!isSuspended && !reason.trim()}
          onPress={submit}
        />
      )}
    </Sheet>
  );
}

const AdminClinicDetailScreen = ({ route }: { route: { params: { clinicId: number } } }) => {
  const { clinicId } = route.params;
  const navigation = useNavigation<any>();
  const clinic = useLoader(() => fetchAdminClinic(clinicId), [clinicId], 'This clinic could not be loaded.');
  const [changing, setChanging] = useState(false);
  const c = clinic.data;

  return (
    <AdminScreen title="Clinic Details" active="AdminClinicDetail" back>
      <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={clinic.refreshing} onRefresh={clinic.refresh} />}>
        {!c ? (
          <LoadState loading={clinic.loading} error={clinic.error} onRetry={clinic.reload} />
        ) : (
          <>
            <Card title={c.name} subtitle={[c.city, c.admin && `Admin: ${c.admin}`].filter(Boolean).join(' · ')} action={<Badge tone={CLINIC_STATUS[c.status]?.tone} label={CLINIC_STATUS[c.status]?.label ?? c.status} />}>
              <DetailTiles
                tiles={[
                  { label: 'Plan', value: c.plan },
                  { label: 'Since', value: formatMonthYear(c.since) },
                  { label: 'Renewal', value: formatMonthYear(c.renews_at) },
                  { label: 'Sub Status', value: SUBSCRIPTION_STATUS[c.subscription_status]?.label ?? c.subscription_status },
                ]}
              />
              {c.suspension_reason ? <FormError message={`Suspended: ${c.suspension_reason}`} /> : null}
            </Card>

            <Card title="Actions">
              <View style={ui.rowWrap}>
                <Button small variant={c.status === 'suspended' ? 'primary' : 'danger'} label={c.status === 'suspended' ? 'Reactivate Clinic' : 'Suspend Clinic'} onPress={() => setChanging(true)} />
                {c.application_id ? <Button small variant="outline" label="View Verification" onPress={() => navigation.navigate('AdminApplicationDetail', { applicationId: c.application_id })} /> : null}
              </View>
            </Card>

            <Card title="Clinic Activity">
              {c.activity.length === 0 ? <Text style={ui.muted}>No activity recorded yet.</Text> : null}
              {c.activity.map((item) => (
                <Text key={item.id} style={[ui.muted, ui.stackItem]}>
                  {item.label} — {formatDateTime(item.at)}
                </Text>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
      {changing && c && (
        <ChangeSheet
          clinic={c}
          onClose={() => setChanging(false)}
          onDone={() => {
            setChanging(false);
            clinic.sync();
          }}
        />
      )}
    </AdminScreen>
  );
};

export default AdminClinicDetailScreen;
