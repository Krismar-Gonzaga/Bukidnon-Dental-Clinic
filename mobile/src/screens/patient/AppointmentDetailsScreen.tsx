// One appointment, with what can still be done to it. The server has the final word on
// whether a change is still allowed (cut-off before the start time).
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import PatientShell from '../../components/patient/PatientShell';
import { BackLink, ConfirmModal, Notice, StatusBadge } from '../../components/patient/PatientUi';
import { Card, guestColors, Message, OutlineButton, PrimaryButton } from '../../components/guest/GuestUi';
import { PENDING_APPROVAL_TEXT, PENDING_APPROVAL_TITLE } from '../../content/patientContent';
import { useSync } from '../../context/SyncContext';
import { patientService } from '../../services/api';
import { formatClockTime, formatDateKey } from '../../services/booking';
import {
  Appointment,
  appointmentDate,
  appointmentGroup,
  appointmentReference,
  appointmentTime,
  canCancel,
  canReschedule,
} from '../../services/patientPortal';
import { spacing } from '../../theme/tokens';
import { serverMessage } from './BookAppointmentScreen';

const statusNotice = (appointment: Appointment) => {
  const requested = appointment.requested_starts_at;
  switch (appointment.status) {
    case 'reschedule_requested':
      return {
        title: 'Reschedule requested',
        text: `You asked to move this appointment${
          requested ? ` to ${formatDateKey(requested.slice(0, 10))} at ${formatClockTime(requested.slice(11, 16))}` : ''
        }. The clinic will confirm the new time; until then your original time is kept.`,
      };
    case 'rejected':
      return { title: 'Request declined', text: appointment.cancellation_reason || 'The clinic could not accept this request.' };
    case 'cancelled':
      return { title: 'Appointment cancelled', text: appointment.cancellation_reason || 'This appointment was cancelled.' };
    case 'no_show':
      return { title: 'Marked as missed', text: 'Contact the clinic if this is a mistake.' };
    case 'checked_in':
      return { title: 'You are checked in', text: 'Please wait to be called.' };
    default:
      return null;
  }
};

const DetailRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.row}>
    <View style={styles.rowIcon}>
      <Icon name={icon} size={18} color={guestColors.primary} />
    </View>
    <View style={styles.flex}>
      <Text style={styles.rowLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  </View>
);

const AppointmentDetailsScreen = ({ navigation, route }: { navigation: any; route: any }) => {
  const { dataVersion } = useSync();
  const id = route.params.appointment?.id ?? route.params.appointmentId;
  const [appointment, setAppointment] = useState<Appointment | null>(route.params.appointment ?? null);
  const [loading, setLoading] = useState(!route.params.appointment);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await patientService.getAppointments();
      const found = (response.data.data as Appointment[]).find((item) => String(item.id) === String(id));
      if (found) {
        setAppointment(found);
      }
    } catch (error) {
      console.error('Failed to refresh the appointment:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    return navigation.addListener?.('focus', load);
  }, [load, navigation, dataVersion]);

  const cancel = async () => {
    setCancelling(true);
    setProblem(null);
    try {
      const response = await patientService.cancelAppointment(id);
      setNotice(response.data?.queued ? "You're offline. The cancellation is saved and will be sent once you're back online." : null);
      await load();
      setAppointment((current) => (current ? { ...current, status: 'cancelled' } : current));
    } catch (error) {
      // e.g. "Appointments can only be changed online up to 24 hours before…"
      setProblem(serverMessage(error, 'The appointment could not be cancelled.'));
    } finally {
      setCancelling(false);
      setConfirming(false);
    }
  };

  const back = () => navigation.popTo('Appointments');

  if (!appointment) {
    return (
      <PatientShell navigation={navigation} title="Appointment Details" active="Appointments">
        {loading ? (
          <ActivityIndicator style={styles.loader} size="large" color={guestColors.primary} />
        ) : (
          <Message icon="alert-circle-outline" title="Appointment not found" actionLabel="Back to History" onAction={back} />
        )}
      </PatientShell>
    );
  }

  const group = appointmentGroup(appointment.status);
  const pendingRequest = appointment.status === 'pending';
  const statusInfo = statusNotice(appointment);
  const service = appointment.service?.name ?? 'Appointment';
  const reviewable = appointment.status === 'completed' && !appointment.has_review;
  const dentist = appointment.dentist?.name ?? 'your dentist';

  return (
    <PatientShell navigation={navigation} title="Appointment Details" active="Appointments">
      <ScrollView contentContainerStyle={styles.content}>
        <BackLink label="Back to History" onPress={back} />
        <Card>
          <View style={styles.header}>
            <View style={styles.flex}>
              <Text style={styles.title} accessibilityRole="header">
                {service}
              </Text>
              <Text style={styles.reference}>Appointment #{appointmentReference(appointment.id)}</Text>
            </View>
            <StatusBadge group={group} />
          </View>

          <DetailRow icon="business-outline" label="Clinic" value={appointment.clinic?.name ?? '—'} />
          <DetailRow icon="person-outline" label="Dentist" value={appointment.dentist?.name ?? '—'} />
          <DetailRow icon="clipboard-outline" label="Service" value={service} />
          <DetailRow icon="calendar-outline" label="Date" value={appointmentDate(appointment)} />
          <DetailRow icon="time-outline" label="Time" value={appointmentTime(appointment)} />

          <View style={styles.bottom}>
            {pendingRequest && <Notice title={PENDING_APPROVAL_TITLE}>{PENDING_APPROVAL_TEXT}</Notice>}
            {statusInfo && <Notice title={statusInfo.title}>{statusInfo.text}</Notice>}
            {notice && <Notice>{notice}</Notice>}
            {problem && <Notice tone="danger">{problem}</Notice>}

            {pendingRequest && canCancel(appointment.status) && (
              <TouchableOpacity style={styles.cancelButton} onPress={() => setConfirming(true)} accessibilityRole="button">
                <Text style={styles.cancelText}>Cancel Request</Text>
              </TouchableOpacity>
            )}
            {!pendingRequest && (canReschedule(appointment) || canCancel(appointment.status)) && (
              <View style={styles.actions}>
                {canReschedule(appointment) && (
                  <OutlineButton label="Reschedule" onPress={() => navigation.navigate('Reschedule', { appointment })} style={styles.flex} />
                )}
                {canCancel(appointment.status) && (
                  <TouchableOpacity style={[styles.cancelButton, styles.flex]} onPress={() => setConfirming(true)} accessibilityRole="button">
                    <Text style={styles.cancelText}>Cancel Appointment</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            {reviewable && <PrimaryButton label="Leave a Review" onPress={() => navigation.navigate('Feedback', { appointmentId: appointment.id })} />}
          </View>
        </Card>
      </ScrollView>

      <ConfirmModal
        visible={confirming}
        title="Cancel Appointment?"
        message={`Are you sure you want to cancel your appointment with ${dentist}? This action cannot be undone.`}
        keepLabel="Keep Appointment"
        confirmLabel="Yes, Cancel"
        busy={cancelling}
        onKeep={() => setConfirming(false)}
        onConfirm={cancel}
      />
    </PatientShell>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: 64 },
  content: { padding: spacing.marginMobile, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  title: { fontSize: 20, lineHeight: 28, fontWeight: '600', color: guestColors.text },
  reference: { fontSize: 13, lineHeight: 18, color: guestColors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: guestColors.border },
  rowIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: guestColors.primarySoft },
  rowLabel: { fontSize: 11, lineHeight: 16, fontWeight: '600', letterSpacing: 0.4, color: guestColors.textMuted },
  rowValue: { fontSize: 15, lineHeight: 21, color: guestColors.text },
  bottom: { gap: spacing.sm, marginTop: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
  cancelButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: 10, borderWidth: 1, borderColor: guestColors.border, backgroundColor: guestColors.surface },
  cancelText: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: guestColors.error, textAlign: 'center' },
});

export default AppointmentDetailsScreen;
