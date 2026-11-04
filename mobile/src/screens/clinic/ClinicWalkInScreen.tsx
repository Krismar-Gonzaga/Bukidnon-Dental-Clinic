// Walk-in registration (web: ClinicWalkInPage): find or register the patient,
// choose service, dentist and a free slot. The API confirms it at once.
import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ClinicScreen } from '../../components/clinic/ClinicChrome';
import { useClinicPortal } from '../../components/clinic/ClinicPortalContext';
import { Button, Card, Field, FormError, LoadState, SearchBox, SelectField, ui, useLoader } from '../../components/clinic/ClinicUi';
import { SlotPicker } from '../../components/clinic/SlotPicker';
import { Slot } from '../../services/booking';
import { bookForPatient, can, ClinicPatient, fetchDentists, fetchPatients, fetchServices, formatDateTime, registerPatient, serverMessage } from '../../services/clinicPortal';

function PatientLookup({ clinicId, onPick }: { clinicId: number; onPick: (patient: ClinicPatient) => void }) {
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
    <View>
      <Text style={ui.small}>Patient lookup</Text>
      <SearchBox value={term} onChangeText={setTerm} placeholder="Search existing patient by name or phone..." />
      <FormError message={error} />
      {results?.length === 0 && <Text style={[ui.muted, ui.spacedTop]}>No patient found. Register them below.</Text>}
      {results?.map((p) => (
        <TouchableOpacity key={p.id} style={[ui.listItem, ui.spacedTop]} onPress={() => onPick(p)} accessibilityRole="button" accessibilityLabel={`Choose ${p.name}`}>
          <Text style={ui.title}>{p.name}</Text>
          <Text style={ui.small}>{[p.phone, p.email].filter(Boolean).join(' · ')}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// `scheduled` books for a later time instead (Schedule Appointment).
const ClinicWalkInScreen = ({ route }: { route?: { params?: { scheduled?: boolean } } }) => {
  const scheduled = Boolean(route?.params?.scheduled);
  const navigation = useNavigation<any>();
  const { membership } = useClinicPortal();
  const clinicId = membership?.clinic_id ?? 0;
  const [patient, setPatient] = useState<ClinicPatient | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceRateId, setServiceRateId] = useState<number | null>(null);
  const [dentistId, setDentistId] = useState<number | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A patient registered before a failed booking is reused on the next try.
  const registeredId = useRef<number | null>(null);
  const canRegister = can(membership, 'patients.manage');

  const options = useLoader(async () => {
    const [dentists, services] = await Promise.all([fetchDentists(clinicId), fetchServices(clinicId)]);
    return { dentists, services };
  }, [clinicId], 'Dentists and services could not be loaded.');

  const hasPatient = Boolean(patient) || Boolean(firstName.trim() && phone.trim());

  const book = async () => {
    if (!slot || !dentistId || !serviceRateId) return;
    setBusy(true);
    setError(null);
    try {
      let patientId = patient?.id ?? registeredId.current;
      if (!patientId) {
        patientId = (await registerPatient(clinicId, { full_name: `${firstName.trim()} ${lastName.trim()}`.trim(), phone: phone.trim() })).id;
        registeredId.current = patientId;
      }
      const response = await bookForPatient(clinicId, {
        patient_id: patientId,
        service_rate_id: serviceRateId,
        dentist_id: dentistId,
        branch_id: slot.branchId,
        starts_at: slot.startsAt,
        notes: notes.trim() || undefined,
        ...(scheduled ? {} : { walk_in: true }),
      });
      navigation.replace('ClinicAppointmentDetail', { appointmentId: response.data?.data?.id });
    } catch (err) {
      setError(serverMessage(err, 'The walk-in could not be registered.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ClinicScreen title={scheduled ? 'Schedule Appointment' : 'Walk-in Appointment'} active="ClinicAppointments" back>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <Card title={scheduled ? 'Schedule Appointment' : 'Walk-in Registration'} subtitle={scheduled ? 'Choose the patient, service, dentist and an open time' : 'Register a patient who arrived without prior booking'}>
          <LoadState loading={options.loading} error={options.error} onRetry={options.reload} />
          {patient ? (
            <View style={ui.listItem}>
              <Text style={ui.title}>{patient.name}</Text>
              {patient.phone ? <Text style={ui.small}>{patient.phone}</Text> : null}
              <Button small variant="outline" label="Change patient" onPress={() => setPatient(null)} />
            </View>
          ) : (
            <>
              <PatientLookup clinicId={clinicId} onPick={setPatient} />
              {canRegister && (
                <>
                  <Text style={[ui.small, ui.spacedTop]}>— or register a new patient —</Text>
                  <Field label="First name" required autoCapitalize="words" maxLength={120} placeholder="Juan" value={firstName} onChangeText={setFirstName} />
                  <Field label="Last name" autoCapitalize="words" maxLength={120} placeholder="Dela Cruz" value={lastName} onChangeText={setLastName} />
                  <Field label="Phone number" required keyboardType="phone-pad" maxLength={30} value={phone} onChangeText={setPhone} />
                </>
              )}
            </>
          )}
          {options.data && (
            <>
              <SelectField
                label="Service"
                required
                value={serviceRateId}
                onChange={(id) => {
                  setServiceRateId(id);
                  setSlot(null);
                }}
                options={options.data.services.filter((s) => s.is_available).map((s) => ({ id: s.id, label: s.name }))}
              />
              <SelectField
                label="Assign dentist"
                required
                value={dentistId}
                onChange={(id) => {
                  setDentistId(id);
                  setSlot(null);
                }}
                options={options.data.dentists.filter((d) => d.is_active).map((d) => ({ id: d.id, label: d.name }))}
              />
              {dentistId && serviceRateId ? (
                <SlotPicker clinicId={clinicId} dentistId={dentistId} serviceRateId={serviceRateId} selected={slot} onSelect={setSlot} />
              ) : (
                <Text style={ui.muted}>Choose a service and a dentist to see open times.</Text>
              )}
              <Field label="Notes / special instructions" multiline maxLength={2000} placeholder="Any medical alerts, special requests, or notes for the dentist..." value={notes} onChangeText={setNotes} />
              <FormError message={error} />
              <Button label={`${scheduled ? 'Schedule Appointment' : 'Register Walk-in'}${slot ? ` · ${formatDateTime(slot.startsAt)}` : ''}`} busy={busy} disabled={!slot || !hasPatient} onPress={book} />
            </>
          )}
        </Card>
      </ScrollView>
    </ClinicScreen>
  );
};

export default ClinicWalkInScreen;
