// Dental Chart (web: DentalChartPage): all 32 teeth of a patient, two rows of eight per jaw.
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ClinicScreen } from '../../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../../components/clinic/ClinicPortalContext';
import { Button, Card, EmptyState, Field, FormError, LoadState, SelectField, ui, useLoader } from '../../../components/clinic/ClinicUi';
import { serverMessage } from '../../../services/clinicPortal';
import { fetchDentalChart, saveTooth, Tooth } from '../../../services/dentistPortal';
import { palette, radius, spacing } from '../../../theme/tokens';
import { dayOfIso, PatientLine, usePatientOptions } from './dentistKit';

const STATUSES = [
  { id: 'healthy', label: 'Healthy', mark: '', border: '#86e0b4', fill: '#d7f8e6' },
  { id: 'caries', label: 'Caries', mark: '^', border: '#f9a8a8', fill: '#fee2e2' },
  { id: 'filled', label: 'Filled', mark: '•', border: '#93bbfb', fill: '#dbe8fe' },
  { id: 'crown', label: 'Crown', mark: '▪', border: '#c4b5fd', fill: '#ede9fe' },
  { id: 'missing', label: 'Missing', mark: '×', border: '#c9ced8', fill: '#f1f3f6' },
  { id: 'planned', label: 'Planned', mark: '–', border: '#fdba74', fill: '#ffedd5' },
];

const UPPER = Array.from({ length: 16 }, (_, i) => i + 1);
const LOWER = Array.from({ length: 16 }, (_, i) => 32 - i);
const statusOf = (id: string) => STATUSES.find((s) => s.id === id) ?? STATUSES[0];

function ToothButton({ tooth, selected, onPress }: { tooth: Tooth; selected: boolean; onPress: () => void }) {
  const status = statusOf(tooth.status);
  return (
    <TouchableOpacity
      style={[styles.tooth, selected && styles.toothSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Tooth ${tooth.number}, ${status.label}`}
    >
      <Text style={styles.toothNumber}>{tooth.number}</Text>
      <View style={[styles.face, { borderColor: status.border, backgroundColor: status.fill }]}>
        <Text style={styles.mark}>{status.mark}</Text>
      </View>
    </TouchableOpacity>
  );
}

const DentalChartScreen = ({ route }: { route?: { params?: { patientId?: number } } }) => {
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const { patients, loading: patientsLoading } = usePatientOptions();
  const [patientId, setPatientId] = useState<number | null>(route?.params?.patientId ?? null);
  const patient = patients.find((p) => p.id === patientId) ?? patients[0];
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState('healthy');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chart = useLoader(() => (patient ? fetchDentalChart(clinicId, patient.id) : Promise.resolve(null)), [clinicId, patient?.id], 'The dental chart could not be loaded.');
  const data = chart.data;
  const tooth = data?.teeth.find((t) => t.number === selected) ?? null;

  useEffect(() => setSelected(null), [patient?.id]);
  useEffect(() => {
    setStatus(tooth?.status ?? 'healthy');
    setNotes(tooth?.notes ?? '');
  }, [tooth?.number, tooth?.status, tooth?.notes]);
  // Only when another tooth is opened: the refresh after saving must not clear "Tooth saved".
  useEffect(() => {
    setSaved(false);
    setError(null);
  }, [tooth?.number]);

  const save = async () => {
    if (!patient || !selected) return;
    setBusy(true);
    setError(null);
    try {
      chart.setData(await saveTooth(clinicId, patient.id, selected, { status, notes: notes.trim() || null }));
      setSaved(true);
    } catch (err) {
      setError(serverMessage(err, 'This tooth could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  const row = (numbers: number[]) => (
    <View style={styles.jaw}>
      {numbers.map((number) => {
        const item = data?.teeth.find((t) => t.number === number);
        return item ? <ToothButton key={number} tooth={item} selected={selected === number} onPress={() => setSelected(number)} /> : null;
      })}
    </View>
  );

  return (
    <ClinicScreen title="Dental Chart" active="ClinicDentalChart" back={Boolean(route?.params?.patientId)}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={chart.refreshing} onRefresh={chart.refresh} />}>
        {!patientsLoading && patients.length === 0 && <EmptyState icon="pulse-outline" text="Patients appear here once they have an appointment with you." />}
        {patients.length > 0 && <SelectField<number> label="Patient" options={patients.map((p) => ({ id: p.id, label: p.name }))} value={patient?.id} onChange={setPatientId} />}
        <LoadState loading={chart.loading} error={chart.error} onRetry={chart.reload} />
        {data && patient && (
          <>
            <Card>
              <PatientLine name={patient.name} sub={data.last_updated_at ? `Last updated: ${dayOfIso(data.last_updated_at)}` : 'Not charted yet: every tooth shows as healthy until you record otherwise.'} />
              <Text style={styles.jawTitle}>UPPER JAW (MAXILLARY)</Text>
              {row(UPPER)}
              <View style={styles.sides}>
                <Text style={ui.small}>Patient&apos;s Right</Text>
                <Text style={ui.small}>Patient&apos;s Left</Text>
              </View>
              {row(LOWER)}
              <Text style={styles.jawTitle}>LOWER JAW (MANDIBULAR)</Text>
              <View style={styles.legend}>
                {STATUSES.map((s) => (
                  <View key={s.id} style={styles.legendItem}>
                    <View style={[styles.swatch, { borderColor: s.border, backgroundColor: s.fill }]} />
                    <Text style={ui.small}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </Card>

            {tooth ? (
              <Card title={`Tooth #${tooth.number}`}>
                <SelectField<string> label="Status" options={STATUSES.map(({ id, label }) => ({ id, label }))} value={status} onChange={setStatus} />
                <Field label="Clinical Notes" multiline maxLength={2000} placeholder="Add notes for this tooth…" value={notes} onChangeText={setNotes} />
                <FormError message={error} />
                {saved && <Text style={styles.saved}>Tooth saved</Text>}
                <Button label="Save Changes" style={ui.spacedTop} busy={busy} onPress={save} />
              </Card>
            ) : (
              <Card>
                <Text style={[ui.title, styles.center]}>Select a tooth</Text>
                <Text style={[ui.small, styles.center]}>Tap any tooth on the chart to view or edit its status.</Text>
              </Card>
            )}

            <Card title="Chart Summary">
              {STATUSES.map((s) => (
                <View key={s.id} style={styles.summary}>
                  <View style={[styles.swatch, styles.round, { borderColor: s.border, backgroundColor: s.fill }]} />
                  <Text style={[ui.muted, ui.flex]}>{s.label}</Text>
                  <Text style={styles.count}>{data.summary[s.id] ?? 0}</Text>
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </ClinicScreen>
  );
};

export default DentalChartScreen;

const styles = StyleSheet.create({
  jawTitle: { marginVertical: spacing.sm, fontSize: 11, fontWeight: '700', textAlign: 'center', color: palette.onSurfaceVariant },
  jaw: { flexDirection: 'row', flexWrap: 'wrap' },
  tooth: { width: '12.5%', alignItems: 'center', paddingVertical: 4, borderWidth: 2, borderColor: 'transparent', borderRadius: radius.sm },
  toothSelected: { borderColor: palette.primary },
  toothNumber: { fontSize: 10, fontWeight: '600', color: palette.onSurfaceVariant, marginBottom: 2 },
  face: { width: 30, height: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderRadius: radius.sm },
  mark: { fontSize: 13, fontWeight: '700', color: palette.onSurface },
  sides: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: palette.surfaceContainerHigh },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: palette.surfaceContainerHigh },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 14, height: 14, borderWidth: 2, borderRadius: 4 },
  round: { borderRadius: 7 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: palette.surfaceContainerHigh },
  count: { fontWeight: '700', color: palette.onSurface },
  center: { textAlign: 'center' },
  saved: { marginTop: spacing.xs, fontSize: 13, fontWeight: '600', color: palette.primary },
});
