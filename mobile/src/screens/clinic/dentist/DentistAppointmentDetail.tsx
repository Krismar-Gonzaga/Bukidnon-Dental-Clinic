// Appointment Details (web: DentistAppointmentDetail): the visit, what could go wrong, the note.
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { ClinicScreen } from '../../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../../components/clinic/ClinicPortalContext';
import { DetailTile, NoteBox } from '../../../components/clinic/ClinicAdminKit';
import { Badge, Button, Card, Field, FormError, LoadState, Sheet, ui, useLoader, useRefreshOnFocus } from '../../../components/clinic/ClinicUi';
import { toBusinessDateKey } from '../../../services/booking';
import { runAppointmentAction, serverMessage } from '../../../services/clinicPortal';
import { fetchAppointmentDetail, saveTreatmentNotes } from '../../../services/dentistPortal';
import { palette, radius, spacing } from '../../../theme/tokens';
import { dayKey, dayOfIso, PatientLine, statusBadge, timeOf } from './dentistKit';

type Pending = 'confirm' | 'reject' | 'start' | 'complete';

const QUESTIONS: Record<Pending, { title: string; message: string; label: string; danger?: boolean }> = {
  confirm: { title: 'Confirm appointment', message: 'The patient will be notified.', label: 'Confirm appointment' },
  reject: { title: 'Decline request', message: 'The patient will be told the reason.', label: 'Decline request', danger: true },
  start: { title: 'Start this visit?', message: 'The patient will be checked in and the visit marked as ongoing.', label: 'Start Visit' },
  complete: { title: 'Mark as completed?', message: 'The patient will be able to leave a review of this visit.', label: 'Mark as Completed' },
};

const DentistAppointmentDetail = ({ route }: { route: { params: { appointmentId: number } } }) => {
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const { appointmentId } = route.params;
  const detail = useLoader(() => fetchAppointmentDetail(clinicId, appointmentId), [clinicId, appointmentId], 'This appointment could not be loaded.');
  useRefreshOnFocus(detail.sync);
  const a = detail.data;
  const [notes, setNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setNotes(a?.treatment_notes ?? ''), [a?.treatment_notes]);

  const patientId = a?.patient?.id;
  const snapshot = a?.patient_snapshot;
  const isToday = a?.starts_at ? dayKey(a.starts_at) === toBusinessDateKey(new Date()) : false;

  const saveNotes = async () => {
    setIsSavingNotes(true);
    setNotesSaved(false);
    setNotesError(null);
    try {
      await saveTreatmentNotes(clinicId, appointmentId, notes);
      setNotesSaved(true);
    } catch (err) {
      setNotesError(serverMessage(err, 'Your notes could not be saved.'));
    } finally {
      setIsSavingNotes(false);
    }
  };

  const run = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await runAppointmentAction(clinicId, appointmentId, pending, pending === 'reject' ? { reason: reason.trim() } : undefined);
      setPending(null);
      setReason('');
      detail.sync();
    } catch (err) {
      setError(serverMessage(err, 'That could not be done.'));
    } finally {
      setBusy(false);
    }
  };

  const status = a ? statusBadge(a.status) : null;

  return (
    <ClinicScreen title="Appointment Details" active="ClinicAppointments" back>
      <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={detail.refreshing} onRefresh={detail.refresh} />}>
        <LoadState loading={detail.loading} error={detail.error} onRetry={detail.reload} />
        {a && status && (
          <>
            <Card title={a.service?.name ?? 'Appointment'} subtitle={`Appointment #${a.id}`}>
              <View style={styles.pills}>
                <Badge label={status.label} tone={status.tone} />
                <Badge label={a.type === 'walk_in' ? 'Walk-in' : 'Scheduled'} tone="warning" />
              </View>
              <DetailTile icon="person-outline" label="Patient" value={a.patient?.name} />
              <DetailTile icon="calendar-outline" label="Date" value={dayOfIso(a.starts_at)} />
              <DetailTile icon="time-outline" label="Time" value={timeOf(a.starts_at)} />
              <DetailTile icon="call-outline" label="Phone" value={a.patient?.phone} />
              <DetailTile icon="pulse-outline" label="Age" value={a.patient?.age != null ? `${a.patient.age} years old` : null} />
              <DetailTile icon="heart-outline" label="Blood Type" value={snapshot?.blood_type} />
            </Card>

            {(snapshot?.conditions || snapshot?.allergies) && (
              <NoteBox tone="danger" title="Medical Alerts">
                {[snapshot.conditions ? `Conditions: ${snapshot.conditions}` : null, snapshot.allergies ? `Allergies: ${snapshot.allergies}` : null].filter(Boolean).join('\n')}
              </NoteBox>
            )}

            <Card title="Actions">
              <View style={styles.actions}>
                {a.status === 'pending' && (
                  <>
                    <Button icon="checkmark-circle-outline" label="Confirm" onPress={() => setPending('confirm')} />
                    <Button variant="outline" label="Decline" onPress={() => setPending('reject')} />
                  </>
                )}
                {isToday && ['confirmed', 'checked_in'].includes(a.status) && <Button icon="pulse-outline" label="Start Visit" onPress={() => setPending('start')} />}
                {a.status === 'in_progress' && <Button icon="checkmark-circle-outline" label="Mark as Completed" onPress={() => setPending('complete')} />}
                {patientId && (
                  <>
                    <Button variant="outline" icon="person-outline" label="Patient Profile" onPress={() => navigation.navigate('ClinicPatientDetail', { patientId })} />
                    <Button variant="outline" icon="pulse-outline" label="Dental Chart" onPress={() => navigation.navigate('ClinicDentalChart', { patientId })} />
                    <Button variant="outline" icon="camera-outline" label="Imaging" onPress={() => navigation.navigate('ClinicImaging', { patientId })} />
                  </>
                )}
              </View>
            </Card>

            <Card title="Treatment Notes">
              <Field label="Notes on this visit" multiline maxLength={5000} value={notes} onChangeText={(text) => { setNotes(text); setNotesSaved(false); }} />
              <FormError message={notesError} />
              {notesSaved && (
                <View style={styles.saved}>
                  <Icon name="checkmark-circle" size={16} color={palette.primary} />
                  <Text style={styles.savedText}>Notes saved</Text>
                </View>
              )}
              <View style={styles.actions}>
                <Button icon="clipboard-outline" label="Save Notes" busy={isSavingNotes} onPress={saveNotes} />
                {patientId && <Button variant="outline" icon="book-outline" label="Prescribe" onPress={() => navigation.navigate('ClinicPrescriptions', { newForPatient: patientId })} />}
              </View>
            </Card>

            {snapshot && (
              <Card title="Patient Snapshot">
                <PatientLine name={a.patient?.name} sub={[a.patient?.age, a.patient?.gender, snapshot.blood_type].filter(Boolean).join(' · ')} />
                <Text style={styles.line}><Text style={styles.bold}>Visits: </Text>{snapshot.visits}</Text>
                <Text style={styles.line}><Text style={styles.bold}>Last visit: </Text>{a.patient_last_visit_at ? dayOfIso(a.patient_last_visit_at) : 'None yet'}</Text>
                <Text style={[styles.line, snapshot.allergies ? styles.danger : null]}><Text style={styles.bold}>Allergies: </Text>{snapshot.allergies || 'None on record'}</Text>
                <Text style={[styles.line, snapshot.conditions ? styles.warning : null]}><Text style={styles.bold}>Conditions: </Text>{snapshot.conditions || 'None on record'}</Text>
              </Card>
            )}
          </>
        )}
      </ScrollView>

      {pending && (
        <Sheet title={QUESTIONS[pending].title} onClose={() => setPending(null)}>
          <Text style={ui.muted}>{QUESTIONS[pending].message}</Text>
          {pending === 'reject' && <Field label="Reason" required multiline maxLength={500} value={reason} onChangeText={setReason} />}
          <FormError message={error} />
          <Button label={QUESTIONS[pending].label} variant={QUESTIONS[pending].danger ? 'danger' : 'primary'} style={ui.spacedTop} busy={busy} disabled={pending === 'reject' && !reason.trim()} onPress={run} />
        </Sheet>
      )}
    </ClinicScreen>
  );
};

export default DentistAppointmentDetail;

const styles = StyleSheet.create({
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.xs },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: spacing.sm, marginVertical: spacing.xs, borderRadius: radius.sm, backgroundColor: palette.primaryFixed },
  savedText: { fontSize: 13, color: palette.primary, fontWeight: '600' },
  line: { fontSize: 13, color: palette.onSurfaceVariant, marginTop: spacing.xs },
  bold: { fontWeight: '600', color: palette.onSurface },
  danger: { color: palette.error },
  warning: { color: '#c2410c' },
});
