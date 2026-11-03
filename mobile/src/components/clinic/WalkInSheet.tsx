// Books a walk-in (web: components/portal/WalkInAction.jsx): choose or register
// the patient, the dentist and service, then a free slot. The API confirms it
// at once (walk_in), since the patient is at the clinic.
import React, { useEffect, useRef, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Button, Chips, Field, FormError, LoadState, SearchBox, SelectField, Sheet, ui, useLoader } from './ClinicUi';
import { SlotPicker } from './SlotPicker';
import { Slot } from '../../services/booking';
import { bookForPatient, ClinicPatient, fetchDentists, fetchPatients, fetchServices, formatDateTime, registerPatient, serverMessage } from '../../services/clinicPortal';

type Mode = 'existing' | 'new';

function PatientSearch({ clinicId, onPick }: { clinicId: number; onPick: (patient: ClinicPatient) => void }) {
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
    <View style={ui.spacedTop}>
      <SearchBox value={term} onChangeText={setTerm} placeholder="Search name, email or mobile number" />
      <FormError message={error} />
      {results?.length === 0 && <Text style={[ui.muted, ui.spacedTop]}>No patient found. Use New patient to register them.</Text>}
      {results?.map((p) => (
        <TouchableOpacity key={p.id} style={[ui.listItem, ui.spacedTop]} onPress={() => onPick(p)} accessibilityRole="button" accessibilityLabel={`Choose ${p.name}`}>
          <Text style={ui.title}>{p.name}</Text>
          <Text style={ui.small}>{[p.phone, p.email].filter(Boolean).join(' · ')}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export function WalkInSheet({ clinicId, canRegister, onClose, onBooked }: { clinicId: number; canRegister: boolean; onClose: () => void; onBooked: () => void }) {
  const [mode, setMode] = useState<Mode>('existing');
  const [patient, setPatient] = useState<ClinicPatient | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [dentistId, setDentistId] = useState<number | null>(null);
  const [serviceRateId, setServiceRateId] = useState<number | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<string | null>(null);
  // A patient registered before a failed booking is reused on the next try.
  const registeredId = useRef<number | null>(null);

  const options = useLoader(async () => {
    const [dentists, services] = await Promise.all([fetchDentists(clinicId), fetchServices(clinicId)]);
    return { dentists, services };
  }, [clinicId], 'Dentists and services could not be loaded.');

  const hasPatient = mode === 'existing' ? Boolean(patient) : Boolean(fullName.trim() && phone.trim());

  const book = async () => {
    if (!slot || !dentistId || !serviceRateId) return;
    setBusy(true);
    setError(null);
    try {
      let patientId = patient?.id ?? registeredId.current;
      if (!patientId) {
        patientId = (await registerPatient(clinicId, { full_name: fullName.trim(), phone: phone.trim() })).id;
        registeredId.current = patientId;
      }
      await bookForPatient(clinicId, { patient_id: patientId, service_rate_id: serviceRateId, dentist_id: dentistId, branch_id: slot.branchId, starts_at: slot.startsAt, walk_in: true });
      setBooked(formatDateTime(slot.startsAt));
      onBooked();
    } catch (err) {
      setError(serverMessage(err, 'The walk-in could not be booked.'));
    } finally {
      setBusy(false);
    }
  };

  if (booked) {
    return (
      <Sheet title="Walk-in booked" onClose={onClose}>
        <Text style={ui.muted}>
          {patient?.name ?? fullName.trim()} is confirmed for {booked}.
        </Text>
        <Button label="Done" style={ui.spacedTop} onPress={onClose} />
      </Sheet>
    );
  }

  return (
    <Sheet title="Walk-in appointment" onClose={busy ? () => undefined : onClose}>
      <LoadState loading={options.loading} error={options.error} onRetry={options.reload} />
      {canRegister && (
        <Chips<Mode>
          options={[
            { id: 'existing', label: 'Existing patient' },
            { id: 'new', label: 'New patient' },
          ]}
          value={mode}
          scroll={false}
          onChange={(next) => {
            setMode(next);
            setPatient(null);
            registeredId.current = null;
          }}
        />
      )}
      {mode === 'new' ? (
        <>
          <Field label="Full name" required maxLength={255} value={fullName} onChangeText={setFullName} />
          <Field label="Mobile number" required keyboardType="phone-pad" maxLength={30} value={phone} onChangeText={setPhone} />
        </>
      ) : patient ? (
        <View style={[ui.listItem, ui.spacedTop]}>
          <Text style={ui.title}>{patient.name}</Text>
          {patient.phone ? <Text style={ui.small}>{patient.phone}</Text> : null}
          <Button small variant="outline" label="Change patient" onPress={() => setPatient(null)} />
        </View>
      ) : (
        <PatientSearch clinicId={clinicId} onPick={setPatient} />
      )}
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
            options={options.data.dentists.filter((d) => d.is_active).map((d) => ({ id: d.id, label: d.name }))}
          />
          <SelectField
            label="Service"
            required
            value={serviceRateId}
            onChange={(id) => {
              setServiceRateId(id);
              setSlot(null);
            }}
            options={options.data.services.filter((s) => s.is_available).map((s) => ({ id: s.id, label: `${s.name} (${s.duration_minutes} min)` }))}
          />
          {dentistId && serviceRateId ? (
            <SlotPicker clinicId={clinicId} dentistId={dentistId} serviceRateId={serviceRateId} selected={slot} onSelect={setSlot} />
          ) : (
            <Text style={[ui.muted, ui.spacedTop]}>Choose a dentist and a service to see open times.</Text>
          )}
          <FormError message={error} />
          <Button label={slot ? `Book ${formatDateTime(slot.startsAt)}` : 'Choose a time'} style={ui.spacedTop} busy={busy} disabled={!slot || !hasPatient} onPress={book} />
        </>
      )}
    </Sheet>
  );
}
