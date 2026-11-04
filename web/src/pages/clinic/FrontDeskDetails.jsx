import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Icon from '../../components/Icon';
import { Card } from '../../components/clinic/ClinicAdminUi';
import { InitialsTile, Pill } from '../../components/clinic/ClinicUi';
import { FormError } from '../../components/portal/PortalUi';
import { getClinicHref } from '../../config/clinicNavigation';
import { saveFrontDeskNotes } from '../../services/clinicPortalApi';
import { formatDate, formatTime } from '../../utils/dateTime';
import { statusOf } from './frontDesk';
import '../../components/clinic/ClinicAdminUi.css';
import './FrontDesk.css';

const GENDER_LABELS = { male: 'Male', female: 'Female', other: 'Other' };

function Tile({ icon, label, value }) {
  return (
    <div className="clinic-detail-tile">
      <Icon name={icon} size={18} />
      <div>
        <dt>{label}</dt>
        <dd>{value || '—'}</dd>
      </div>
    </div>
  );
}

function NotesCard({ clinicId, appointment, canEdit }) {
  const queryClient = useQueryClient();
  const [notes, setNotes] = useState(appointment.frontDeskNotes);
  const save = useMutation({
    mutationFn: () => saveFrontDeskNotes(clinicId, appointment.id, notes.trim() || null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'appointment', appointment.id] }),
  });

  return (
    <Card title="Front-desk Notes">
      <form
        className="frontdesk-notes"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <label className="visually-hidden" htmlFor="front-desk-notes">
          Front-desk notes
        </label>
        <textarea
          id="front-desk-notes"
          placeholder="Add scheduling notes (not clinical notes)..."
          maxLength={2000}
          readOnly={!canEdit}
          value={notes}
          onChange={(event) => {
            save.reset();
            setNotes(event.target.value);
          }}
        />
        <FormError error={save.error} />
        {save.isSuccess && (
          <p className="clinic-saved-note is-navy clinic-form-gap" role="status">
            <Icon name="checkCircle" size={16} />
            Notes saved.
          </p>
        )}
        {canEdit && (
          <button type="submit" className="btn btn-primary clinic-form-gap" disabled={save.isPending}>
            <Icon name="clipboardList" size={18} />
            {save.isPending ? 'Saving…' : 'Save Notes'}
          </button>
        )}
      </form>
    </Card>
  );
}

/** Appointment details as the front desk sees them: `actionButton` runs the page's confirmations. */
function FrontDeskDetails({ appointment: a, clinicId, can, actions, actionButton, actionError }) {
  const status = statusOf(a.backendStatus);
  const patient = a.patient;
  const summary = [patient?.age != null ? patient.age : null, GENDER_LABELS[patient?.gender]].filter((part) => part != null).join(' · ');

  return (
    <div className="clinic-split is-reverse">
      <div>
        <Card title={a.service} subtitle={`Appointment #${a.reference} · ${a.dentist}`} actions={<Pill tone={status.tone}>{status.label}</Pill>}>
          <dl className="clinic-detail-tiles">
            <Tile icon="user" label="Patient" value={patient?.name} />
            <Tile icon="calendarBlank" label="Date" value={formatDate(a.startsAt)} />
            <Tile icon="clock" label="Time" value={formatTime(a.startsAt)} />
            <Tile icon="stethoscope" label="Dentist" value={a.dentist} />
          </dl>
          {a.notes && (
            <p className="clinic-note-box">
              <strong>Booking notes</strong>
              {a.notes}
            </p>
          )}
          {a.cancellationReason && (
            <p className="clinic-note-box">
              <strong>Reason given</strong>
              {a.cancellationReason}
            </p>
          )}
          {a.requestedDateTime && (
            <p className="clinic-note-box">
              <strong>Requested new time</strong>
              {a.requestedDateTime}
            </p>
          )}
        </Card>
        {a.medicalFlags.length > 0 && (
          <div className="frontdesk-alert" role="note">
            <Icon name="alertTriangle" size={20} />
            <div>
              <strong>Medical Notes</strong>
              {a.medicalFlags.map((flag) => (
                <div key={flag}>{flag}</div>
              ))}
            </div>
          </div>
        )}
        <div className="clinic-form-gap">
          <NotesCard key={a.frontDeskNotes} clinicId={clinicId} appointment={a} canEdit={can('appointments.manage')} />
        </div>
      </div>

      <div>
        <Card title="Actions">
          <div className="clinic-quick-actions frontdesk-actions">
            {actions.map((item) => actionButton(item, false))}
            {patient?.id && can('patients.view') && (
              <a href={`${getClinicHref(clinicId, 'patients')}/${patient.id}`} className="clinic-action-button">
                <Icon name="user" size={16} />
                Patient Profile
              </a>
            )}
          </div>
          <FormError error={actionError} />
        </Card>
        <Card title="Patient Info">
          <div className="frontdesk-patient-head">
            <InitialsTile name={patient?.name} size="sm" tone="navy" />
            <div>
              <p className="frontdesk-row-title">{patient?.name}</p>
              {summary && <p className="frontdesk-row-sub">{summary}</p>}
            </div>
          </div>
          <p className="clinic-file-meta">
            <strong>Phone:</strong> {patient?.phone || '—'}
          </p>
          <p className="clinic-file-meta">
            <strong>Last visit:</strong> {a.patientLastVisitAt ? formatDate(a.patientLastVisitAt) : 'No visits yet'}
          </p>
        </Card>
      </div>
    </div>
  );
}

export default FrontDeskDetails;
