// One appointment (web: ClinicAppointmentDetailPage): details, quick actions the
// member's permissions allow (each asks first), medical flags and status history.
import React, { useState } from 'react';
import { Linking, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { DetailTile, NoteBox } from '../../components/clinic/ClinicAdminKit';
import { Badge, Button, Card, Field, FormError, LoadState, SelectField, Sheet, ui, useLoader } from '../../components/clinic/ClinicUi';
import { SlotPicker } from '../../components/clinic/SlotPicker';
import { Slot, toBusinessDateKey } from '../../services/booking';
import {
  actionsFor,
  AppointmentAction,
  can,
  fetchAppointment,
  fetchDentists,
  formatDateTime,
  formatPeso,
  reassignAppointment,
  runAppointmentAction,
  saveFrontDeskNotes,
  serverMessage,
  statusLabel,
  clinicDateKey,
} from '../../services/clinicPortal';
import { palette } from '../../theme/tokens';

type Props = { route: { params: { appointmentId: number } } };

const CONFIRMATIONS: Record<string, (name: string) => string> = {
  confirm: (name) => `Confirm this appointment? ${name} will be notified.`,
  'approve-reschedule': (name) => `Move the appointment to the requested time? ${name} will be notified.`,
  'check-in': (name) => `Check in ${name} for this visit?`,
  start: (name) => `Start the visit with ${name}?`,
  complete: () => 'Mark this visit as completed? This cannot be undone.',
  'no-show': (name) => `Mark ${name} as a no-show? This cannot be undone.`,
};

function ReassignForm({ clinicId, currentDentistId, busy, error, onSave }: { clinicId: number; currentDentistId?: number; busy: boolean; error: string | null; onSave: (dentistId: number) => void }) {
  const dentists = useLoader(() => fetchDentists(clinicId), [clinicId], 'Dentists could not be loaded.');
  const [dentistId, setDentistId] = useState<number | null>(null);
  return (
    <>
      <Text style={ui.muted}>Assign a different dentist to this appointment. The time stays the same, so they must be free then.</Text>
      <LoadState loading={dentists.loading} error={dentists.error} onRetry={dentists.reload} />
      <SelectField
        label="Select dentist"
        required
        value={dentistId}
        onChange={setDentistId}
        options={(dentists.data ?? []).filter((d) => d.is_active && d.id !== currentDentistId).map((d) => ({ id: d.id, label: d.name }))}
      />
      <FormError message={error} />
      <Button label="Reassign" style={ui.spacedTop} busy={busy} disabled={!dentistId} onPress={() => dentistId && onSave(dentistId)} />
    </>
  );
}

const DONE_MESSAGES: Record<string, string> = {
  confirm: 'Appointment confirmed.',
  'approve-reschedule': 'Appointment moved to the requested time.',
  'check-in': 'Patient checked in.',
  start: 'Visit started.',
  complete: 'Visit completed.',
  'no-show': 'Status updated to no-show.',
  cancel: 'Appointment cancelled.',
  reject: 'Request cancelled.',
  reschedule: 'Appointment rescheduled.',
};

const ClinicAppointmentDetailScreen = ({ route }: Props) => {
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const { appointmentId } = route.params;
  const detail = useLoader(() => fetchAppointment(clinicId, appointmentId), [clinicId, appointmentId], 'This appointment could not be loaded.');
  const [pending, setPending] = useState<AppointmentAction | null>(null);
  const [reason, setReason] = useState('');
  const [slot, setSlot] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const a = detail.data;
  const isFrontDesk = membership?.role === 'staff';
  const [notes, setNotes] = useState<string | null>(null);
  const [notesBusy, setNotesBusy] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState('');
  const notesValue = notes ?? a?.front_desk_notes ?? '';
  const patientName = a?.patient?.name ?? 'The patient';
  // The front desk design has no reassign: that stays with the clinic admin.
  // A patient cannot arrive for another day's visit, so the desk checks in on the day only.
  const notThisDay = (item: AppointmentAction) => item.action === 'check-in' && Boolean(a?.starts_at) && clinicDateKey(a?.starts_at as string) !== toBusinessDateKey(new Date());
  const actions = a ? actionsFor(membership, a.status).filter((item) => !(isFrontDesk && (item.reassign || notThisDay(item)))) : [];

  const saveNotes = async () => {
    setNotesBusy(true);
    setNotesError(null);
    setNotesSaved(false);
    try {
      await saveFrontDeskNotes(clinicId, appointmentId, notesValue.trim() || null);
      setNotesSaved(true);
    } catch (err) {
      setNotesError(serverMessage(err, 'The notes could not be saved.'));
    } finally {
      setNotesBusy(false);
    }
  };

  const attempt = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setFormError(null);
    try {
      await work();
      setPending(null);
      setReason('');
      setSlot(null);
      await detail.sync();
    } catch (err) {
      setFormError(serverMessage(err, 'That step could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const run = (item: AppointmentAction, body?: Record<string, unknown>) =>
    attempt(async () => {
      await runAppointmentAction(clinicId, appointmentId, item.action, body);
      setDoneMessage(DONE_MESSAGES[item.action] ?? '');
    });

  return (
    <ClinicScreen title="Appointment Details" active="ClinicAppointments" back>
      <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={detail.refreshing} onRefresh={detail.refresh} colors={[palette.primary]} />}>
        <LoadState loading={detail.loading} error={a ? null : detail.error} onRetry={detail.reload} />
        {doneMessage ? <NoteBox tone={isFrontDesk ? 'info' : 'success'}>{doneMessage}</NoteBox> : null}
        {a && (
          <>
            <Card title={a.service?.name ?? 'Appointment'} subtitle={`Appointment #${String(a.id).padStart(6, '0')}`}>
              <View style={ui.rowWrap}>
                <Badge status={a.status} />
                {a.type ? <Badge tone={a.type === 'walk_in' ? 'info' : 'warning'} label={a.type === 'walk_in' ? 'Walk-in' : 'Online'} /> : null}
              </View>
              {a.status === 'reschedule_requested' && a.requested_starts_at ? <NoteBox tone="info">Patient asked to move it to {formatDateTime(a.requested_starts_at)}.</NoteBox> : null}
              <DetailTile icon="person-outline" label="Patient" value={a.patient?.name} />
              <DetailTile icon="medkit-outline" label="Dentist" value={a.dentist?.name} />
              <DetailTile icon="calendar-outline" label="Date and time" value={formatDateTime(a.starts_at)} />
              {isFrontDesk ? null : <DetailTile icon="call-outline" label="Phone" value={a.patient?.phone} />}
              {isFrontDesk ? null : <DetailTile icon="person-outline" label="Patient age" value={a.patient?.age != null ? `${a.patient.age} years old` : null} />}
              {!isFrontDesk && a.patient?.email ? <DetailTile icon="mail-outline" label="Email" value={a.patient.email} /> : null}
              {a.branch ? <DetailTile icon="location-outline" label="Branch" value={`${a.branch.name}${a.branch.address ? ` — ${a.branch.address}` : ''}`} /> : null}
              {!isFrontDesk && a.service?.price != null ? <DetailTile icon="pricetag-outline" label="Price" value={formatPeso(Number(a.service.price))} /> : null}
              {a.notes ? <NoteBox title="Clinical notes">{a.notes}</NoteBox> : null}
              {a.cancellation_reason ? <NoteBox title="Reason given">{a.cancellation_reason}</NoteBox> : null}
              <View style={ui.rowWrap}>
                {a.patient?.phone ? <Button small variant="outline" icon="call-outline" label="Call" onPress={() => Linking.openURL(`tel:${a.patient!.phone}`)} /> : null}
                {a.patient && can(membership, 'patients.view') ? (
                  <Button small variant="tonal" icon="person-outline" label="Patient profile" onPress={() => navigation.navigate('ClinicPatientDetail', { patientId: a.patient!.id })} />
                ) : null}
              </View>
            </Card>

            {actions.length > 0 && (
              <Card title={isFrontDesk ? 'Actions' : 'Quick Actions'}>
                {actions.map((item) => (
                  <Button
                    key={item.action}
                    label={item.label}
                    variant={item.primary ? 'primary' : item.danger ? 'danger' : 'outline'}
                    disabled={busy}
                    onPress={() => {
                      setFormError(null);
                      setPending(item);
                    }}
                  />
                ))}
              </Card>
            )}

            {isFrontDesk && (a.medical_flags ?? []).length > 0 && <NoteBox tone="danger" title="Medical Notes">{(a.medical_flags ?? []).join('\n')}</NoteBox>}

            {isFrontDesk && (
              <Card title="Front-desk Notes">
                <Field
                  label="Scheduling notes (not clinical notes)"
                  multiline
                  maxLength={2000}
                  placeholder="Add scheduling notes (not clinical notes)..."
                  value={notesValue}
                  onChangeText={(value) => {
                    setNotesSaved(false);
                    setNotes(value);
                  }}
                />
                <FormError message={notesError} />
                {notesSaved && <NoteBox tone="info">Notes saved.</NoteBox>}
                {can(membership, 'appointments.manage') && <Button icon="clipboard-outline" label="Save Notes" busy={notesBusy} onPress={saveNotes} />}
              </Card>
            )}

            {isFrontDesk && a.patient && (
              <Card title="Patient Info">
                <Text style={ui.title}>{a.patient.name}</Text>
                {a.patient.age != null || a.patient.gender ? <Text style={ui.small}>{[a.patient.age, a.patient.gender].filter((part) => part != null && part !== '').join(' · ')}</Text> : null}
                <Text style={ui.small}>Phone: {a.patient.phone || '—'}</Text>
                <Text style={ui.small}>Last visit: {a.patient_last_visit_at ? formatDateTime(a.patient_last_visit_at) : 'No visits yet'}</Text>
              </Card>
            )}

            {can(membership, 'records.view') && (
              <Card title="Patient Medical Flags">
                {(a.medical_flags ?? []).length > 0 ? (a.medical_flags ?? []).map((flag) => <NoteBox key={flag}>{flag}</NoteBox>) : <Text style={ui.muted}>No medical flags recorded.</Text>}
              </Card>
            )}

            {!isFrontDesk && (a.status_history ?? []).length > 0 && (
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
          {pending.reassign ? (
            <ReassignForm clinicId={clinicId} currentDentistId={a.dentist?.id} busy={busy} error={formError} onSave={(dentistId) => attempt(() => reassignAppointment(clinicId, appointmentId, dentistId))} />
          ) : pending.reason ? (
            <>
              <Field label="Reason (shared with the patient)" value={reason} onChangeText={setReason} multiline required maxLength={500} />
              <FormError message={formError} />
              <Button label={pending.label} variant="danger" style={ui.spacedTop} busy={busy} disabled={!reason.trim()} onPress={() => run(pending, { reason: reason.trim() })} />
            </>
          ) : pending.slot ? (
            a.service && a.dentist ? (
              <>
                <Text style={ui.muted}>
                  Open times for {a.dentist.name} · {a.service.name}
                </Text>
                <SlotPicker clinicId={clinicId} serviceRateId={a.service.id} dentistId={a.dentist.id} selected={slot} onSelect={setSlot} />
                <Field label="Reason (optional)" value={reason} onChangeText={setReason} multiline maxLength={500} />
                <FormError message={formError} />
                <Button
                  label={slot ? `Move to ${formatDateTime(slot.startsAt)}` : 'Choose a time'}
                  style={ui.spacedTop}
                  busy={busy}
                  disabled={!slot}
                  onPress={() => slot && run(pending, { starts_at: slot.startsAt, reason: reason.trim() || undefined })}
                />
              </>
            ) : (
              <Text style={ui.muted}>This appointment has no dentist or service to find open times for.</Text>
            )
          ) : (
            <>
              <Text style={ui.muted}>{(CONFIRMATIONS[pending.action] ?? (() => 'Continue?'))(patientName)}</Text>
              <FormError message={formError} />
              <Button label={pending.label} variant={pending.action === 'no-show' ? 'danger' : 'primary'} style={ui.spacedTop} busy={busy} onPress={() => run(pending)} />
            </>
          )}
        </Sheet>
      )}
    </ClinicScreen>
  );
};

export default ClinicAppointmentDetailScreen;
