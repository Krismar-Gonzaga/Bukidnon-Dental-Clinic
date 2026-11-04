// My Patients and Patient Profile (web: DentistPatients, DentistPatientProfile).
import React, { useEffect, useState } from 'react';
import { FlatList, Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { ClinicScreen } from '../../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../../components/clinic/ClinicPortalContext';
import { Badge, Button, Card, Chips, EmptyState, Field, FormError, InfoRow, LoadState, Pager, SearchBox, Sheet, ui, useLoader, useRefreshOnFocus } from '../../../components/clinic/ClinicUi';
import { fetchAppointments, serverMessage } from '../../../services/clinicPortal';
import {
  addMedicalHistory,
  ClinicalRecord,
  DentistPatient,
  fetchChecklist,
  fetchDentistPatient,
  fetchDentistPatients,
  fetchMedicalHistory,
  fetchPatientFileList,
  fetchPatientRecords,
  fileViewUrl,
  saveChecklist,
} from '../../../services/dentistPortal';
import { palette, radius, spacing } from '../../../theme/tokens';
import { capitalize, dayKey, dayOfIso, fileSize, fileTitle, formatDay, hasText, LabelledText, PatientLine, statusBadge } from './dentistKit';

const PER_PAGE = 12;

function PatientRow({ patient, onPress }: { patient: DentistPatient; onPress: () => void }) {
  const allergy = hasText(patient.allergies);
  const medical = hasText(patient.conditions);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${patient.name}`}>
      <PatientLine name={patient.name} sub={[patient.age, capitalize(patient.gender)].filter(Boolean).join(' · ')} right={<Icon name="chevron-forward" size={18} color={palette.onSurfaceVariant} />} />
      <Text style={styles.meta}>{patient.phone || 'No phone on file'}</Text>
      <Text style={styles.meta}>Last: {patient.last_visit_at ? dayOfIso(patient.last_visit_at) : 'No visits yet'}</Text>
      <View style={styles.foot}>
        {allergy && <Badge label="Allergy" tone="danger" />}
        {medical && <Badge label="Medical" tone="warning" />}
        {!allergy && !medical && <Badge label="No flags" tone="success" />}
        <Text style={[ui.small, styles.visits]}>{patient.visits === 1 ? '1 visit' : `${patient.visits} visits`}</Text>
      </View>
    </TouchableOpacity>
  );
}

export const DentistPatientsScreen = () => {
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const list = useLoader(() => fetchDentistPatients(clinicId, { search: term || undefined, page, per_page: PER_PAGE }), [clinicId, term, page], 'Your patients could not be loaded.');
  useRefreshOnFocus(list.sync);

  return (
    <ClinicScreen title="My Patients" active="ClinicPatients">
      <FlatList
        data={list.data?.items ?? []}
        keyExtractor={(patient) => String(patient.id)}
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <SearchBox value={search} onChangeText={setSearch} placeholder="Search patients…" />
            {list.data?.meta?.total != null && <Text style={ui.small}>{list.data.meta.total} active patients</Text>}
            <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.loading || list.error ? undefined : <EmptyState icon="people-outline" text={term ? 'No patients match this search.' : 'Patients appear here once they have an appointment with you.'} />}
        ListFooterComponent={<View><Pager page={page} lastPage={list.data?.meta?.last_page ?? 1} onChange={setPage} /></View>}
        renderItem={({ item }) => <PatientRow patient={item} onPress={() => navigation.navigate('ClinicPatientDetail', { patientId: item.id })} />}
      />
    </ClinicScreen>
  );
};

type Tab = 'overview' | 'medical' | 'dental' | 'treatment' | 'imaging';
const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'medical', label: 'Medical History' },
  { id: 'dental', label: 'Dental History' },
  { id: 'treatment', label: 'Treatment History' },
  { id: 'imaging', label: 'Imaging' },
];

const CHECKLIST = [
  ['allergies_reviewed', 'Patient allergies reviewed'],
  ['conditions_assessed', 'Medical conditions assessed'],
  ['medications_reviewed', 'Medications reviewed for interactions'],
  ['blood_pressure_normal', 'Blood pressure within normal range'],
  ['blood_sugar_safe', 'Blood sugar within safe range'],
  ['latex_free_required', 'Latex-free materials required'],
];

const isNote = (record: ClinicalRecord) => record.record_type !== 'treatment';
const recordDay = (record: ClinicalRecord) => (record.performed_on ? formatDay(record.performed_on) : formatDay(dayKey(record.created_at)));

/** Ticked by the dentist. Nothing shows as reviewed until someone has reviewed it. */
function ChecklistCard({ clinicId, patientId }: { clinicId: number; patientId: number }) {
  const checklist = useLoader(() => fetchChecklist(clinicId, patientId), [clinicId, patientId], 'The checklist could not be loaded.');
  const [error, setError] = useState<string | null>(null);
  const data = checklist.data;

  const toggle = async (id: string) => {
    if (!data) return;
    setError(null);
    try {
      checklist.setData(await saveChecklist(clinicId, patientId, { ...data.items, [id]: !data.items[id] }));
    } catch (err) {
      setError(serverMessage(err, 'The checklist could not be saved.'));
    }
  };

  return (
    <Card title="Pre-procedure Checklist">
      <LoadState loading={checklist.loading} error={checklist.error} onRetry={checklist.reload} />
      {data && CHECKLIST.map(([id, label]) => {
        const done = Boolean(data.items[id]);
        return (
          <TouchableOpacity key={id} style={[styles.check, done && styles.checkDone]} onPress={() => toggle(id)} accessibilityRole="checkbox" accessibilityState={{ checked: done }} accessibilityLabel={label}>
            <Icon name={done ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={done ? '#15803d' : palette.onSurfaceVariant} />
            <Text style={[styles.checkText, done && styles.checkTextDone]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
      <FormError message={error} />
      {data && <Text style={ui.small}>{data.reviewed_at ? `Last reviewed by ${data.reviewed_by}, ${dayOfIso(data.reviewed_at)}` : 'Not reviewed yet. Tap an item once you have checked it.'}</Text>}
    </Card>
  );
}

function HistorySheet({ clinicId, patientId, current, onClose, onSaved }: { clinicId: number; patientId: number; current: { allergies: string | null; conditions: string | null; medications: string | null } | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ allergies: current?.allergies ?? '', conditions: current?.conditions ?? '', medications: current?.medications ?? '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bind = (name: keyof typeof form) => ({ value: form[name], onChangeText: (value: string) => setForm((f) => ({ ...f, [name]: value })) });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await addMedicalHistory(clinicId, patientId, form);
      onSaved();
    } catch (err) {
      setError(serverMessage(err, 'The medical history could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Update Medical History" onClose={onClose}>
      <Field label="Known Allergies" multiline maxLength={2000} {...bind('allergies')} />
      <Field label="Medical Conditions" multiline maxLength={2000} {...bind('conditions')} />
      <Field label="Current Medications" multiline maxLength={2000} {...bind('medications')} />
      <Text style={ui.small}>Earlier entries are kept as history.</Text>
      <FormError message={error} />
      <Button label="Save" style={ui.spacedTop} busy={busy} onPress={save} />
    </Sheet>
  );
}

export const DentistPatientProfileScreen = ({ route }: { route: { params: { patientId: number } } }) => {
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const { patientId } = route.params;
  const [tab, setTab] = useState<Tab>('overview');
  const [isEditing, setIsEditing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  const profile = useLoader(
    async () => {
      const [patient, records, history, appointments, files] = await Promise.all([
        fetchDentistPatient(clinicId, patientId),
        fetchPatientRecords(clinicId, patientId),
        fetchMedicalHistory(clinicId, patientId),
        fetchAppointments(clinicId, { patient_id: patientId, per_page: 5 }),
        fetchPatientFileList(clinicId, patientId),
      ]);
      return { patient, records, history, appointments: appointments.items, files };
    },
    [clinicId, patientId],
    'This patient could not be loaded.',
  );
  useRefreshOnFocus(profile.sync);
  const data = profile.data;
  const summary = data?.patient.medical_summary;
  const current = data?.history.current ?? null;
  const plan = data?.records.find((record) => isNote(record) && record.status === 'final' && hasText(record.treatment_plan));

  const openFile = async (fileId: number) => {
    setFileError(null);
    try {
      await Linking.openURL(await fileViewUrl(clinicId, patientId, fileId));
    } catch (err) {
      setFileError(serverMessage(err, 'This file could not be opened.'));
    }
  };

  return (
    <ClinicScreen title="Patient Profile" active="ClinicPatients" back>
      <ScrollView contentContainerStyle={ui.content} refreshControl={<RefreshControl refreshing={profile.refreshing} onRefresh={profile.refresh} />}>
        <LoadState loading={profile.loading} error={profile.error} onRetry={profile.reload} />
        {data && (
          <>
            <Card>
              <PatientLine
                name={data.patient.name}
                sub={[data.patient.age != null ? `${data.patient.age} years` : null, capitalize(data.patient.gender), summary?.blood_type ? `Blood Type: ${summary.blood_type}` : null].filter(Boolean).join(' · ')}
                right={<Badge label={capitalize(data.patient.status)} tone={data.patient.status === 'active' ? 'success' : 'neutral'} />}
              />
              {data.patient.phone ? <Text style={styles.meta}>{data.patient.phone}</Text> : null}
              {data.patient.email ? <Text style={styles.meta}>{data.patient.email}</Text> : null}
              {data.patient.address ? <Text style={styles.meta}>{data.patient.address}</Text> : null}
              <View style={styles.figures}>
                <View style={styles.figure}>
                  <Text style={styles.figureValue}>{data.patient.visits}</Text>
                  <Text style={ui.small}>Visits</Text>
                </View>
                <View style={styles.figure}>
                  <Text style={styles.figureValue}>{data.patient.last_visit_at ? dayOfIso(data.patient.last_visit_at).replace(/,.*$/, '') : '—'}</Text>
                  <Text style={ui.small}>Last Visit</Text>
                </View>
              </View>
              <View style={styles.headerActions}>
                <Button small variant="outline" icon="pulse-outline" label="Dental Chart" onPress={() => navigation.navigate('ClinicDentalChart', { patientId })} />
                <Button small icon="book-outline" label="Prescribe" onPress={() => navigation.navigate('ClinicPrescriptions', { newForPatient: patientId })} />
              </View>
            </Card>

            <Chips options={TABS} value={tab} onChange={setTab} />

            {tab === 'overview' && (
              <>
                <Card title="Current Treatment Plan">
                  <Text style={ui.muted}>{plan ? plan.treatment_plan : 'No treatment plan on record. Plans written in clinical notes appear here.'}</Text>
                </Card>
                <Card title="Allergies & Conditions">
                  <Text style={styles.label}>ALLERGIES</Text>
                  <Badge label={hasText(summary?.allergies) ? String(summary?.allergies) : 'None'} tone={hasText(summary?.allergies) ? 'danger' : 'success'} />
                  <Text style={[styles.label, ui.spacedTop]}>MEDICAL CONDITIONS</Text>
                  <Badge label={hasText(summary?.conditions) ? String(summary?.conditions) : 'None'} tone={hasText(summary?.conditions) ? 'danger' : 'success'} />
                </Card>
                <Card title="Current Medications">
                  <Text style={ui.muted}>{hasText(current?.medications) ? current?.medications : 'No current medications on record.'}</Text>
                </Card>
                <Card title="Recent Appointments">
                  {data.appointments.length === 0 ? (
                    <Text style={ui.muted}>No appointments yet.</Text>
                  ) : (
                    [...data.appointments].reverse().map((a) => {
                      const status = statusBadge(a.status);
                      return (
                        <View key={a.id} style={styles.apptRow}>
                          <View style={ui.flex}>
                            <Text style={styles.apptName} numberOfLines={1}>{a.service?.name}</Text>
                            <Text style={ui.small}>{dayOfIso(a.starts_at)}</Text>
                          </View>
                          <Badge label={status.label} tone={status.tone} />
                        </View>
                      );
                    })
                  )}
                </Card>
              </>
            )}

            {tab === 'medical' && (
              <>
                <Card title="Medical History" action={<Button small variant="outline" label="Update" onPress={() => setIsEditing(true)} />}>
                  <InfoRow label="Blood Type" value={summary?.blood_type ?? 'Not on file'} />
                  <InfoRow label="Medical Conditions" value={hasText(current?.conditions) ? current?.conditions : 'None'} />
                  <InfoRow label="Known Allergies" value={hasText(current?.allergies) ? current?.allergies : 'None'} />
                  <InfoRow label="Current Medications" value={hasText(current?.medications) ? current?.medications : 'None'} />
                </Card>
                <ChecklistCard clinicId={clinicId} patientId={patientId} />
              </>
            )}

            {tab === 'dental' && (
              <Card title="Dental History">
                {data.records.filter(isNote).length === 0 ? (
                  <Text style={ui.muted}>No clinical notes yet.</Text>
                ) : (
                  data.records.filter(isNote).map((note) => (
                    <View key={note.id} style={styles.entry}>
                      <View style={ui.between}>
                        <Text style={ui.title}>{recordDay(note)}</Text>
                        <Badge label={note.status === 'draft' ? 'Draft' : 'Finalized'} tone="warning" />
                      </View>
                      {note.chief_complaint ? <LabelledText label="Chief Complaint">{note.chief_complaint}</LabelledText> : null}
                      {note.diagnosis ? <LabelledText label="Diagnosis">{note.diagnosis}</LabelledText> : null}
                      {note.procedures ? <LabelledText label="Treatment">{note.procedures}</LabelledText> : null}
                      {note.follow_up_recommendations ? <LabelledText label="Follow-up">{note.follow_up_recommendations}</LabelledText> : null}
                    </View>
                  ))
                )}
              </Card>
            )}

            {tab === 'treatment' && (
              <Card title="Treatment History">
                {data.records.filter((r) => !isNote(r)).length === 0 ? (
                  <Text style={ui.muted}>No treatments recorded yet.</Text>
                ) : (
                  data.records.filter((r) => !isNote(r)).map((record) => (
                    <View key={record.id} style={styles.entry}>
                      <Text style={ui.title}>{record.procedures}</Text>
                      <Text style={ui.small}>{recordDay(record)}</Text>
                      <LabelledText label="Tooth/Area">{record.tooth_numbers}</LabelledText>
                      <LabelledText label="Materials">{record.materials_used}</LabelledText>
                      {record.notes ? <LabelledText label="Remarks">{record.notes}</LabelledText> : null}
                    </View>
                  ))
                )}
              </Card>
            )}

            {tab === 'imaging' && (
              <Card title="Imaging & Attachments">
                <FormError message={fileError} />
                {data.files.length === 0 ? (
                  <Text style={ui.muted}>No images or files yet.</Text>
                ) : (
                  data.files.map((file) => (
                    <TouchableOpacity key={file.id} style={styles.entry} onPress={() => openFile(file.id)} accessibilityRole="button" accessibilityLabel={`Open ${fileTitle(file)}`}>
                      <Text style={ui.title}>{fileTitle(file)}</Text>
                      <Text style={ui.small}>{dayOfIso(file.uploaded_at)} · {fileSize(file.size)}</Text>
                      {file.notes ? <Text style={styles.meta}>{file.notes}</Text> : null}
                    </TouchableOpacity>
                  ))
                )}
              </Card>
            )}
          </>
        )}
      </ScrollView>
      {isEditing && (
        <HistorySheet
          clinicId={clinicId}
          patientId={patientId}
          current={current}
          onClose={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            profile.sync();
          }}
        />
      )}
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  card: { padding: spacing.md, borderRadius: radius.xl, backgroundColor: palette.surfaceContainerLowest, borderWidth: 1, borderColor: palette.surfaceContainerHigh },
  meta: { fontSize: 13, color: palette.onSurfaceVariant, marginTop: spacing.xs },
  foot: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: palette.surfaceContainerHigh },
  visits: { marginLeft: 'auto' },
  figures: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  figure: { flex: 1, alignItems: 'center', padding: spacing.sm, borderRadius: radius.lg, backgroundColor: palette.surfaceContainerLow },
  figureValue: { fontSize: 15, fontWeight: '700', color: palette.primary, textAlign: 'center' },
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  label: { fontSize: 11, fontWeight: '600', color: palette.onSurfaceVariant, marginBottom: 4 },
  apptRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.surfaceContainerHigh },
  apptName: { fontSize: 13, fontWeight: '600', color: palette.onSurface },
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginBottom: spacing.xs, borderRadius: radius.sm, backgroundColor: palette.surfaceContainerLow },
  checkDone: { backgroundColor: '#edfbf1' },
  checkText: { flex: 1, fontSize: 13, color: palette.onSurfaceVariant },
  checkTextDone: { color: '#15803d' },
  entry: { padding: spacing.sm, marginTop: spacing.sm, borderRadius: radius.lg, backgroundColor: palette.surfaceContainerLow, borderWidth: 1, borderColor: palette.surfaceContainerHigh },
});
