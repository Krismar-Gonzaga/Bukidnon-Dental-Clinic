// Clinical Notes and Treatment Records (web: ClinicalNotesPage, TreatmentRecordsPage).
import React, { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ClinicScreen } from '../../../components/clinic/ClinicChrome';
import { DateField } from '../../../components/clinic/DateField';
import { useClinicPortal } from '../../../components/clinic/ClinicPortalContext';
import { Badge, Button, Card, Chips, EmptyState, Field, FormError, InfoRow, LoadState, Pager, Sheet, ui, useLoader, useRefreshOnFocus } from '../../../components/clinic/ClinicUi';
import { can, serverMessage } from '../../../services/clinicPortal';
import { ClinicalRecord, correctRecord, fetchRecordsOfKind, saveRecord, updateDraft } from '../../../services/dentistPortal';
import { toBusinessDateKey } from '../../../services/booking';
import { spacing } from '../../../theme/tokens';
import { dayKey, dayOfIso, formatDay, LabelledText, LinkText, PatientLine, PatientPicker, usePatientOptions } from './dentistKit';

const PER_PAGE = 20;

const NOTE_FIELDS: [keyof ClinicalRecord, string, string][] = [
  ['chief_complaint', 'Chief Complaint', 'Enter chief complaint…'],
  ['findings', 'Clinical Findings', 'Enter clinical findings…'],
  ['diagnosis', 'Diagnosis', 'Enter diagnosis…'],
  ['procedures', 'Treatment Performed', 'Enter treatment performed…'],
  ['treatment_plan', 'Treatment Plan', 'Enter treatment plan…'],
  ['follow_up_recommendations', 'Follow-up Recommendations', 'Enter follow-up recommendations…'],
];

type NoteForm = Record<string, string>;
const noteForm = (note?: ClinicalRecord | null): NoteForm => Object.fromEntries(NOTE_FIELDS.map(([name]) => [name, String(note?.[name] ?? '')]));
const hasContent = (form: NoteForm) => Object.values(form).some((value) => value.trim());

function NoteSheet({ clinicId, note, onClose, onSaved }: { clinicId: number; note: ClinicalRecord | null; onClose: () => void; onSaved: () => void }) {
  const [patientId, setPatientId] = useState<number | null>(note?.patient_id ?? null);
  const [form, setForm] = useState(noteForm(note));
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isCorrection = note?.status === 'final';

  const save = async (status: 'draft' | 'final') => {
    if (!patientId) return;
    setBusy(true);
    setError(null);
    try {
      const body = { record_type: note?.record_type ?? 'examination', ...form, status };
      if (!note) await saveRecord(clinicId, patientId, body);
      else if (note.status === 'draft') await updateDraft(clinicId, note.patient_id, note.id, body);
      else await correctRecord(clinicId, note.patient_id, note.id, { ...body, status: 'final', amendment_reason: reason.trim() });
      onSaved();
    } catch (err) {
      setError(serverMessage(err, 'This note could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={!note ? 'New Clinical Note' : isCorrection ? 'Correct Note' : 'Edit Draft'} onClose={onClose}>
      {!note && <PatientPicker value={patientId} onChange={setPatientId} />}
      {NOTE_FIELDS.map(([name, label, placeholder]) => (
        <Field key={name} label={label} multiline maxLength={5000} placeholder={placeholder} value={form[name]} onChangeText={(value) => setForm((f) => ({ ...f, [name]: value }))} />
      ))}
      {isCorrection && <Field label="Reason for correction" required maxLength={500} hint="The original note stays on record." value={reason} onChangeText={setReason} />}
      <FormError message={error} />
      <View style={styles.actions}>
        {!isCorrection && <Button variant="outline" label="Save as Draft" busy={busy} disabled={!patientId || !hasContent(form)} onPress={() => save('draft')} />}
        <Button
          icon="checkmark-circle-outline"
          label={isCorrection ? 'Save Correction' : 'Finalize Note'}
          busy={busy}
          disabled={!patientId || !hasContent(form) || (isCorrection && !reason.trim())}
          onPress={() => save('final')}
        />
      </View>
    </Sheet>
  );
}

function FullNoteSheet({ note, onEdit, onClose }: { note: ClinicalRecord; onEdit: () => void; onClose: () => void }) {
  return (
    <Sheet title={`${note.patient?.name} · ${dayOfIso(note.created_at)}`} onClose={onClose}>
      <Badge label={note.status === 'draft' ? 'Draft' : 'Finalized'} tone="warning" />
      {NOTE_FIELDS.filter(([name]) => note[name]).map(([name, label]) => (
        <InfoRow key={name} label={label} value={String(note[name])} />
      ))}
      {note.amendment_reason ? <InfoRow label="Corrected because" value={note.amendment_reason} /> : null}
      <Button label={note.status === 'draft' ? 'Edit Draft' : 'Correct Note'} style={ui.spacedTop} onPress={onEdit} />
    </Sheet>
  );
}

export const ClinicalNotesScreen = () => {
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const [page, setPage] = useState(1);
  const [viewing, setViewing] = useState<ClinicalRecord | null>(null);
  const [editing, setEditing] = useState<{ note: ClinicalRecord | null } | null>(null);
  const list = useLoader(() => fetchRecordsOfKind(clinicId, 'notes', { page, per_page: PER_PAGE }), [clinicId, page], 'Clinical notes could not be loaded.');
  useRefreshOnFocus(list.sync);
  const total = list.data?.meta?.total;

  return (
    <ClinicScreen title="Clinical Notes" active="ClinicClinicalNotes">
      <FlatList
        data={list.data?.items ?? []}
        keyExtractor={(note) => String(note.id)}
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={ui.between}>
              <Text style={ui.small}>{total != null ? `${total} ${total === 1 ? 'note' : 'notes'} on record` : ''}</Text>
              {can(membership, 'records.write') && <Button small icon="add" label="New Note" onPress={() => setEditing({ note: null })} />}
            </View>
            <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.loading || list.error ? undefined : <EmptyState icon="clipboard-outline" text="No clinical notes yet." />}
        ListFooterComponent={<View><Pager page={page} lastPage={list.data?.meta?.last_page ?? 1} onChange={setPage} /></View>}
        renderItem={({ item: note }) => (
          <Card>
            <PatientLine name={note.patient?.name} sub={dayOfIso(note.created_at)} right={<Badge label={note.status === 'draft' ? 'Draft' : 'Finalized'} tone="warning" />} />
            <LabelledText label="Complaint">{note.chief_complaint}</LabelledText>
            <LabelledText label="Diagnosis">{note.diagnosis}</LabelledText>
            <LabelledText label="Treatment">{note.procedures}</LabelledText>
            <View style={styles.foot}>
              <LinkText label="View Full Note" onPress={() => setViewing(note)} />
              <LinkText label="Patient Profile" onPress={() => navigation.navigate('ClinicPatientDetail', { patientId: note.patient_id })} />
            </View>
          </Card>
        )}
      />
      {viewing && (
        <FullNoteSheet
          note={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing({ note: viewing });
            setViewing(null);
          }}
        />
      )}
      {editing && (
        <NoteSheet
          clinicId={clinicId}
          note={editing.note}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.sync();
          }}
        />
      )}
    </ClinicScreen>
  );
};

function RecordSheet({ clinicId, onClose, onSaved }: { clinicId: number; onClose: () => void; onSaved: () => void }) {
  const [patientId, setPatientId] = useState<number | null>(null);
  const [form, setForm] = useState({ performed_on: toBusinessDateKey(new Date()), procedures: '', tooth_numbers: '', materials_used: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bind = (name: keyof typeof form) => ({ value: form[name], onChangeText: (value: string) => setForm((f) => ({ ...f, [name]: value })) });

  const save = async () => {
    if (!patientId) return;
    setBusy(true);
    setError(null);
    try {
      await saveRecord(clinicId, patientId, { record_type: 'treatment', ...form });
      onSaved();
    } catch (err) {
      setError(serverMessage(err, 'This record could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="New Treatment Record" onClose={onClose}>
      <PatientPicker value={patientId} onChange={setPatientId} />
      <DateField label="Date" required value={form.performed_on} onChange={(performed_on) => setForm((f) => ({ ...f, performed_on }))} />
      <Field label="Procedure" required maxLength={5000} placeholder="e.g. Tooth Extraction" {...bind('procedures')} />
      <Field label="Tooth / Area" maxLength={255} placeholder="e.g. Tooth #14 or Full Mouth" {...bind('tooth_numbers')} />
      <Field label="Materials Used" maxLength={500} placeholder="e.g. Composite resin, NiTi wire" {...bind('materials_used')} />
      <Field label="Clinical Remarks" multiline maxLength={5000} placeholder="Post-procedure notes, patient response, etc." {...bind('notes')} />
      <FormError message={error} />
      <Button icon="checkmark-circle-outline" label="Save Record" style={ui.spacedTop} busy={busy} disabled={!patientId || !form.procedures.trim()} onPress={save} />
    </Sheet>
  );
}

export const TreatmentRecordsScreen = () => {
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const { patients } = usePatientOptions();
  const [patient, setPatient] = useState<number | 0>(0);
  const [page, setPage] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const list = useLoader(() => fetchRecordsOfKind(clinicId, 'treatments', { patient_id: patient || undefined, page, per_page: PER_PAGE }), [clinicId, patient, page], 'Treatment records could not be loaded.');
  useRefreshOnFocus(list.sync);
  const total = list.data?.meta?.total;

  return (
    <ClinicScreen title="Treatment Records" active="ClinicTreatmentRecords">
      <FlatList
        data={list.data?.items ?? []}
        keyExtractor={(record) => String(record.id)}
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={ui.between}>
              <Text style={ui.small}>{total != null ? `${total} ${total === 1 ? 'procedure' : 'procedures'} on record` : ''}</Text>
              {can(membership, 'records.write') && <Button small icon="add" label="Add Record" onPress={() => setIsAdding(true)} />}
            </View>
            <Chips
              options={[{ id: 0, label: 'All' }, ...patients.map((p) => ({ id: p.id, label: p.name }))]}
              value={patient}
              onChange={(value) => {
                setPatient(value);
                setPage(1);
              }}
            />
            <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.loading || list.error ? undefined : <EmptyState icon="document-text-outline" text={patient ? 'No treatments recorded for this patient.' : 'No treatment records yet.'} />}
        ListFooterComponent={<View><Pager page={page} lastPage={list.data?.meta?.last_page ?? 1} onChange={setPage} /></View>}
        renderItem={({ item: record }) => (
          <Card>
            <View style={ui.between}>
              <Text style={[ui.title, ui.flex]}>{record.procedures || 'Treatment'}</Text>
              {record.tooth_numbers ? <Badge label={record.tooth_numbers} tone="neutral" /> : null}
            </View>
            <Text style={ui.small}>
              {record.patient?.name} · {record.performed_on ? formatDay(record.performed_on) : formatDay(dayKey(record.created_at))}
            </Text>
            <LabelledText label="Materials">{record.materials_used}</LabelledText>
            <LabelledText label="Dentist">{record.dentist ?? record.author}</LabelledText>
            {record.notes ? <LabelledText label="Remarks">{record.notes}</LabelledText> : null}
          </Card>
        )}
      />
      {isAdding && (
        <RecordSheet
          clinicId={clinicId}
          onClose={() => setIsAdding(false)}
          onSaved={() => {
            setIsAdding(false);
            list.sync();
          }}
        />
      )}
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  foot: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
});
