// Prescriptions and Dental Certificates (web: PrescriptionsPage, DentalCertificatesPage).
// Printing opens the document in the phone's browser, which can print or save it as a PDF.
import React, { useEffect, useState } from 'react';
import { FlatList, Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { ClinicScreen } from '../../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../../components/clinic/ClinicPortalContext';
import { NoteBox } from '../../../components/clinic/ClinicAdminKit';
import { Badge, Button, Card, EmptyState, Field, FormError, LoadState, Pager, Sheet, ui, useLoader, useRefreshOnFocus } from '../../../components/clinic/ClinicUi';
import { can, serverMessage } from '../../../services/clinicPortal';
import { CertificatePreview, fetchPrescriptions, issueCertificateUrl, issuePrescription, prescriptionPrintUrl, previewCertificate } from '../../../services/dentistPortal';
import { palette, radius, spacing } from '../../../theme/tokens';
import { dayOfIso, LabelledText, LinkText, PatientPicker } from './dentistKit';

const PER_PAGE = 20;

function PrescriptionSheet({ clinicId, initialPatient, onClose, onSaved }: { clinicId: number; initialPatient?: number; onClose: () => void; onSaved: () => void }) {
  const [patientId, setPatientId] = useState<number | null>(initialPatient ?? null);
  const [form, setForm] = useState({ medication: '', dosage: '', frequency: '', duration: '', instructions: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bind = (name: keyof typeof form) => ({ value: form[name], onChangeText: (value: string) => setForm((f) => ({ ...f, [name]: value })) });
  const isComplete = patientId && form.medication.trim() && form.dosage.trim() && form.frequency.trim() && form.duration.trim();

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await issuePrescription(clinicId, { patient_id: patientId, ...form });
      onSaved();
    } catch (err) {
      setError(serverMessage(err, 'This prescription could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="New Prescription" onClose={onClose}>
      <PatientPicker value={patientId} onChange={setPatientId} />
      <Field label="Medication" required maxLength={255} placeholder="e.g. Amoxicillin" {...bind('medication')} />
      <Field label="Dosage" required maxLength={100} placeholder="e.g. 500mg" {...bind('dosage')} />
      <Field label="Frequency" required maxLength={100} placeholder="e.g. Every 8 hours" {...bind('frequency')} />
      <Field label="Duration" required maxLength={100} placeholder="e.g. 5 days" {...bind('duration')} />
      <Field label="Instructions" multiline maxLength={2000} placeholder="Special instructions for the patient…" {...bind('instructions')} />
      <FormError message={error} />
      <Button icon="checkmark-circle-outline" label="Save Prescription" style={ui.spacedTop} busy={busy} disabled={!isComplete} onPress={save} />
    </Sheet>
  );
}

export const PrescriptionsScreen = ({ route }: { route?: { params?: { newForPatient?: number } } }) => {
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const newForPatient = route?.params?.newForPatient;
  const [page, setPage] = useState(1);
  const [isAdding, setIsAdding] = useState(Boolean(newForPatient));
  const [error, setError] = useState<string | null>(null);
  const list = useLoader(() => fetchPrescriptions(clinicId, { page, per_page: PER_PAGE }), [clinicId, page], 'Prescriptions could not be loaded.');
  useRefreshOnFocus(list.sync);
  const total = list.data?.meta?.total;

  useEffect(() => {
    if (newForPatient) setIsAdding(true);
  }, [newForPatient]);

  const print = async (id: number) => {
    setError(null);
    try {
      await Linking.openURL(await prescriptionPrintUrl(clinicId, id));
    } catch (err) {
      setError(serverMessage(err, 'This prescription could not be opened.'));
    }
  };

  return (
    <ClinicScreen title="Prescriptions" active="ClinicPrescriptions" back={Boolean(newForPatient)}>
      <FlatList
        data={list.data?.items ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={ui.between}>
              <Text style={ui.small}>{total != null ? `${total} ${total === 1 ? 'prescription' : 'prescriptions'} issued` : ''}</Text>
              {can(membership, 'documents.issue') && <Button small icon="add" label="New Prescription" onPress={() => setIsAdding(true)} />}
            </View>
            <FormError message={error} />
            <LoadState loading={list.loading} error={list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.loading || list.error ? undefined : <EmptyState icon="book-outline" text="No prescriptions issued yet." />}
        ListFooterComponent={<View><Pager page={page} lastPage={list.data?.meta?.last_page ?? 1} onChange={setPage} /></View>}
        renderItem={({ item }) => (
          <Card>
            <View style={ui.between}>
              <Text style={[ui.title, ui.flex]}>{item.medication} — {item.dosage}</Text>
              <Badge label="Issued" tone="warning" />
            </View>
            <Text style={ui.small}>{item.patient?.name} · {dayOfIso(item.issued_at)}</Text>
            <LabelledText label="Frequency">{item.frequency}</LabelledText>
            <LabelledText label="Duration">{item.duration}</LabelledText>
            <LabelledText label="Instructions">{item.instructions}</LabelledText>
            <View style={styles.foot}>
              <LinkText icon="download-outline" label="Print" onPress={() => print(item.id)} />
              <LinkText label="Patient Record" onPress={() => navigation.navigate('ClinicPatientDetail', { patientId: item.patient?.id })} />
            </View>
          </Card>
        )}
      />
      {isAdding && (
        <PrescriptionSheet
          clinicId={clinicId}
          initialPatient={newForPatient}
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

const TYPES = [
  { id: 'medical', title: 'Medical Certificate', note: 'General health clearance for dental procedures', field: 'Notes / Purpose' },
  { id: 'clearance', title: 'Dental Clearance', note: 'Patient cleared for specific activity or procedure', field: 'Purpose / Activity' },
  { id: 'treatment', title: 'Treatment Certificate', note: 'Record of dental treatment completed', field: 'Treatment Summary' },
];

export const DentalCertificatesScreen = () => {
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const [type, setType] = useState(TYPES[0].id);
  const [patientId, setPatientId] = useState<number | null>(null);
  const [purpose, setPurpose] = useState('');
  const [preview, setPreview] = useState<CertificatePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = TYPES.find(({ id }) => id === type) ?? TYPES[0];
  const body = { patient_id: patientId, type, purpose: purpose.trim() };

  // What is on screen must be what gets printed, so any change clears the preview.
  useEffect(() => {
    setPreview(null);
    setError(null);
  }, [type, patientId, purpose]);

  const run = async (work: () => Promise<void>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(serverMessage(err, fallback));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ClinicScreen title="Dental Certificates" active="ClinicCertificates">
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <Card title="Certificate Type">
          {TYPES.map((item) => (
            <TouchableOpacity key={item.id} style={[styles.type, type === item.id && styles.typeActive]} onPress={() => setType(item.id)} accessibilityRole="radio" accessibilityState={{ selected: type === item.id }} accessibilityLabel={item.title}>
              <Icon name="ribbon-outline" size={20} color={type === item.id ? palette.primary : palette.onSurfaceVariant} />
              <View style={ui.flex}>
                <Text style={[styles.typeTitle, type === item.id && styles.typeTitleActive]}>{item.title}</Text>
                <Text style={ui.small}>{item.note}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </Card>
        <Card>
          <PatientPicker value={patientId} onChange={setPatientId} />
          <Field label={selected.field} required multiline maxLength={2000} placeholder="Describe the purpose or treatment summary…" value={purpose} onChangeText={setPurpose} />
          <FormError message={preview ? null : error} />
          <Button
            icon="eye-outline"
            label="Preview Certificate"
            style={ui.spacedTop}
            busy={busy && !preview}
            disabled={!patientId || !purpose.trim()}
            onPress={() => run(async () => setPreview(await previewCertificate(clinicId, body)), 'The certificate could not be prepared.')}
          />
        </Card>
        {preview ? (
          <Card>
            <Text style={styles.clinic}>{preview.clinic.name}</Text>
            {preview.clinic.address ? <Text style={[ui.small, styles.center]}>{preview.clinic.address}</Text> : null}
            <Text style={styles.badge}>{preview.title}</Text>
            <View style={styles.body}>
              <Text style={ui.muted}>
                This is to certify that <Text style={styles.bold}>{preview.patient.name}</Text>
                {preview.patient.description ? `, ${preview.patient.description},` : ''} {preview.statement}
              </Text>
              <Text style={[styles.bold, styles.purpose]}>{preview.purpose}</Text>
            </View>
            <View style={styles.sign} />
            <Text style={[styles.bold, styles.center]}>{preview.dentist.name}</Text>
            {preview.dentist.specialization ? <Text style={[ui.small, styles.center]}>{preview.dentist.specialization}</Text> : null}
            <Text style={[ui.small, styles.center]}>PRC: {preview.dentist.license_number || 'Not on file'}</Text>
            <Text style={[ui.small, styles.center]}>Issued: {dayOfIso(preview.issued_at)}</Text>
            {!preview.dentist.license_number && <NoteBox tone="danger">Your PRC licence number is not on file. Ask your clinic administrator to add it before printing.</NoteBox>}
            <FormError message={error} />
            <Button
              icon="download-outline"
              label="Print Certificate"
              style={ui.spacedTop}
              busy={busy}
              disabled={!preview.dentist.license_number}
              onPress={() => run(async () => { await Linking.openURL(await issueCertificateUrl(clinicId, body)); }, 'The certificate could not be issued.')}
            />
            <Text style={[ui.small, styles.center]}>Printing issues the certificate and adds it to the audit log.</Text>
          </Card>
        ) : (
          <Card>
            <Text style={[ui.title, styles.center]}>Certificate Preview</Text>
            <Text style={[ui.small, styles.center]}>Fill in the form and tap Preview to see the certificate.</Text>
          </Card>
        )}
      </ScrollView>
    </ClinicScreen>
  );
};

const styles = StyleSheet.create({
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  foot: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  type: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, marginTop: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: palette.surfaceContainerHigh },
  typeActive: { borderColor: palette.primary, backgroundColor: palette.primaryFixed },
  typeTitle: { fontSize: 14, fontWeight: '600', color: palette.onSurface },
  typeTitleActive: { color: palette.primary },
  clinic: { fontSize: 15, fontWeight: '700', textAlign: 'center', textTransform: 'uppercase', color: palette.primary },
  center: { textAlign: 'center' },
  badge: { alignSelf: 'center', marginVertical: spacing.sm, paddingVertical: 4, paddingHorizontal: spacing.md, borderRadius: 999, overflow: 'hidden', backgroundColor: palette.primary, color: '#ffffff', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  body: { paddingVertical: spacing.sm, borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.surfaceContainerHigh },
  bold: { fontWeight: '700', color: palette.onSurface },
  purpose: { marginTop: spacing.xs },
  sign: { alignSelf: 'center', width: 110, marginTop: spacing.xl, marginBottom: spacing.xs, borderTopWidth: 1, borderTopColor: palette.onSurface },
});
