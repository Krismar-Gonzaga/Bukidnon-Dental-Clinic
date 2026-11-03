// One appointment (web: ClinicAppointmentDetailPage): details, the next
// steps the member's permissions allow (confirm, check in, start, complete,
// reschedule, decline, cancel, no-show) and the status history.
import React, { useState } from 'react';
import { Alert, Linking, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { Badge, Button, Card, Field, FormError, InfoRow, LoadState, Sheet, ui, useLoader } from '../../components/clinic/ClinicUi';
import { SlotPicker } from '../../components/clinic/SlotPicker';
import { Slot } from '../../services/booking';
import {
  actionsFor,
  AppointmentAction,
  can,
  fetchAppointment,
  formatDateTime,
  formatPeso,
  runAppointmentAction,
  serverMessage,
  statusLabel,
} from '../../services/clinicPortal';
import { palette } from '../../theme/tokens';

type Props = { route: { params: { appointmentId: number } } };

const ClinicAppointmentDetailScreen = ({ route }: Props) => {
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const { appointmentId } = route.params;
  const detail = useLoader(() => fetchAppointment(clinicId, appointmentId), [clinicId, appointmentId], 'This appointment could not be loaded.');
  const [pending, setPending] = useState<AppointmentAction | null>(null);
  const [reason, setReason] = useState('');
  const [slot, setSlot] = useState<Slot | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const a = detail.data;

  const run = async (item: AppointmentAction, body?: Record<string, unknown>) => {
    setBusy(item.action);
    setFormError(null);
    try {
      await runAppointmentAction(clinicId, appointmentId, item.action, body);
      setPending(null);
      setReason('');
      setSlot(null);
      await detail.sync();
    } catch (err) {
      const message = serverMessage(err, 'That step could not be saved.');
      if (pending) setFormError(message);
      else Alert.alert('Not saved', message);
    } finally {
      setBusy(null);
    }
  };

  const start = (item: AppointmentAction) => {
    if (item.reason || item.slot) {
      setPending(item);
      setFormError(null);
      return;
    }
    if (item.action === 'no-show') {
      Alert.alert('Mark as no-show?', 'The patient did not arrive for this appointment.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark no-show', style: 'destructive', onPress: () => run(item) },
      ]);
      return;
    }
    run(item);
  };

  const actions = a ? actionsFor(membership, a.status) : [];

  return (
    <ClinicScreen title={a ? `Appointment #${String(a.id).padStart(6, '0')}` : 'Appointment'} active="ClinicAppointments" back>
      <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={detail.refreshing} onRefresh={detail.refresh} colors={[palette.primary]} />}>
        <LoadState loading={detail.loading} error={a ? null : detail.error} onRetry={detail.reload} />
        {a && (
          <>
            <Card title={formatDateTime(a.starts_at)} subtitle="Philippine time" action={<Badge status={a.status} />}>
              {a.status === 'reschedule_requested' && a.requested_starts_at ? (
                <Text style={ui.success}>Patient asked to move it to {formatDateTime(a.requested_starts_at)}.</Text>
              ) : null}
              <InfoRow label="Service" value={a.service ? `${a.service.name}${a.service.price != null ? ` · ${formatPeso(Number(a.service.price))}` : ''}` : null} />
              <InfoRow label="Duration" value={a.service?.duration_minutes ? `${a.service.duration_minutes} minutes` : null} />
              <InfoRow label="Dentist" value={a.dentist?.name} />
              <InfoRow label="Branch" value={a.branch ? `${a.branch.name}${a.branch.address ? `, ${a.branch.address}` : ''}` : null} />
              <InfoRow label="Reason for visit" value={a.reason} />
              <InfoRow label="Notes" value={a.notes} />
              {a.cancellation_reason ? <InfoRow label="Cancellation" value={a.cancellation_reason} /> : null}
            </Card>

            <Card title="Patient">
              <Text style={ui.title}>{a.patient?.name ?? 'Patient'}</Text>
              {a.patient?.phone ? <InfoRow label="Phone" value={a.patient.phone} /> : null}
              {a.patient?.email ? <InfoRow label="Email" value={a.patient.email} /> : null}
              <View style={ui.rowWrap}>
                {a.patient?.phone ? <Button small variant="outline" icon="call-outline" label="Call" onPress={() => Linking.openURL(`tel:${a.patient!.phone}`)} /> : null}
                {a.patient && can(membership, 'patients.view') ? (
                  <Button small variant="tonal" icon="person-outline" label="Patient record" onPress={() => navigation.navigate('ClinicPatientDetail', { patientId: a.patient!.id })} />
                ) : null}
              </View>
            </Card>

            {actions.length > 0 && (
              <Card title="Next step">
                {actions.map((item) => (
                  <Button
                    key={item.action}
                    label={item.label}
                    variant={item.primary ? 'primary' : item.danger ? 'danger' : 'outline'}
                    busy={busy === item.action}
                    disabled={Boolean(busy)}
                    onPress={() => start(item)}
                  />
                ))}
              </Card>
            )}

            {(a.status_history ?? []).length > 0 && (
              <Card title="History">
                {(a.status_history ?? []).map((h, i) => (
                  <View key={`${h.at}-${i}`} style={ui.stackItem}>
                    <Text style={ui.title}>{h.from ? `${statusLabel(h.from)} → ${statusLabel(h.to)}` : statusLabel(h.to)}</Text>
                    <Text style={ui.small}>{formatDateTime(h.at)}</Text>
                    {h.reason ? <Text style={ui.muted}>{h.reason}</Text> : null}
                  </View>
                ))}
              </Card>
            )}
          </>
        )}
      </ScrollView>

      {pending && a && (
        <Sheet title={pending.label} onClose={() => setPending(null)}>
          {pending.reason ? (
            <>
              <Field label="Reason (sent to the patient)" value={reason} onChangeText={setReason} multiline required maxLength={500} />
              <FormError message={formError} />
              <Button
                label={pending.label}
                variant="danger"
                style={ui.spacedTop}
                busy={busy === pending.action}
                disabled={!reason.trim()}
                onPress={() => run(pending, { reason: reason.trim() })}
              />
            </>
          ) : a.service && a.dentist ? (
            <>
              <Text style={ui.muted}>
                Open times for {a.dentist.name} · {a.service.name}
              </Text>
              <SlotPicker clinicId={clinicId} serviceRateId={a.service.id} dentistId={a.dentist.id} selected={slot} onSelect={setSlot} />
              <FormError message={formError} />
              <Button
                label={slot ? `Move to ${formatDateTime(slot.startsAt)}` : 'Choose a time'}
                style={ui.spacedTop}
                busy={busy === pending.action}
                disabled={!slot}
                onPress={() => slot && run(pending, { starts_at: slot.startsAt })}
              />
            </>
          ) : (
            <Text style={ui.muted}>This appointment has no dentist or service to find open times for.</Text>
          )}
        </Sheet>
      )}
    </ClinicScreen>
  );
};

export default ClinicAppointmentDetailScreen;
