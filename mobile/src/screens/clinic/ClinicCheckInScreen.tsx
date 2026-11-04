// Patient Check-in & Queue (web: ClinicCheckInPage): four steps to check a
// patient in, and who is already waiting.
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { InitialsTile, NoteBox, StatRow, SuccessBlock } from '../../components/clinic/ClinicAdminKit';
import { Badge, Button, Card, EmptyState, FormError, LoadState, SearchBox, ui, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import { formatClockTime, toBusinessDateKey } from '../../services/booking';
import {
  ClinicAppointment,
  ClinicPatient,
  clinicClock,
  fetchAppointment,
  fetchAppointments,
  fetchCheckInQueue,
  fetchPatients,
  formatDateTime,
  frontDeskStatus,
  runAppointmentAction,
  serverMessage,
} from '../../services/clinicPortal';
import { palette, radius, spacing } from '../../theme/tokens';

const STEPS = ['Search Patient', 'Select Appointment', 'Confirm Details', 'Check In'];

function Steps({ current }: { current: number }) {
  return (
    <View style={styles.steps} accessibilityLabel={`Step ${current + 1} of ${STEPS.length}: ${STEPS[current]}`}>
      {STEPS.map((label, index) => {
        const done = index < current || current === STEPS.length - 1;
        const on = index <= current;
        return (
          <View key={label} style={styles.stepItem}>
            <View style={[styles.stepDot, on && styles.stepDotOn, done && styles.stepDotDone]}>
              {done ? <Icon name="checkmark" size={14} color={palette.onPrimary} /> : <Text style={[styles.stepNumber, on && styles.stepNumberOn]}>{index + 1}</Text>}
            </View>
            {index < STEPS.length - 1 && <View style={[styles.stepLine, index < current && styles.stepLineOn]} />}
          </View>
        );
      })}
    </View>
  );
}

function SearchStep({ clinicId, onPick }: { clinicId: number; onPick: (patient: ClinicPatient) => void }) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<ClinicPatient[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) {
      setResults(null);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchPatients(clinicId, { search: query, per_page: 6 })
        .then((page) => {
          if (cancelled) return;
          setResults(page.items);
          setError(null);
        })
        .catch((err) => !cancelled && setError(serverMessage(err, 'The search could not run.')));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [clinicId, term]);

  return (
    <>
      <SearchBox value={term} onChangeText={setTerm} placeholder="Search patient by name or phone..." />
      <FormError message={error} />
      {results?.length === 0 && <Text style={ui.muted}>No patient found.</Text>}
      {results?.map((patient) => (
        <TouchableOpacity key={patient.id} style={styles.pick} onPress={() => onPick(patient)} accessibilityRole="button" accessibilityLabel={`Choose ${patient.name}`}>
          <InitialsTile name={patient.name} />
          <View style={ui.flex}>
            <Text style={ui.title}>{patient.name}</Text>
            {patient.phone ? <Text style={ui.small}>{patient.phone}</Text> : null}
          </View>
          <Icon name="chevron-forward" size={18} color={palette.outline} />
        </TouchableOpacity>
      ))}
    </>
  );
}

function SelectStep({ clinicId, patient, onPick, onBack }: { clinicId: number; patient: ClinicPatient; onPick: (appointment: ClinicAppointment) => void; onBack: () => void }) {
  const today = toBusinessDateKey(new Date());
  const list = useLoader(() => fetchAppointments(clinicId, { patient_id: patient.id, from: today, to: today, per_page: 20 }), [clinicId, patient.id, today], "This patient's appointments could not be loaded.");
  return (
    <>
      <View style={styles.selected}>
        <InitialsTile name={patient.name} />
        <View style={ui.flex}>
          <Text style={ui.title}>{patient.name}</Text>
          {patient.phone ? <Text style={ui.small}>{patient.phone}</Text> : null}
        </View>
      </View>
      <Text style={ui.title}>Select appointment for today:</Text>
      <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
      {list.data?.items.length === 0 && <EmptyState icon="calendar-outline" text="No appointment today for this patient." />}
      {list.data?.items.map((a) => {
        const status = frontDeskStatus(a.status);
        // The server only checks in confirmed appointments.
        const ready = a.status === 'confirmed';
        return (
          <TouchableOpacity key={a.id} style={[styles.pick, !ready && styles.pickOff]} disabled={!ready} onPress={() => onPick(a)} accessibilityRole="button" accessibilityState={{ disabled: !ready }}>
            <Icon name="calendar-outline" size={20} color={palette.primary} />
            <View style={ui.flex}>
              <Text style={ui.title}>{a.service?.name}</Text>
              <Text style={ui.small}>
                {a.starts_at ? formatClockTime(clinicClock(a.starts_at)) : ''} · {a.dentist?.name}
              </Text>
            </View>
            <Badge tone={status.tone} label={status.label} />
          </TouchableOpacity>
        );
      })}
      <Button small variant="outline" icon="arrow-back" label="Search again" onPress={onBack} />
    </>
  );
}

function ConfirmStep({ clinicId, appointmentId, onDone, onBack }: { clinicId: number; appointmentId: number; onDone: (appointment: ClinicAppointment) => void; onBack: () => void }) {
  const detail = useLoader(() => fetchAppointment(clinicId, appointmentId), [clinicId, appointmentId], 'The appointment could not be loaded.');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const a = detail.data;

  const checkIn = async () => {
    if (!a) return;
    setBusy(true);
    setError(null);
    try {
      await runAppointmentAction(clinicId, appointmentId, 'check-in');
      onDone(a);
    } catch (err) {
      setError(serverMessage(err, 'The patient could not be checked in.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <LoadState loading={detail.loading} error={a ? null : detail.error} onRetry={detail.reload} />
      {a && (
        <>
          <Text style={ui.title}>Confirm patient and appointment details:</Text>
          <StatRow label="Patient" value={a.patient?.name} />
          <StatRow label="Age/Sex" value={[a.patient?.age, a.patient?.gender].filter((part) => part != null && part !== '').join(' · ')} />
          <StatRow label="Service" value={a.service?.name} />
          <StatRow label="Dentist" value={a.dentist?.name} />
          <StatRow label="Date and time" value={formatDateTime(a.starts_at)} />
          {(a.medical_flags ?? []).length > 0 && <NoteBox tone="danger" title="Medical Notes">{(a.medical_flags ?? []).join('. ')}</NoteBox>}
          <FormError message={error} />
          <Button icon="person-outline" label="Check In Patient" busy={busy} onPress={checkIn} />
          <Button variant="outline" label="Back" disabled={busy} onPress={onBack} />
        </>
      )}
    </>
  );
}

const ClinicCheckInScreen = () => {
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const queue = useLoader(() => fetchCheckInQueue(clinicId), [clinicId], 'The waiting queue could not be loaded.');
  useRefreshOnFocus(queue.sync);
  const [step, setStep] = useState(0);
  const [patient, setPatient] = useState<ClinicPatient | null>(null);
  const [appointmentId, setAppointmentId] = useState<number | null>(null);
  const [done, setDone] = useState<ClinicAppointment | null>(null);
  const queueNumber = done ? queue.data?.find((entry) => entry.id === done.id)?.queue_number : undefined;

  const restart = () => {
    setStep(0);
    setPatient(null);
    setAppointmentId(null);
    setDone(null);
  };

  return (
    <ClinicScreen title="Check-in & Queue" active="ClinicCheckIn">
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={queue.refreshing} onRefresh={queue.refresh} colors={[palette.primary]} />}>
        <Card title="Check In a Patient" subtitle={STEPS[step]}>
          <Steps current={step} />
          {step === 0 && (
            <SearchStep
              clinicId={clinicId}
              onPick={(picked) => {
                setPatient(picked);
                setStep(1);
              }}
            />
          )}
          {step === 1 && patient && (
            <SelectStep
              clinicId={clinicId}
              patient={patient}
              onBack={restart}
              onPick={(a) => {
                setAppointmentId(a.id);
                setStep(2);
              }}
            />
          )}
          {step === 2 && appointmentId && (
            <ConfirmStep
              clinicId={clinicId}
              appointmentId={appointmentId}
              onBack={() => setStep(1)}
              onDone={(a) => {
                setDone(a);
                setStep(3);
                queue.sync();
              }}
            />
          )}
          {step === 3 && done && (
            <SuccessBlock navy title="Check-in Successful!" action={<Button label="Check In Another Patient" onPress={restart} />}>
              <Text style={[ui.muted, styles.center]}>{done.patient?.name} has been checked in.</Text>
              <Text style={[ui.muted, styles.center]}>{[queueNumber ? `Queue #${queueNumber}` : null, done.service?.name, done.dentist?.name].filter(Boolean).join(' · ')}</Text>
            </SuccessBlock>
          )}
        </Card>

        <Card title="Waiting Queue">
          <LoadState loading={queue.loading} error={queue.data ? null : queue.error} onRetry={queue.reload} />
          {queue.data?.length === 0 && <Text style={ui.muted}>Nobody is waiting.</Text>}
          {queue.data?.map((entry) => {
            const serving = entry.status === 'in_progress';
            return (
              <View key={entry.id} style={[styles.queue, serving && styles.queueServing]}>
                <View style={ui.row}>
                  <View style={[styles.number, serving && styles.numberServing]}>
                    <Text style={[styles.numberText, serving && styles.numberTextServing]}>#{entry.queue_number}</Text>
                  </View>
                  <View style={ui.flex}>
                    <Text style={ui.title}>{entry.patient}</Text>
                    <Text style={ui.small}>{entry.service}</Text>
                  </View>
                  {serving ? <Badge tone="info" label="Serving" /> : null}
                </View>
                <View style={ui.between}>
                  <Text style={ui.small}>Since {formatClockTime(clinicClock(entry.checked_in_at))}</Text>
                  <Text style={ui.small}>{entry.dentist}</Text>
                </View>
              </View>
            );
          })}
        </Card>
      </ScrollView>
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
  steps: { flexDirection: 'row', alignItems: 'center' },
  stepItem: { flexDirection: 'row', alignItems: 'center', flexGrow: 1 },
  stepDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: palette.outlineVariant, alignItems: 'center', justifyContent: 'center' },
  stepDotOn: { borderColor: palette.primary },
  stepDotDone: { backgroundColor: palette.primary },
  stepNumber: { fontSize: 12, fontWeight: '600', color: palette.outline },
  stepNumberOn: { color: palette.primary },
  stepLine: { flex: 1, height: 1, marginHorizontal: spacing.xs, backgroundColor: palette.outlineVariant },
  stepLineOn: { backgroundColor: palette.primary },
  pick: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.xl, borderWidth: 1, borderColor: palette.surfaceContainerHigh, backgroundColor: palette.surface },
  pickOff: { opacity: 0.7 },
  selected: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.xl, backgroundColor: palette.primaryFixed },
  queue: { padding: spacing.sm, borderRadius: radius.xl, borderWidth: 1, borderColor: palette.surfaceContainerHigh, gap: spacing.xs },
  queueServing: { borderColor: palette.primaryFixedDim, backgroundColor: palette.primaryFixed },
  number: { minWidth: 34, height: 30, paddingHorizontal: 4, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.primaryFixed },
  numberServing: { backgroundColor: palette.primary },
  numberText: { fontSize: 12, fontWeight: '700', color: palette.primary },
  numberTextServing: { color: palette.onPrimary },
});

export default ClinicCheckInScreen;
