// Clinic patients (web: ClinicPatientsPage): search, paging and walk-in
// registration. Clinical records open from each patient (dentists only).
import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import {
  Badge,
  Button,
  Chips,
  EmptyState,
  Field,
  FormError,
  LoadState,
  Pager,
  SearchBox,
  Sheet,
  ui,
  useLoader,
  useRefreshOnFocus,
} from '../../components/clinic/ClinicUi';
import { DateField } from '../../components/clinic/DateField';
import { can, ClinicPatient, fetchPatients, registerPatient, serverMessage } from '../../services/clinicPortal';
import { palette } from '../../theme/tokens';

export const GENDERS = [
  { id: '', label: 'Not given' },
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'other', label: 'Other' },
];

const EMPTY_FORM = { full_name: '', phone: '', email: '', birth_date: '', gender: '', address: '' };

function RegisterSheet({ clinicId, onClose, onSaved }: { clinicId: number; onClose: () => void; onSaved: (patient: ClinicPatient) => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bind = (name: keyof typeof EMPTY_FORM) => ({ value: form[name], onChangeText: (v: string) => setForm((f) => ({ ...f, [name]: v })) });

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      // Blank optional fields are left out, as on the web form.
      const patient = await registerPatient(clinicId, Object.fromEntries(Object.entries(form).filter(([, v]) => v !== '')));
      onSaved(patient);
    } catch (err) {
      setError(serverMessage(err, 'The patient could not be registered.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Register walk-in patient" onClose={onClose}>
      <Field label="Full name" required {...bind('full_name')} autoCapitalize="words" />
      <Field label="Mobile number" required keyboardType="phone-pad" {...bind('phone')} />
      <Field label="Email (optional)" keyboardType="email-address" autoCapitalize="none" {...bind('email')} />
      <DateField label="Date of birth" value={form.birth_date} onChange={(v) => setForm((f) => ({ ...f, birth_date: v }))} clearable />
      <Text style={[ui.small, ui.spacedTop]}>Gender</Text>
      <Chips options={GENDERS} value={form.gender} onChange={(gender) => setForm((f) => ({ ...f, gender }))} scroll={false} />
      <Field label="Address" {...bind('address')} />
      <FormError message={error} />
      <Button label="Register patient" style={ui.spacedTop} busy={busy} disabled={!form.full_name.trim() || !form.phone.trim()} onPress={submit} />
    </Sheet>
  );
}

// params.register (dentist overview quick action) opens the walk-in form.
const ClinicPatientsScreen = ({ route }: { route?: { params?: { search?: string; register?: boolean } } }) => {
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const [search, setSearch] = useState(route?.params?.search ?? '');
  const [term, setTerm] = useState(search.trim());
  const [page, setPage] = useState(1);
  const [registering, setRegistering] = useState(Boolean(route?.params?.register));

  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const list = useLoader(() => fetchPatients(clinicId, { search: term || undefined, page, per_page: 20 }), [clinicId, term, page], 'Patients could not be loaded.');
  useRefreshOnFocus(list.sync);
  const open = (patient: ClinicPatient) => navigation.navigate('ClinicPatientDetail', { patientId: patient.id });

  return (
    <ClinicScreen title="Patients" active="ClinicPatients">
      <FlatList
        data={list.loading ? [] : list.data?.items ?? []}
        keyExtractor={(p) => String(p.id)}
        contentContainerStyle={ui.content}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} colors={[palette.primary]} />}
        ListHeaderComponent={
          <View style={ui.stack}>
            <View style={ui.between}>
              <View style={ui.flex}>
                <Text style={ui.heading}>Patient list</Text>
                <Text style={ui.muted}>Patients registered with this clinic.</Text>
              </View>
              {can(membership, 'patients.manage') && <Button small variant="tonal" icon="person-add-outline" label="Register" onPress={() => setRegistering(true)} />}
            </View>
            <SearchBox value={search} onChangeText={setSearch} placeholder="Search name, phone or email…" />
            <LoadState loading={list.loading} error={list.data ? null : list.error} onRetry={list.reload} />
          </View>
        }
        ListEmptyComponent={list.loading || list.error ? undefined : <EmptyState icon="people-outline" text={term ? `No patients match “${term}”.` : 'No patients yet.'} />}
        ListFooterComponent={list.data ? <Pager page={page} lastPage={list.data.meta.last_page} onChange={setPage} /> : undefined}
        renderItem={({ item }) => (
          <TouchableOpacity style={ui.listItem} onPress={() => open(item)} accessibilityRole="button" accessibilityLabel={`Open ${item.name}`}>
            <View style={ui.between}>
              <Text style={ui.title}>{item.name}</Text>
              <Icon name="chevron-forward" size={18} color={palette.outline} />
            </View>
            <Text style={ui.muted}>{[item.phone, item.email].filter(Boolean).join(' · ') || 'No contact details'}</Text>
            <Badge tone={item.has_portal_account ? 'info' : 'neutral'} label={item.has_portal_account ? 'Portal account' : 'Walk-in'} />
          </TouchableOpacity>
        )}
      />
      {registering && can(membership, 'patients.manage') && (
        <RegisterSheet
          clinicId={clinicId}
          onClose={() => setRegistering(false)}
          onSaved={(patient) => {
            setRegistering(false);
            list.sync();
            if (patient?.id) open(patient);
          }}
        />
      )}
    </ClinicScreen>
  );
};

export default ClinicPatientsScreen;
