// Clinical record form (web: components/portal/RecordForm.jsx). Records
// cannot be edited or deleted once saved, so saving asks for confirmation
// first, and closing with unsaved changes asks before discarding them.
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
import { Button, Chips, ChipOption, EmptyState, Field, FormError, LoadState, SearchBox, SelectField, Sheet, Toggle, ui, useLoader } from './ClinicUi';
import {
  ClinicPatient,
  createRecord,
  fetchAppointments,
  fetchPatients,
  formatDateTime,
  PatientRecord,
  RECORD_TYPES,
  serverMessage,
} from '../../services/clinicPortal';
import { toBusinessDateKey } from '../../services/booking';
import { addDays } from '../../screens/clinic/ClinicAppointmentsScreen';

export type RecordForm = {
  record_type: PatientRecord['record_type'];
  appointment_id: number | 0;
  tooth_numbers: string;
  chief_complaint: string;
  findings: string;
  procedures: string;
  notes: string;
  care_instructions: string;
  is_patient_visible: boolean;
  amendment_reason: string;
};

export const blankRecord: RecordForm = {
  record_type: 'examination',
  appointment_id: 0,
  tooth_numbers: '',
  chief_complaint: '',
  findings: '',
  procedures: '',
  notes: '',
  care_instructions: '',
  is_patient_visible: false,
  amendment_reason: '',
};

const CLINICAL_FIELDS = ['chief_complaint', 'findings', 'procedures', 'notes', 'care_instructions'] as const;

/** API body: trimmed text (blank → null), visit only when chosen, reason only for corrections. */
export const recordBody = (form: RecordForm, amending: boolean) => {
  const { amendment_reason, appointment_id, ...fields } = form;
  const body: Record<string, unknown> = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, typeof v === 'string' ? v.trim() || null : v]),
  );
  if (appointment_id) body.appointment_id = appointment_id;
  if (amending) body.amendment_reason = amendment_reason.trim();
  return body;
};

export function RecordSheet({
  title,
  initial,
  amending,
  patientName,
  visitOptions,
  onClose,
  onSave,
}: {
  title?: string;
  initial: RecordForm;
  amending: boolean;
  patientName?: string;
  visitOptions?: ChipOption<number>[];
  onClose: () => void;
  onSave: (form: RecordForm) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialJson = useRef(JSON.stringify(initial)).current;
  const isDirty = JSON.stringify(form) !== initialJson;
  const bind = (name: Exclude<keyof RecordForm, 'record_type' | 'is_patient_visible' | 'appointment_id'>) => ({
    value: form[name],
    onChangeText: (v: string) => setForm((f) => ({ ...f, [name]: v })),
  });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSave(form);
    } catch (err) {
      setError(serverMessage(err, 'The record could not be saved.'));
      setBusy(false);
    }
  };

  const submit = () => {
    if (!CLINICAL_FIELDS.some((name) => form[name].trim())) {
      setError('Add at least a complaint, findings, procedures, notes or care instructions.');
      return;
    }
    if (amending && !form.amendment_reason.trim()) {
      setError('Give the reason for the correction.');
      return;
    }
    setError(null);
    Alert.alert(
      amending ? 'Save this correction?' : 'Save this record?',
      amending
        ? 'The original stays in the history and this correction replaces it. Corrections cannot be edited or deleted.'
        : `Clinical records cannot be edited or deleted once saved; mistakes are fixed with a correction.${patientName ? ` Patient: ${patientName}.` : ''}`,
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: amending ? 'Save correction' : 'Save record', onPress: save },
      ],
    );
  };

  const close = () => {
    if (!isDirty || busy) {
      if (!busy) onClose();
      return;
    }
    Alert.alert('Discard this record?', 'What you have typed has not been saved and will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onClose },
    ]);
  };

  return (
    <Sheet title={title ?? (amending ? 'Correct record' : 'Add clinical record')} onClose={close}>
      {patientName ? (
        <Text style={ui.muted}>
          Patient: <Text style={ui.title}>{patientName}</Text>
        </Text>
      ) : null}
      <Text style={ui.small}>Type</Text>
      <Chips options={[...RECORD_TYPES]} value={form.record_type} onChange={(record_type) => setForm((f) => ({ ...f, record_type }))} scroll={false} />
      {visitOptions && (
        <SelectField
          label="Related visit (optional)"
          options={[{ id: 0, label: 'Not linked to a visit' }, ...visitOptions]}
          value={form.appointment_id}
          onChange={(appointment_id) => setForm((f) => ({ ...f, appointment_id }))}
        />
      )}
      <Field label="Tooth numbers" placeholder="e.g. 16, 47" maxLength={255} {...bind('tooth_numbers')} />
      <Field label="Chief complaint" multiline maxLength={2000} {...bind('chief_complaint')} />
      <Field label="Findings" multiline maxLength={5000} {...bind('findings')} />
      <Field label="Procedures performed" multiline maxLength={5000} {...bind('procedures')} />
      <Field label="Internal notes" multiline maxLength={5000} hint="Never shown to the patient." {...bind('notes')} />
      <Field label="Care instructions" multiline maxLength={5000} {...bind('care_instructions')} />
      <Toggle
        label="Share procedures and care instructions with the patient"
        value={form.is_patient_visible}
        onChange={(is_patient_visible) => setForm((f) => ({ ...f, is_patient_visible }))}
      />
      {amending && <Field label="Reason for correction" required multiline maxLength={500} {...bind('amendment_reason')} />}
      <FormError message={error} />
      <Button label={amending ? 'Save correction' : 'Save record'} style={ui.spacedTop} busy={busy} onPress={submit} />
    </Sheet>
  );
}

const RECENT_VISIT_DAYS = 60;

function useDebounced(value: string, ms = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function PatientPicker({ clinicId, title, onPick, onClose }: { clinicId: number; title: string; onPick: (p: ClinicPatient) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const term = useDebounced(search.trim());
  const patients = useLoader(() => fetchPatients(clinicId, { search: term || undefined, per_page: 8 }), [clinicId, term], 'Patients could not be loaded.');

  return (
    <Sheet title={title} onClose={onClose}>
      <Text style={ui.muted}>Choose the patient this record is for.</Text>
      <SearchBox value={search} onChangeText={setSearch} placeholder="Search by name, email or phone" />
      <LoadState loading={patients.loading} error={patients.error} onRetry={patients.reload} />
      {patients.data && patients.data.items.length === 0 && (
        <EmptyState icon="people-outline" text={term ? 'No patients match this search.' : 'No patients yet.'} />
      )}
      {(patients.data?.items ?? []).map((p) => (
        <TouchableOpacity key={p.id} style={ui.listItem} onPress={() => onPick(p)} accessibilityRole="button" accessibilityLabel={`Choose ${p.name}`}>
          <Text style={ui.title}>{p.name}</Text>
          <Text style={ui.small}>{[p.phone, p.email].filter(Boolean).join(' · ') || 'No contact details'}</Text>
        </TouchableOpacity>
      ))}
    </Sheet>
  );
}

/**
 * New record from anywhere in the portal (dentist overview, Records):
 * pick the patient, then fill in the record. Visits offered are this
 * patient's recent appointments the member can see.
 */
export function NewRecordSheet({
  clinicId,
  title,
  recordType = 'examination',
  onClose,
  onSaved,
}: {
  clinicId: number;
  title: string;
  recordType?: PatientRecord['record_type'];
  onClose: () => void;
  onSaved: (patient: ClinicPatient) => void;
}) {
  const [patient, setPatient] = useState<ClinicPatient | null>(null);
  const [visits, setVisits] = useState<ChipOption<number>[] | undefined>(undefined);

  useEffect(() => {
    if (!patient) return;
    const today = toBusinessDateKey(new Date());
    fetchAppointments(clinicId, { patient_id: patient.id, from: addDays(today, -RECENT_VISIT_DAYS), to: today, per_page: 50 })
      .then(({ items }) => setVisits(items.slice().reverse().map((a) => ({ id: a.id, label: `${formatDateTime(a.starts_at)} · ${a.service?.name ?? 'Visit'}` }))))
      .catch(() => setVisits([]));
  }, [clinicId, patient]);

  if (!patient) return <PatientPicker clinicId={clinicId} title={title} onPick={setPatient} onClose={onClose} />;
  if (!visits) {
    return (
      <Sheet title={title} onClose={onClose}>
        <LoadState loading error={null} />
      </Sheet>
    );
  }

  return (
    <RecordSheet
      title={title}
      initial={{ ...blankRecord, record_type: recordType }}
      amending={false}
      patientName={patient.name}
      visitOptions={visits}
      onClose={onClose}
      onSave={async (form) => {
        await createRecord(clinicId, patient.id, recordBody(form, false));
        onSaved(patient);
        onClose();
      }}
    />
  );
}

export const recordSummary = (r: Pick<PatientRecord, 'findings' | 'procedures' | 'chief_complaint' | 'care_instructions' | 'notes'>) =>
  [r.findings, r.procedures, r.chief_complaint, r.care_instructions, r.notes].find((t) => t?.trim()) ?? '';
