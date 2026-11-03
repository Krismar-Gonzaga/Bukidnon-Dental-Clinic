// Clinical records across the dentist's patients (web ClinicRecordsPage),
// newest first. Current versions only; corrected originals stay on each
// patient's page. The server logs every list it returns.
import React, { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { Badge, Button, Card, Chips, EmptyState, InfoRow, LoadState, Pager, SearchBox, Toggle, ui, useLoader, useRefreshOnFocus } from '../../components/clinic/ClinicUi';
import { NewRecordSheet } from '../../components/clinic/RecordSheet';
import { can, ClinicPatient, fetchClinicRecords, formatDateTime, RECORD_TYPES, recordTypeLabel } from '../../services/clinicPortal';

const PAGE_SIZE = 15;
const TYPE_OPTIONS = [{ id: '', label: 'All types' }, ...RECORD_TYPES];

function useDebounced(value: string, ms = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

const ClinicRecordsScreen = ({ route }: { route?: { params?: { mine?: boolean } } }) => {
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const [search, setSearch] = useState('');
  const [recordType, setRecordType] = useState<string>('');
  const [mine, setMine] = useState(Boolean(route?.params?.mine));
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState<ClinicPatient | null>(null);
  const term = useDebounced(search.trim());

  const records = useLoader(
    () => fetchClinicRecords(clinicId, { search: term || undefined, record_type: recordType || undefined, mine: mine ? 1 : undefined, page, per_page: PAGE_SIZE }),
    [clinicId, term, recordType, mine, page],
    'Records could not be loaded.',
  );
  useRefreshOnFocus(records.sync);

  const resetPage = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPage(1);
  };
  const filtered = Boolean(term || recordType || mine);

  return (
    <ClinicScreen title="Records" active="ClinicRecords">
      <ScrollView
        contentContainerStyle={ui.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={records.refreshing} onRefresh={records.refresh} />}
      >
        <Card
          title="Clinical records"
          subtitle="Current versions only. Viewing is logged."
          action={can(membership, 'records.write') ? <Button small variant="tonal" icon="add" label="New" onPress={() => setAdding(true)} /> : undefined}
        >
          <View style={ui.stack}>
            <SearchBox value={search} onChangeText={resetPage(setSearch)} placeholder="Search by patient name" />
            <Chips options={TYPE_OPTIONS} value={recordType} onChange={resetPage(setRecordType)} />
            <Toggle label="Only records I wrote" value={mine} onChange={resetPage(setMine)} />
          </View>
          {saved && <Text style={ui.success} accessibilityLiveRegion="polite">Record saved for {saved.name}.</Text>}
        </Card>

        <LoadState loading={records.loading} error={records.error} onRetry={records.reload} />
        {records.data && records.data.items.length === 0 && (
          <EmptyState icon="document-text-outline" text={filtered ? 'No records match these filters.' : 'No clinical records yet.'} />
        )}
        {(records.data?.items ?? []).map((r) => (
          <TouchableOpacity
            key={r.id}
            style={ui.listItem}
            onPress={() => navigation.navigate('ClinicPatientDetail', { patientId: r.patient_id })}
            accessibilityRole="button"
            accessibilityHint="Opens the patient's page"
          >
            <View style={ui.between}>
              <Text style={[ui.title, ui.flex]} numberOfLines={1}>{r.patient?.name ?? 'Patient'}</Text>
              <Badge tone="info" label={recordTypeLabel(r.record_type)} />
            </View>
            <Text style={ui.small}>
              {formatDateTime(r.created_at)} · {r.dentist ?? r.author ?? '—'}
              {r.amends_record_id ? ' · correction' : ''}
              {r.is_patient_visible ? ' · shared with patient' : ''}
            </Text>
            {r.chief_complaint ? <InfoRow label="Complaint" value={r.chief_complaint} /> : null}
            {r.findings ? <InfoRow label="Findings" value={r.findings} /> : null}
            {r.procedures ? <InfoRow label="Procedures" value={r.procedures} /> : null}
            {r.tooth_numbers ? <InfoRow label="Teeth" value={r.tooth_numbers} /> : null}
            {r.care_instructions ? <InfoRow label="Care" value={r.care_instructions} /> : null}
          </TouchableOpacity>
        ))}
        {records.data && <Pager page={page} lastPage={records.data.meta.last_page ?? 1} onChange={setPage} />}
      </ScrollView>

      {adding && (
        <NewRecordSheet
          clinicId={clinicId}
          title="New clinical record"
          onClose={() => setAdding(false)}
          onSaved={(patient) => {
            setSaved(patient);
            records.sync();
          }}
        />
      )}
    </ClinicScreen>
  );
};

export default ClinicRecordsScreen;
