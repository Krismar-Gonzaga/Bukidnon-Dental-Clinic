// One clinic patient (web: ClinicPatientDetailPage): details, appointments
// (with booking for receptionists), medical history and clinical records.
// Records are append-only; corrections are added as amendments. Viewing
// history and records is logged by the server and needs records.view.
import React, { useState } from 'react';
import { Alert, Linking, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import {
  Badge,
  Button,
  Card,
  Chips,
  EmptyState,
  Field,
  FormError,
  InfoRow,
  LoadState,
  SelectField,
  Sheet,
  Toggle,
  ui,
  useLoader,
  useRefreshOnFocus,
} from '../../components/clinic/ClinicUi';
import { DateField } from '../../components/clinic/DateField';
import { SlotPicker } from '../../components/clinic/SlotPicker';
import { blankRecord, RecordForm, recordBody, RecordSheet } from '../../components/clinic/RecordSheet';
import { AppointmentRow } from './ClinicAppointmentsScreen';
import { GENDERS } from './ClinicPatientsScreen';
import { formatDateKey, Slot } from '../../services/booking';
import {
  addMedicalHistory,
  amendRecord,
  bookForPatient,
  can,
  ClinicPatient,
  createRecord,
  fetchAppointments,
  fetchDentists,
  fetchMedicalHistory,
  fetchPatient,
  fetchRecords,
  fetchServices,
  formatDateTime,
  Membership,
  PatientRecord,
  recordTypeLabel,
  serverMessage,
  updatePatient,
} from '../../services/clinicPortal';
import { palette } from '../../theme/tokens';

type Tab = 'details' | 'appointments' | 'history' | 'records';

// ---------------------------------------------------------------- Details
function EditPatientSheet({ clinicId, patient, onClose, onSaved }: { clinicId: number; patient: ClinicPatient; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    full_name: patient.name ?? '',
    email: patient.email ?? '',
    phone: patient.phone ?? '',
    birth_date: patient.birth_date ?? '',
    gender: patient.gender ?? '',
    address: patient.address ?? '',
    emergency_contact_name: patient.emergency_contact_name ?? '',
    emergency_contact_phone: patient.emergency_contact_phone ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bind = (name: keyof typeof form) => ({ value: form[name], onChangeText: (v: string) => setForm((f) => ({ ...f, [name]: v })) });

  const save = async () => {
    setBusy(true);
    setError(null);
    // Name and email of patients with their own account belong to that account.
    const { full_name, email, ...rest } = form;
    const body = patient.has_portal_account ? rest : { full_name, email, ...rest };
    try {
      await updatePatient(clinicId, patient.id, Object.fromEntries(Object.entries(body).map(([k, v]) => [k, v === '' ? null : v])));
      onSaved();
    } catch (err) {
      setError(serverMessage(err, 'The changes could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Edit patient details" onClose={onClose}>
      {!patient.has_portal_account && <Field label="Full name" required autoCapitalize="words" {...bind('full_name')} />}
      {!patient.has_portal_account && <Field label="Email" keyboardType="email-address" autoCapitalize="none" {...bind('email')} />}
      <Field label="Phone" keyboardType="phone-pad" {...bind('phone')} />
      <DateField label="Date of birth" value={form.birth_date} onChange={(v) => setForm((f) => ({ ...f, birth_date: v }))} clearable />
      <Text style={[ui.small, ui.spacedTop]}>Gender</Text>
      <Chips options={GENDERS} value={form.gender} onChange={(gender) => setForm((f) => ({ ...f, gender }))} scroll={false} />
      <Field label="Address" {...bind('address')} />
      <Field label="Emergency contact" {...bind('emergency_contact_name')} />
      <Field label="Emergency phone" keyboardType="phone-pad" {...bind('emergency_contact_phone')} />
      <FormError message={error} />
      <Button label="Save changes" style={ui.spacedTop} busy={busy} onPress={save} />
    </Sheet>
  );
}

function Details({ clinicId, patient, membership, onChanged }: { clinicId: number; patient: ClinicPatient; membership?: Membership; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const gender = GENDERS.find((g) => g.id === patient.gender)?.label;
  return (
    <Card
      title={patient.name}
      subtitle={patient.has_portal_account ? 'Has a patient portal account' : 'Walk-in patient (no portal account)'}
      action={can(membership, 'patients.manage') ? <Button small variant="outline" icon="create-outline" label="Edit" onPress={() => setEditing(true)} /> : undefined}
    >
      <InfoRow label="Phone" value={patient.phone} />
      <InfoRow label="Email" value={patient.email} />
      <InfoRow label="Date of birth" value={patient.birth_date ? formatDateKey(patient.birth_date, { month: 'long', day: 'numeric', year: 'numeric' }) : null} />
      <InfoRow label="Gender" value={patient.gender ? gender : null} />
      <InfoRow label="Address" value={patient.address} />
      <InfoRow label="Emergency contact" value={[patient.emergency_contact_name, patient.emergency_contact_phone].filter(Boolean).join(' · ')} />
      {patient.phone ? <Button small variant="tonal" icon="call-outline" label="Call patient" onPress={() => Linking.openURL(`tel:${patient.phone}`)} /> : null}
      {editing && (
        <EditPatientSheet
          clinicId={clinicId}
          patient={patient}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Appointments and booking
function BookSheet({ clinicId, patient, onClose, onBooked }: { clinicId: number; patient: ClinicPatient; onClose: () => void; onBooked: () => void }) {
  const options = useLoader(() => Promise.all([fetchDentists(clinicId), fetchServices(clinicId)]), [clinicId], 'Dentists and services could not be loaded.');
  const [dentistId, setDentistId] = useState<number | null>(null);
  const [serviceRateId, setServiceRateId] = useState<number | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dentists, services] = options.data ?? [[], []];

  const book = async () => {
    if (!slot || !dentistId || !serviceRateId) return;
    setBusy(true);
    setError(null);
    try {
      await bookForPatient(clinicId, {
        patient_id: patient.id,
        service_rate_id: serviceRateId,
        dentist_id: dentistId,
        branch_id: slot.branchId,
        starts_at: slot.startsAt,
      });
      onBooked();
    } catch (err) {
      setError(serverMessage(err, 'The appointment could not be booked. The time may have just been taken.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={`Book for ${patient.name}`} onClose={onClose}>
      <LoadState loading={options.loading} error={options.error} onRetry={options.reload} />
      {options.data && (
        <>
          <SelectField
            label="Dentist"
            required
            value={dentistId}
            onChange={(id) => {
              setDentistId(id);
              setSlot(null);
            }}
            options={dentists.filter((d) => d.is_active).map((d) => ({ id: d.id, label: d.name }))}
          />
          <SelectField
            label="Service"
            required
            value={serviceRateId}
            onChange={(id) => {
              setServiceRateId(id);
              setSlot(null);
            }}
            options={services.filter((s) => s.is_available).map((s) => ({ id: s.id, label: `${s.name} (${s.duration_minutes} min)` }))}
          />
          {dentistId && serviceRateId ? (
            <SlotPicker clinicId={clinicId} dentistId={dentistId} serviceRateId={serviceRateId} selected={slot} onSelect={setSlot} />
          ) : (
            <Text style={[ui.muted, ui.spacedTop]}>Choose a dentist and a service to see open times.</Text>
          )}
          <FormError message={error} />
          <Button label={slot ? `Book ${formatDateTime(slot.startsAt)}` : 'Choose a time'} style={ui.spacedTop} busy={busy} disabled={!slot} onPress={book} />
        </>
      )}
    </Sheet>
  );
}

function Appointments({ clinicId, patient, membership }: { clinicId: number; patient: ClinicPatient; membership?: Membership }) {
  const navigation = useNavigation<any>();
  const list = useLoader(() => fetchAppointments(clinicId, { patient_id: patient.id, per_page: 50 }), [clinicId, patient.id], 'Appointments could not be loaded.');
  useRefreshOnFocus(list.sync);
  const [booking, setBooking] = useState(false);
  const canBook = can(membership, 'appointments.manage');
  const canOpen = can(membership, 'appointments.view_all', 'appointments.view_assigned');

  return (
    <Card title="Appointments" action={canBook ? <Button small variant="tonal" icon="add" label="Book" onPress={() => setBooking(true)} /> : undefined}>
      <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
      {list.data && list.data.items.length === 0 && <EmptyState icon="calendar-outline" text="No appointments yet." />}
      {(list.data?.items ?? []).map((a) => (
        <AppointmentRow
          key={a.id}
          appointment={a}
          showPatient={false}
          onPress={() => canOpen && navigation.navigate('ClinicAppointmentDetail', { appointmentId: a.id })}
        />
      ))}
      {booking && (
        <BookSheet
          clinicId={clinicId}
          patient={patient}
          onClose={() => setBooking(false)}
          onBooked={() => {
            setBooking(false);
            list.sync();
            Alert.alert('Appointment booked', 'It now appears in this patient’s appointments.');
          }}
        />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Medical history
function MedicalHistory({ clinicId, patient, membership }: { clinicId: number; patient: ClinicPatient; membership?: Membership }) {
  const history = useLoader(() => fetchMedicalHistory(clinicId, patient.id), [clinicId, patient.id], 'Medical history could not be loaded.');
  const [editing, setEditing] = useState(false);
  const current = history.data?.current;
  const [form, setForm] = useState({ allergies: '', medications: '', conditions: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bind = (name: keyof typeof form) => ({ value: form[name], onChangeText: (v: string) => setForm((f) => ({ ...f, [name]: v })) });

  const startEdit = () => {
    setForm({
      allergies: current?.allergies ?? '',
      medications: current?.medications ?? '',
      conditions: current?.conditions ?? '',
      notes: current?.notes ?? '',
    });
    setError(null);
    setEditing(true);
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await addMedicalHistory(clinicId, patient.id, Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null])));
      setEditing(false);
      history.sync();
    } catch (err) {
      setError(serverMessage(err, 'Medical history could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card
      title="Medical history"
      subtitle="Each update is kept; the newest entry is current."
      action={can(membership, 'records.write') ? <Button small variant="tonal" icon="create-outline" label="Update" onPress={startEdit} /> : undefined}
    >
      <LoadState loading={history.loading} error={history.error} onRetry={history.reload} />
      {history.data &&
        (current ? (
          <>
            <InfoRow label="Allergies" value={current.allergies} />
            <InfoRow label="Medications" value={current.medications} />
            <InfoRow label="Conditions" value={current.conditions} />
            <InfoRow label="Clinic notes" value={current.notes} />
            <Text style={ui.small}>
              {formatDateTime(current.recorded_at)} by {current.recorded_by ?? '—'}
            </Text>
            {history.data.history.length > 0 && <Text style={ui.small}>{history.data.history.length} earlier version(s) kept.</Text>}
          </>
        ) : (
          <EmptyState icon="medkit-outline" text="Nothing recorded yet." />
        ))}
      {editing && (
        <Sheet title="Update medical history" onClose={() => setEditing(false)}>
          <Field label="Allergies" multiline {...bind('allergies')} />
          <Field label="Medications" multiline {...bind('medications')} />
          <Field label="Conditions" multiline {...bind('conditions')} />
          <Field label="Clinic notes (not shown to the patient)" multiline {...bind('notes')} />
          <FormError message={error} />
          <Button label="Save" style={ui.spacedTop} busy={busy} onPress={save} />
        </Sheet>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Clinical records
function Records({ clinicId, patient, membership }: { clinicId: number; patient: ClinicPatient; membership?: Membership }) {
  const [showCorrected, setShowCorrected] = useState(false);
  const records = useLoader(() => fetchRecords(clinicId, patient.id, showCorrected), [clinicId, patient.id, showCorrected], 'Records could not be loaded.');
  const [sheet, setSheet] = useState<{ record?: PatientRecord } | null>(null);
  const canWrite = can(membership, 'records.write');

  const save = async (form: RecordForm) => {
    if (sheet?.record) await amendRecord(clinicId, patient.id, sheet.record.id, recordBody(form, true));
    else await createRecord(clinicId, patient.id, recordBody(form, false));
    setSheet(null);
    records.sync();
  };

  return (
    <Card
      title="Clinical records"
      subtitle="Viewing is logged. Records cannot be edited or deleted; corrections are added as amendments."
      action={canWrite ? <Button small variant="tonal" icon="add" label="Add" onPress={() => setSheet({})} /> : undefined}
    >
      <Toggle label="Show corrected versions" value={showCorrected} onChange={setShowCorrected} />
      <LoadState loading={records.loading} error={records.error} onRetry={records.reload} />
      {records.data && records.data.length === 0 && <EmptyState icon="document-text-outline" text="No clinical records yet." />}
      {(records.data ?? []).map((r) => (
        <View key={r.id} style={ui.listItem}>
          <View style={ui.between}>
            <Text style={[ui.title, ui.flex]}>{recordTypeLabel(r.record_type)}</Text>
            {r.superseded_at ? <Badge tone="warning" label="Corrected" /> : null}
            {r.amends_record_id ? <Badge tone="info" label="Correction" /> : null}
          </View>
          <Text style={ui.small}>
            {formatDateTime(r.created_at)} · {r.dentist ?? r.author ?? '—'}
            {r.is_patient_visible ? ' · shared with patient' : ''}
          </Text>
          {r.tooth_numbers ? <InfoRow label="Teeth" value={r.tooth_numbers} /> : null}
          {r.chief_complaint ? <InfoRow label="Complaint" value={r.chief_complaint} /> : null}
          {r.findings ? <InfoRow label="Findings" value={r.findings} /> : null}
          {r.procedures ? <InfoRow label="Procedures" value={r.procedures} /> : null}
          {r.notes ? <InfoRow label="Internal notes" value={r.notes} /> : null}
          {r.care_instructions ? <InfoRow label="Care" value={r.care_instructions} /> : null}
          {r.amendment_reason ? <InfoRow label="Correction reason" value={r.amendment_reason} /> : null}
          {canWrite && !r.superseded_at && <Button small variant="outline" label="Correct this record" onPress={() => setSheet({ record: r })} />}
        </View>
      ))}
      {sheet && (
        <RecordSheet
          amending={Boolean(sheet.record)}
          patientName={patient.name}
          initial={
            sheet.record
              ? {
                  ...blankRecord,
                  record_type: sheet.record.record_type,
                  tooth_numbers: sheet.record.tooth_numbers ?? '',
                  chief_complaint: sheet.record.chief_complaint ?? '',
                  findings: sheet.record.findings ?? '',
                  procedures: sheet.record.procedures ?? '',
                  notes: sheet.record.notes ?? '',
                  care_instructions: sheet.record.care_instructions ?? '',
                  is_patient_visible: sheet.record.is_patient_visible,
                }
              : blankRecord
          }
          onClose={() => setSheet(null)}
          onSave={save}
        />
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- Screen
const ClinicPatientDetailScreen = ({ route }: { route: { params: { patientId: number } } }) => {
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const { patientId } = route.params;
  const patient = useLoader(() => fetchPatient(clinicId, patientId), [clinicId, patientId], 'This patient could not be loaded.');
  const canRecords = can(membership, 'records.view');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'details', label: 'Details' },
    { id: 'appointments', label: 'Appointments' },
    ...(canRecords
      ? [
          { id: 'history' as Tab, label: 'Medical history' },
          { id: 'records' as Tab, label: 'Records' },
        ]
      : []),
  ];
  const [tab, setTab] = useState<Tab>('details');
  const p = patient.data;

  return (
    <ClinicScreen title={p?.name ?? 'Patient'} active="ClinicPatients" back>
      <ScrollView
        contentContainerStyle={ui.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={patient.refreshing} onRefresh={patient.refresh} colors={[palette.primary]} />}
      >
        <LoadState loading={patient.loading} error={p ? null : patient.error} onRetry={patient.reload} />
        {p && (
          <>
            <Chips options={tabs} value={tab} onChange={setTab} />
            {tab === 'details' && <Details clinicId={clinicId} patient={p} membership={membership} onChanged={patient.sync} />}
            {tab === 'appointments' && <Appointments clinicId={clinicId} patient={p} membership={membership} />}
            {tab === 'history' && <MedicalHistory clinicId={clinicId} patient={p} membership={membership} />}
            {tab === 'records' && <Records clinicId={clinicId} patient={p} membership={membership} />}
          </>
        )}
      </ScrollView>
    </ClinicScreen>
  );
};

export default ClinicPatientDetailScreen;
