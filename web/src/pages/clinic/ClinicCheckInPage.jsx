import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { Card } from '../../components/clinic/ClinicAdminUi';
import { InitialsTile, Pill } from '../../components/clinic/ClinicUi';
import { FormError } from '../../components/portal/PortalUi';
import { QueryState } from '../../components/StatusMessage';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { appointmentAction, getCheckInQueue, getClinicAppointment, getClinicAppointments, getClinicPatients } from '../../services/clinicPortalApi';
import { businessTodayKey, formatDate, formatTime } from '../../utils/dateTime';
import { ageFrom } from './ClinicPatientsPage';
import { statusOf } from './frontDesk';
import '../../components/clinic/ClinicAdminUi.css';
import './FrontDesk.css';

const STEPS = ['Search Patient', 'Select Appointment', 'Confirm Details', 'Check In'];
const GENDER_LABELS = { male: 'Male', female: 'Female', other: 'Other' };

const describePatient = (patient) => {
  const age = ageFrom(patient.birth_date);
  return [age != null ? age : null, GENDER_LABELS[patient.gender], patient.phone].filter((part) => part != null && part !== '').join(' · ');
};

function Steps({ current }) {
  return (
    <ol className="frontdesk-steps" aria-label="Check-in steps">
      {STEPS.map((label, index) => {
        const isDone = index < current || current === STEPS.length - 1;
        return (
          <li key={label} className="frontdesk-steps-item" style={{ display: 'contents' }}>
            {index > 0 && <span className={`frontdesk-step-line${index <= current ? ' is-on' : ''}`} aria-hidden="true" />}
            <span className={`frontdesk-step${index <= current ? ' is-on' : ''}${isDone ? ' is-done' : ''}${index === current ? ' is-current' : ''}`} aria-current={index === current ? 'step' : undefined}>
              <span className="frontdesk-step-dot">{isDone ? <Icon name="check" size={14} /> : index + 1}</span>
              <span className="frontdesk-step-label">{label}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function SearchStep({ clinicId, onPick }) {
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search.trim());
  const results = useQuery({
    queryKey: ['clinic', clinicId, 'patients', 'check-in', term],
    queryFn: () => getClinicPatients(clinicId, { search: term, per_page: 6 }),
    enabled: term.length >= 2,
  });
  const items = results.data?.items ?? [];

  return (
    <>
      <label className="clinic-search">
        <Icon name="search" size={18} />
        <span className="visually-hidden">Search patient by name or phone</span>
        <input type="search" autoFocus maxLength={100} placeholder="Search patient by name or phone..." value={search} onChange={(event) => setSearch(event.target.value)} />
      </label>
      {term.length >= 2 && (
        <div className="clinic-form-gap" aria-live="polite">
          {results.isFetching && <p className="clinic-admin-card-sub">Searching…</p>}
          {results.isError && <FormError error={results.error} />}
          {results.isSuccess && items.length === 0 && <p className="clinic-admin-card-sub">No patient found.</p>}
          <ul className="frontdesk-list">
            {items.map((patient) => (
              <li key={patient.id}>
                <button type="button" className="frontdesk-pick" onClick={() => onPick(patient)}>
                  <InitialsTile name={patient.name} size="sm" tone="navy" />
                  <span className="frontdesk-row-body">
                    <span className="frontdesk-row-title">{patient.name}</span>
                    <br />
                    <span className="frontdesk-row-sub">{describePatient(patient)}</span>
                  </span>
                  <Icon name="chevronRight" size={18} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function SelectStep({ clinicId, patient, onPick, onBack }) {
  const today = businessTodayKey();
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'appointments', 'check-in', patient.id, today],
    queryFn: () => getClinicAppointments(clinicId, { patient_id: patient.id, from: today, to: today, per_page: 20 }),
  });

  return (
    <>
      <div className="frontdesk-selected">
        <InitialsTile name={patient.name} size="sm" tone="navy" />
        <div>
          <p className="frontdesk-row-title">{patient.name}</p>
          {patient.phone && <p className="frontdesk-row-sub">{patient.phone}</p>}
        </div>
      </div>
      <p className="frontdesk-row-title">Select appointment for today:</p>
      <div className="clinic-form-gap">
        <QueryState query={query} loadingLabel="Loading appointments…">
          {({ appointments }) =>
            appointments.length === 0 ? (
              <p className="clinic-admin-card-sub">No appointment today for this patient.</p>
            ) : (
              <ul className="frontdesk-list">
                {appointments.map((appointment) => {
                  const status = statusOf(appointment.backendStatus);
                  // The server only checks in confirmed appointments.
                  const canCheckIn = appointment.backendStatus === 'confirmed';
                  return (
                    <li key={appointment.id}>
                      <button type="button" className="frontdesk-pick" disabled={!canCheckIn} onClick={() => onPick(appointment)}>
                        <Icon name="calendarBlank" size={20} />
                        <span className="frontdesk-row-body">
                          <span className="frontdesk-row-title">{appointment.service}</span>
                          <br />
                          <span className="frontdesk-row-sub">
                            {appointment.time} · {appointment.dentist}
                          </span>
                        </span>
                        <Pill tone={status.tone}>{status.label}</Pill>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          }
        </QueryState>
      </div>
      <p className="clinic-form-gap">
        <button type="button" className="clinic-link-button" onClick={onBack}>
          <Icon name="arrowLeft" size={14} />
          Search again
        </button>
      </p>
    </>
  );
}

function ConfirmStep({ clinicId, patient, appointmentId, onDone, onBack }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['clinic', clinicId, 'appointment', appointmentId], queryFn: () => getClinicAppointment(clinicId, appointmentId) });
  const checkIn = useMutation({
    mutationFn: () => appointmentAction(clinicId, appointmentId, 'check-in'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
      onDone(query.data);
    },
  });

  return (
    <QueryState query={query} loadingLabel="Loading details…">
      {(a) => (
        <>
          <p className="frontdesk-row-title">Confirm patient and appointment details:</p>
          <dl className="frontdesk-confirm-table">
            <dt>Patient</dt>
            <dd>{a.patient?.name}</dd>
            <dt>Age/Sex</dt>
            <dd>{describePatient({ birth_date: patient.birth_date, gender: patient.gender }) || '—'}</dd>
            <dt>Service</dt>
            <dd>{a.service}</dd>
            <dt>Dentist</dt>
            <dd>{a.dentist}</dd>
            <dt>Time</dt>
            <dd>{formatTime(a.startsAt)}</dd>
            <dt>Date</dt>
            <dd>{formatDate(a.startsAt)}</dd>
          </dl>
          {a.medicalFlags.length > 0 && (
            <div className="frontdesk-alert" role="note">
              <Icon name="alertTriangle" size={18} />
              <span>{a.medicalFlags.join('. ')}</span>
            </div>
          )}
          <FormError error={checkIn.error} />
          <div className="frontdesk-wizard-actions">
            <button type="button" className="btn btn-primary" disabled={checkIn.isPending} onClick={() => checkIn.mutate()}>
              <Icon name="userCheck" size={18} />
              {checkIn.isPending ? 'Checking in…' : 'Check In Patient'}
            </button>
            <button type="button" className="btn btn-outline" disabled={checkIn.isPending} onClick={onBack}>
              Back
            </button>
          </div>
        </>
      )}
    </QueryState>
  );
}

function Success({ appointment, queueNumber, onAnother }) {
  return (
    <div className="clinic-success" role="status">
      <span className="clinic-success-icon is-navy">
        <Icon name="checkCircle" size={36} />
      </span>
      <h2 className="clinic-success-title">Check-in Successful!</h2>
      <p className="clinic-success-text">
        {appointment.patient?.name} has been checked in.
        <br />
        {[queueNumber ? `Queue #${queueNumber}` : null, appointment.service, appointment.dentist].filter(Boolean).join(' · ')}
      </p>
      <button type="button" className="btn btn-primary" onClick={onAnother}>
        Check In Another Patient
      </button>
    </div>
  );
}

function WaitingQueue({ query }) {
  return (
    <Card title="Waiting Queue">
      <QueryState query={query} loadingLabel="Loading queue…">
        {(queue) =>
          queue.length === 0 ? (
            <p className="clinic-admin-card-sub">Nobody is waiting.</p>
          ) : (
            <ol className="frontdesk-list">
              {queue.map((entry) => {
                const serving = entry.status === 'in_progress';
                return (
                  <li key={entry.id} className={`frontdesk-queue-card${serving ? ' is-serving' : ''}`}>
                    <div className="frontdesk-patient-head">
                      <span className={`frontdesk-number${serving ? ' is-solid' : ''}`}>#{entry.queue_number}</span>
                      <div className="frontdesk-row-body">
                        <p className="frontdesk-row-title">{entry.patient}</p>
                        <p className="frontdesk-row-sub">{entry.service}</p>
                      </div>
                      {serving && <Pill tone="info">Serving</Pill>}
                    </div>
                    <p className="frontdesk-queue-foot">
                      <span>Since {formatTime(entry.checked_in_at)}</span>
                      <span>{entry.dentist}</span>
                    </p>
                  </li>
                );
              })}
            </ol>
          )
        }
      </QueryState>
    </Card>
  );
}

/** Four steps to check a patient in, beside who is already waiting. */
function ClinicCheckInPage() {
  const { clinicId, can } = useClinicAccess();
  const [step, setStep] = useState(0);
  const [patient, setPatient] = useState(null);
  const [appointmentId, setAppointmentId] = useState(null);
  const [done, setDone] = useState(null);
  const queue = useQuery({
    queryKey: ['clinic', clinicId, 'queue'],
    queryFn: () => getCheckInQueue(clinicId),
    enabled: can('appointments.view_all'),
    refetchInterval: 60 * 1000,
  });

  const restart = () => {
    setStep(0);
    setPatient(null);
    setAppointmentId(null);
    setDone(null);
  };
  const queueNumber = done ? queue.data?.find((entry) => String(entry.id) === String(done.id))?.queue_number : null;

  return (
    <ClinicLayout section="check-in" title="Patient Check-in & Queue" subtitle={null} requires={['appointments.manage']} hideSearch>
      <div className="frontdesk-grid is-flush">
        <Card title="Check In a Patient">
          <Steps current={step} />
          {step === 0 && (
            <SearchStep
              clinicId={clinicId}
              onPick={(picked) => {
                setPatient(picked);
                setStep(1);
              }}
            />
          )}
          {step === 1 && (
            <SelectStep
              clinicId={clinicId}
              patient={patient}
              onBack={restart}
              onPick={(appointment) => {
                setAppointmentId(appointment.id);
                setStep(2);
              }}
            />
          )}
          {step === 2 && (
            <ConfirmStep
              clinicId={clinicId}
              patient={patient}
              appointmentId={appointmentId}
              onBack={() => setStep(1)}
              onDone={(appointment) => {
                setDone(appointment);
                setStep(3);
              }}
            />
          )}
          {step === 3 && done && <Success appointment={done} queueNumber={queueNumber} onAnother={restart} />}
        </Card>
        <WaitingQueue query={queue} />
      </div>
    </ClinicLayout>
  );
}

export default ClinicCheckInPage;
