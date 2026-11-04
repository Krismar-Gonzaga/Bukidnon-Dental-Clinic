// Imaging & Files and Follow-up Management (web: ImagingPage, FollowUpsPage).
import React, { useState } from 'react';
import { FlatList, Linking, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { ClinicScreen } from '../../../components/clinic/ClinicChrome';
import { DateField } from '../../../components/clinic/DateField';
import { useClinicPortal } from '../../../components/clinic/ClinicPortalContext';
import { Badge, Button, Card, Chips, EmptyState, Field, FormError, LoadState, Pager, SelectField, Sheet, ui, useLoader, useRefreshOnFocus } from '../../../components/clinic/ClinicUi';
import { can, PickedFile, serverMessage } from '../../../services/clinicPortal';
import { ClinicFile, createFollowUp, fetchClinicFiles, fetchFollowUps, fileViewUrl, FollowUp, updateFollowUp, uploadClinicalFile } from '../../../services/dentistPortal';
import { palette, radius, spacing } from '../../../theme/tokens';
import { dayOfIso, FILE_CATEGORIES, fileSize, fileTitle, formatDay, LabelledText, PatientLine, PatientPicker, usePatientOptions } from './dentistKit';

const FILES_PER_PAGE = 30;
const FOLLOW_UPS_PER_PAGE = 50;

function UploadSheet({ clinicId, initialPatient, onClose, onSaved }: { clinicId: number; initialPatient?: number; onClose: () => void; onSaved: () => void }) {
  const [patientId, setPatientId] = useState<number | null>(initialPatient ?? null);
  const [category, setCategory] = useState(FILE_CATEGORIES[0].id);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<PickedFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true });
    const asset = result.canceled ? null : result.assets?.[0];
    if (asset) setFile({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/pdf' });
  };

  const upload = async () => {
    if (!patientId || !file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadClinicalFile(clinicId, patientId, file, { category, notes: notes.trim() });
      onSaved();
    } catch (err) {
      setError(serverMessage(err, 'This file could not be uploaded.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Upload File" onClose={onClose}>
      <PatientPicker value={patientId} onChange={setPatientId} />
      <SelectField<string> label="Type" options={FILE_CATEGORIES} value={category} onChange={setCategory} />
      <Button variant="outline" icon="document-attach-outline" label={file ? file.name : 'Choose a file'} onPress={pick} />
      <Text style={ui.small}>PDF, JPG, PNG or WEBP, up to 10 MB.</Text>
      <Field label="Notes" multiline maxLength={500} value={notes} onChangeText={setNotes} />
      <FormError message={error} />
      <Button label="Upload" style={ui.spacedTop} busy={busy} disabled={!patientId || !file} onPress={upload} />
    </Sheet>
  );
}

export const ImagingScreen = ({ route }: { route?: { params?: { patientId?: number } } }) => {
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const initialPatient = route?.params?.patientId;
  const { patients } = usePatientOptions();
  const [patient, setPatient] = useState<number>(initialPatient ?? 0);
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [viewing, setViewing] = useState<ClinicFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const list = useLoader(
    () => fetchClinicFiles(clinicId, { patient_id: patient || undefined, category: category || undefined, page, per_page: FILES_PER_PAGE }),
    [clinicId, patient, category, page],
    'Files could not be loaded.',
  );
  useRefreshOnFocus(list.sync);
  const total = list.data?.meta?.total;

  const open = async (file: ClinicFile) => {
    setError(null);
    try {
      await Linking.openURL(await fileViewUrl(clinicId, file.patient?.id ?? 0, file.id));
    } catch (err) {
      setError(serverMessage(err, 'This file could not be opened.'));
    }
  };

  return (
    <ClinicScreen title="Imaging & Files" active="ClinicImaging" back={Boolean(initialPatient)}>
      <FlatList
        data={list.data?.items ?? []}
        keyExtractor={(file) => String(file.id)}
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={ui.between}>
              <Text style={ui.small}>{total != null ? `${total} ${total === 1 ? 'file' : 'files'}` : ''}</Text>
              {can(membership, 'records.write') && <Button small icon="cloud-upload-outline" label="Upload File" onPress={() => setIsUploading(true)} />}
            </View>
            <Chips
              options={[{ id: 0, label: 'All Patients' }, ...patients.map((p) => ({ id: p.id, label: p.name }))]}
              value={patient}
              onChange={(value) => {
                setPatient(value);
                setPage(1);
              }}
            />
            <Chips
              options={[{ id: '', label: 'All' }, ...FILE_CATEGORIES]}
              value={category}
              onChange={(value) => {
                setCategory(value);
                setPage(1);
              }}
            />
            <FormError message={error} />
            <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.loading || list.error ? undefined : <EmptyState icon="camera-outline" text={patient || category ? 'No files match these filters.' : 'No images or files yet.'} />}
        ListFooterComponent={<View><Pager page={page} lastPage={list.data?.meta?.last_page ?? 1} onChange={setPage} /></View>}
        renderItem={({ item: file }) => (
          <Card style={styles.fileCard}>
            <View style={styles.thumb}>
              <Icon name={file.mime_type?.startsWith('image/') ? 'camera-outline' : 'document-text-outline'} size={32} color={palette.primary} />
            </View>
            <View style={ui.between}>
              <Text style={[ui.title, ui.flex]}>{fileTitle(file)}</Text>
              <Text style={ui.small}>{fileSize(file.size)}</Text>
            </View>
            <Text style={ui.small}>{file.patient?.name}</Text>
            <Text style={ui.small}>{dayOfIso(file.uploaded_at)}</Text>
            {file.notes ? <Text style={styles.notes}>{file.notes}</Text> : null}
            <View style={styles.foot}>
              <Button small variant="outline" icon="eye-outline" label="View" onPress={() => setViewing(file)} />
              <Button small variant="outline" icon="download-outline" label="Download" onPress={() => open(file)} />
            </View>
          </Card>
        )}
      />
      {viewing && (
        <Sheet title={fileTitle(viewing)} onClose={() => setViewing(null)}>
          <LabelledText label="Patient">{viewing.patient?.name}</LabelledText>
          <LabelledText label="Date">{dayOfIso(viewing.uploaded_at)}</LabelledText>
          <LabelledText label="File">{viewing.name}</LabelledText>
          {viewing.notes ? <LabelledText label="Notes">{viewing.notes}</LabelledText> : null}
          <Button icon="open-outline" label="Open File" style={ui.spacedTop} onPress={() => open(viewing)} />
        </Sheet>
      )}
      {isUploading && (
        <UploadSheet
          clinicId={clinicId}
          initialPatient={patient || undefined}
          onClose={() => setIsUploading(false)}
          onSaved={() => {
            setIsUploading(false);
            list.sync();
          }}
        />
      )}
    </ClinicScreen>
  );
};

const STATUSES = [
  { id: 'scheduled', label: 'Scheduled', tone: 'warning' as const },
  { id: 'confirmed', label: 'Confirmed', tone: 'info' as const },
  { id: 'completed', label: 'Completed', tone: 'success' as const },
  { id: 'cancelled', label: 'Cancelled', tone: 'neutral' as const },
];
const PRIORITIES = [
  { id: 'routine', label: 'Routine', tone: 'info' as const },
  { id: 'high', label: 'High', tone: 'danger' as const },
];
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function FollowUpSheet({ clinicId, followUp, onClose, onSaved }: { clinicId: number; followUp: FollowUp | null; onClose: () => void; onSaved: () => void }) {
  const [patientId, setPatientId] = useState<number | null>(null);
  const [form, setForm] = useState({
    purpose: followUp?.purpose ?? '',
    due_on: followUp?.due_on ?? '',
    priority: followUp?.priority ?? 'routine',
    status: followUp?.status ?? 'scheduled',
    notes: followUp?.notes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (name: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [name]: value }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (followUp) await updateFollowUp(clinicId, followUp.id, form);
      else await createFollowUp(clinicId, { patient_id: patientId, ...form });
      onSaved();
    } catch (err) {
      setError(serverMessage(err, 'This follow-up could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={followUp ? `Follow-up: ${followUp.patient?.name}` : 'Schedule Follow-up'} onClose={onClose}>
      {!followUp && <PatientPicker value={patientId} onChange={setPatientId} />}
      <Field label="Purpose" required maxLength={255} placeholder="e.g. Retainer check" value={form.purpose} onChangeText={set('purpose')} />
      <DateField label="Due Date" required value={form.due_on} onChange={set('due_on')} />
      <SelectField<string> label="Priority" options={PRIORITIES} value={form.priority} onChange={set('priority')} />
      {followUp && <SelectField<string> label="Status" options={STATUSES} value={form.status} onChange={set('status')} />}
      <Field label="Notes" multiline maxLength={500} value={form.notes} onChangeText={set('notes')} />
      <FormError message={error} />
      <Button label={followUp ? 'Save Changes' : 'Schedule Follow-up'} style={ui.spacedTop} busy={busy} disabled={(!followUp && !patientId) || !form.purpose.trim() || !DAY_PATTERN.test(form.due_on)} onPress={save} />
    </Sheet>
  );
}

const Tile = ({ icon, color, value, label }: { icon: string; color: string; value: number; label: string }) => (
  <View style={styles.tile}>
    <Icon name={icon} size={20} color={color} />
    <Text style={styles.tileValue}>{value}</Text>
    <Text style={ui.small}>{label}</Text>
  </View>
);

export const FollowUpsScreen = () => {
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const canWrite = can(membership, 'records.write');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<{ followUp: FollowUp | null } | null>(null);
  const list = useLoader(() => fetchFollowUps(clinicId, { status: status || undefined, page, per_page: FOLLOW_UPS_PER_PAGE }), [clinicId, status, page], 'Follow-ups could not be loaded.');
  useRefreshOnFocus(list.sync);
  const summary = list.data?.meta?.summary;

  return (
    <ClinicScreen title="Follow-up" active="ClinicFollowUps">
      <FlatList
        data={list.data?.items ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            {canWrite && <Button icon="add" label="Schedule Follow-up" onPress={() => setModal({ followUp: null })} />}
            {summary && (
              <View style={styles.tiles}>
                <Tile icon="calendar-number-outline" color="#1d5fd1" value={summary.total} label="Total Scheduled" />
                <Tile icon="warning-outline" color="#c81e1e" value={summary.high_priority} label="High Priority" />
                <Tile icon="checkmark-circle-outline" color="#0f9d58" value={summary.confirmed} label="Confirmed" />
              </View>
            )}
            <Chips
              options={[{ id: '', label: 'All' }, ...STATUSES.map(({ id, label }) => ({ id, label }))]}
              value={status}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            />
            <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.loading || list.error ? undefined : <EmptyState icon="calendar-number-outline" text={status ? 'No follow-ups with this status.' : 'No follow-ups scheduled yet.'} />}
        ListFooterComponent={<View><Pager page={page} lastPage={list.data?.meta?.last_page ?? 1} onChange={setPage} /></View>}
        renderItem={({ item }) => {
          const priority = PRIORITIES.find(({ id }) => id === item.priority);
          const state = STATUSES.find(({ id }) => id === item.status);
          return (
            <TouchableOpacity disabled={!canWrite} onPress={() => setModal({ followUp: item })} accessibilityRole="button" accessibilityLabel={`Edit follow-up for ${item.patient?.name}`}>
              <Card>
                <PatientLine name={item.patient?.name} sub={item.purpose} />
                <LabelledText label="Due Date">{formatDay(item.due_on)}</LabelledText>
                <View style={styles.pills}>
                  <Badge label={priority?.label ?? item.priority} tone={priority?.tone} />
                  <Badge label={state?.label ?? item.status} tone={state?.tone} />
                </View>
                {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
              </Card>
            </TouchableOpacity>
          );
        }}
      />
      {modal && (
        <FollowUpSheet
          clinicId={clinicId}
          followUp={modal.followUp}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            list.sync();
          }}
        />
      )}
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  fileCard: { overflow: 'hidden' },
  thumb: { alignItems: 'center', justifyContent: 'center', height: 110, marginBottom: spacing.sm, borderRadius: radius.lg, backgroundColor: palette.primaryFixed },
  notes: { fontSize: 12, color: palette.onSurfaceVariant, marginTop: spacing.xs },
  foot: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: { flex: 1, alignItems: 'flex-start', padding: spacing.sm, borderRadius: radius.lg, backgroundColor: palette.surfaceContainerLowest, borderWidth: 1, borderColor: palette.surfaceContainerHigh },
  tileValue: { fontSize: 18, fontWeight: '700', color: palette.onSurface },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
});
