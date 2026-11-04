import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import ClinicLayout from '../../../layouts/ClinicLayout';
import Icon from '../../../components/Icon';
import { BackLink, Card } from '../../../components/clinic/ClinicAdminUi';
import { AppointmentDecision, InitialsTile, Pill } from '../../../components/clinic/ClinicUi';
import { ConfirmDialog, Field, FormError } from '../../../components/portal/PortalUi';
import { QueryState } from '../../../components/StatusMessage';
import { getClinicHref } from '../../../config/clinicNavigation';
import { toAppointment } from '../../../services/adapters';
import { appointmentAction } from '../../../services/clinicPortalApi';
import { getDentistAppointment, saveTreatmentNotes } from '../../../services/dentistApi';
import { businessTodayKey, formatDate, formatTime, toBusinessDateKey } from '../../../utils/dateTime';
import { statusOf } from '../frontDesk';
import { formatDay } from './dentistUi';
import '../../../components/clinic/ClinicAdminUi.css';
import './Dentist.css';

function InfoTile({ icon, label, value }) {
  return (
    <div className="dentist-info">
      <Icon name={icon} size={18} />
      <div>
        <p className="dentist-info-label">{label}</p>
        <p className="dentist-info-value">{value || '—'}</p>
      </div>
    </div>
  );
}

function TreatmentNotes({ clinicId, appointment, patientHref, prescribeHref }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(appointment.treatmentNotes);
  const save = useMutation({
    mutationFn: () => saveTreatmentNotes(clinicId, appointment.id, notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'appointments'] }),
  });
  useEffect(() => setNotes(appointment.treatmentNotes), [appointment.treatmentNotes]);

  return (
    <Card title="Treatment Notes">
      <Field label="Notes on this visit" as="textarea" rows={5} maxLength={5000} value={notes} onChange={(event) => setNotes(event.target.value)} />
      <FormError error={save.error} />
      {save.isSuccess && !save.isPending && (
        <p className="clinic-saved-note is-navy" role="status">
          <Icon name="checkCircle" size={16} />
          Notes saved
        </p>
      )}
      <div className="dentist-actions-row">
        <button type="button" className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
          <Icon name="clipboardList" size={18} />
          {save.isPending ? 'Saving…' : 'Save Notes'}
        </button>
        {patientHref && (
          <a href={patientHref} className="btn btn-outline">
            <Icon name="user" size={18} />
            Patient Record
          </a>
        )}
        {prescribeHref && (
          <a href={prescribeHref} className="btn btn-outline">
            <Icon name="bookOpen" size={18} />
            Prescribe
          </a>
        )}
      </div>
    </Card>
  );
}

function Details({ clinicId, api, onAction, onDecision }) {
  const appointment = toAppointment(api);
  const { patient } = appointment;
  const status = statusOf(appointment.backendStatus);
  const snapshot = api.patient_snapshot;
  const patientId = patient?.id;
  const profileHref = patientId ? `${getClinicHref(clinicId, 'patients')}/${patientId}` : null;
  const isToday = appointment.startsAt && toBusinessDateKey(appointment.startsAt) === businessTodayKey();
  const canStart = isToday && ['confirmed', 'checked_in'].includes(appointment.backendStatus);
  const isOngoing = appointment.backendStatus === 'in_progress';

  return (
    <div className="dentist-split">
      <div className="dentist-stack">
        <Card
          title={appointment.service}
          subtitle={`Appointment #${appointment.id}`}
          actions={
            <span className="dentist-actions-row" style={{ marginTop: 0 }}>
              <Pill tone={status.tone}>{status.label}</Pill>
              <Pill tone="warning">{appointment.type === 'walk_in' ? 'Walk-in' : 'Scheduled'}</Pill>
            </span>
          }
        >
          <div className="dentist-info-grid">
            <InfoTile icon="user" label="Patient" value={patient?.name} />
            <InfoTile icon="calendarBlank" label="Date" value={formatDate(appointment.startsAt)} />
            <InfoTile icon="clock" label="Time" value={formatTime(appointment.startsAt)} />
            <InfoTile icon="phone" label="Phone" value={patient?.phone} />
            <InfoTile icon="activity" label="Age" value={patient?.age != null ? `${patient.age} years old` : null} />
            <InfoTile icon="heart" label="Blood Type" value={snapshot?.blood_type} />
          </div>
        </Card>

        {(snapshot?.conditions || snapshot?.allergies) && (
          <div className="dentist-alert" role="note">
            <Icon name="alertTriangle" size={22} />
            <div>
              <strong>Medical Alerts</strong>
              {snapshot.conditions && <p>Conditions: {snapshot.conditions}</p>}
              {snapshot.allergies && <p>Allergies: {snapshot.allergies}</p>}
            </div>
          </div>
        )}

        <TreatmentNotes clinicId={clinicId} appointment={appointment} patientHref={profileHref} prescribeHref={patientId ? `${getClinicHref(clinicId, 'prescriptions')}/new?patient=${patientId}` : null} />
      </div>

      <div className="dentist-stack">
        <Card title="Actions">
          <div className="dentist-actions-stack">
            {appointment.backendStatus === 'pending' && (
              <>
                <button type="button" className="btn btn-primary" onClick={() => onDecision({ appointment, action: 'confirm' })}>
                  <Icon name="checkCircle" size={18} />
                  Confirm
                </button>
                <button type="button" className="btn btn-outline" onClick={() => onDecision({ appointment, action: 'reject' })}>
                  Decline
                </button>
              </>
            )}
            {canStart && (
              <button type="button" className="btn btn-primary" onClick={() => onAction('start')}>
                <Icon name="activity" size={18} />
                Start Visit
              </button>
            )}
            {isOngoing && (
              <button type="button" className="btn btn-primary" onClick={() => onAction('complete')}>
                <Icon name="checkCircle" size={18} />
                Mark as Completed
              </button>
            )}
            {profileHref && (
              <a href={profileHref} className="btn btn-outline">
                <Icon name="user" size={18} />
                Patient Profile
              </a>
            )}
            {patientId && (
              <a href={`${getClinicHref(clinicId, 'dental-chart')}?patient=${patientId}`} className="btn btn-outline">
                <Icon name="activity" size={18} />
                Dental Chart
              </a>
            )}
            {patientId && (
              <a href={`${getClinicHref(clinicId, 'imaging')}?patient=${patientId}`} className="btn btn-outline">
                <Icon name="camera" size={18} />
                Imaging
              </a>
            )}
          </div>
        </Card>

        {snapshot && (
          <Card title="Patient Snapshot">
            <div className="dentist-side-row" style={{ marginBottom: 'var(--space-3)' }}>
              <InitialsTile name={patient?.name} size="sm" tone="navy" />
              <div>
                <p className="dentist-row-title">{patient?.name}</p>
                <p className="dentist-row-sub">{[patient?.age, patient?.gender, snapshot.blood_type].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
            <p className="dentist-snapshot-line">
              <strong>Visits:</strong> {snapshot.visits}
            </p>
            <p className="dentist-snapshot-line">
              <strong>Last visit:</strong> {api.patient_last_visit_at ? formatDay(toBusinessDateKey(api.patient_last_visit_at)) : 'None yet'}
            </p>
            <p className={`dentist-snapshot-line${snapshot.allergies ? ' is-danger' : ''}`}>
              <strong>Allergies:</strong> {snapshot.allergies || 'None on record'}
            </p>
            <p className={`dentist-snapshot-line${snapshot.conditions ? ' is-warning' : ''}`}>
              <strong>Conditions:</strong> {snapshot.conditions || 'None on record'}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

/** Appointment Details: the visit, what could go wrong, and the note on it. */
function DentistAppointmentDetail() {
  const { clinicId, appointmentId } = useParams();
  const queryClient = useQueryClient();
  const [decision, setDecision] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const query = useQuery({ queryKey: ['clinic', clinicId, 'appointments', 'detail', appointmentId], queryFn: () => getDentistAppointment(clinicId, appointmentId) });
  const run = useMutation({
    mutationFn: (action) => appointmentAction(clinicId, appointmentId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
      setPendingAction(null);
    },
  });
  const isOngoing = query.data?.status === 'in_progress';

  return (
    <ClinicLayout
      section="appointments"
      title="Appointment Details"
      subtitle={null}
      hideSearch
      headerActions={
        isOngoing && (
          <button type="button" className="btn btn-primary clinic-header-button" onClick={() => setPendingAction('complete')}>
            <Icon name="checkCircle" size={18} />
            Complete
          </button>
        )
      }
    >
      <div className="dentist-page-back">
        <BackLink href={getClinicHref(clinicId, 'appointments')}>Back to Appointments</BackLink>
      </div>
      <QueryState query={query} loadingLabel="Loading appointment…">
        {(api) => <Details clinicId={clinicId} api={api} onAction={setPendingAction} onDecision={setDecision} />}
      </QueryState>
      {decision && <AppointmentDecision clinicId={clinicId} decision={decision} onClose={() => setDecision(null)} />}
      {pendingAction && (
        <ConfirmDialog
          title={pendingAction === 'start' ? 'Start this visit?' : 'Mark as completed?'}
          message={pendingAction === 'start' ? 'The patient will be checked in and the visit marked as ongoing.' : 'The patient will be able to leave a review of this visit.'}
          confirmLabel={pendingAction === 'start' ? 'Start Visit' : 'Mark as Completed'}
          isBusy={run.isPending}
          error={run.error}
          onConfirm={() => run.mutate(pendingAction)}
          onCancel={() => setPendingAction(null)}
        />
      )}
    </ClinicLayout>
  );
}

export default DentistAppointmentDetail;
