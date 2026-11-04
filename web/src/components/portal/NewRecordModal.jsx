import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Field, Modal } from './PortalUi';
import { EMPTY_RECORD, RecordModal } from './RecordForm';
import { ErrorState, LoadingState } from '../StatusMessage';
import { createRecord, getClinicAppointments, getClinicPatients } from '../../services/clinicPortalApi';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { addDaysToKey, businessTodayKey, formatShortDate, formatTime } from '../../utils/dateTime';

const PICKER_SIZE = 8;
const RECENT_VISIT_DAYS = 60;

/** Search the patients the member can see (dentists: their own) and pick one. */
function PatientPicker({ clinicId, title, onPick, onClose }) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'patients', 'picker', debouncedSearch],
    queryFn: () => getClinicPatients(clinicId, { search: debouncedSearch || undefined, per_page: PICKER_SIZE }),
    placeholderData: keepPreviousData,
  });

  return (
    <Modal title={title} onClose={onClose}>
      <Field
        label="Patient"
        type="search"
        placeholder="Search by name, email or phone"
        maxLength={100}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {query.isPending ? (
        <LoadingState label="Loading patients…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <p className="portal-empty">{debouncedSearch ? 'No patients match this search.' : 'No patients yet.'}</p>
      ) : (
        <ul className="portal-pick-list" aria-label="Patients">
          {query.data.items.map((patient) => (
            <li key={patient.id}>
              <button type="button" className="portal-pick-item" onClick={() => onPick(patient)}>
                <span className="portal-pick-name">{patient.name}</span>
                <span className="portal-table-muted">{[patient.phone, patient.email].filter(Boolean).join(' · ') || 'No contact details'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

/**
 * New clinical record from anywhere in the portal (dashboard quick actions,
 * Records page): pick the patient, then fill in the record. The visit list
 * only offers this patient's recent appointments the member can see.
 */
function NewRecordModal({ clinicId, title, recordType = EMPTY_RECORD.record_type, onClose, onSaved }) {
  const queryClient = useQueryClient();
  const [patient, setPatient] = useState(null);
  const today = businessTodayKey();

  const visits = useQuery({
    queryKey: ['clinic', clinicId, 'appointments', 'patient', patient?.id, 'recent'],
    queryFn: () =>
      getClinicAppointments(clinicId, { patient_id: patient.id, from: addDaysToKey(today, -RECENT_VISIT_DAYS), to: today, per_page: 50 }),
    enabled: Boolean(patient),
  });

  const save = useMutation({
    mutationFn: (form) => createRecord(clinicId, patient.id, form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'records'] });
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'patient', String(patient.id), 'records'] });
      onSaved?.(patient);
      onClose();
    },
  });

  if (!patient) return <PatientPicker clinicId={clinicId} title={title} onPick={setPatient} onClose={onClose} />;

  const appointmentOptions = (visits.data?.appointments ?? [])
    .slice()
    .reverse()
    .map((a) => ({ value: a.id, label: `${formatShortDate(a.startsAt)}, ${formatTime(a.startsAt)} · ${a.service}` }));

  return (
    <RecordModal
      title={title}
      onClose={onClose}
      initial={{ ...EMPTY_RECORD, record_type: recordType }}
      patientName={patient.name}
      appointmentOptions={appointmentOptions}
      isSaving={save.isPending}
      error={save.error}
      onSave={(form) => save.mutate(form)}
    >
      <p className="portal-record-patient">
        Patient: <strong>{patient.name}</strong>
      </p>
    </RecordModal>
  );
}

export default NewRecordModal;
