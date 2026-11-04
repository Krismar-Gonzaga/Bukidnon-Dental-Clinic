import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import ClinicLayout, { useClinicAccess } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { BackLink, Card } from '../../components/clinic/ClinicAdminUi';
import { Pill } from '../../components/clinic/ClinicUi';
import { Badge, ConfirmDialog, Field, FormError, Modal } from '../../components/portal/PortalUi';
import SlotPickerModal from '../../components/portal/SlotPickerModal';
import { QueryState } from '../../components/StatusMessage';
import { getClinicHref, getClinicStatusLabel, isDentistMember, isFrontDeskMember } from '../../config/clinicNavigation';
import { appointmentAction, getClinicAppointment, getClinicDentists, reassignAppointment } from '../../services/clinicPortalApi';
import { businessTodayKey, formatDate, formatDateTime, formatTime, toBusinessDateKey } from '../../utils/dateTime';
import FrontDeskDetails from './FrontDeskDetails';
import '../../components/clinic/ClinicAdminUi.css';

const STATUS_TONES = { pending: 'warning', reschedule_requested: 'warning', confirmed: 'info', checked_in: 'info', in_progress: 'info', completed: 'success', cancelled: 'danger', rejected: 'danger', no_show: 'danger' };

const MANAGE = ['appointments.manage'];
const PROGRESS = ['appointments.manage', 'appointments.progress'];
const RESCHEDULE = { action: 'reschedule', label: 'Reschedule', needs: MANAGE, slot: true, icon: 'refresh' };
const REASSIGN = { action: 'reassign', label: 'Reassign Dentist', short: 'Reassign', needs: MANAGE, reassign: true, icon: 'userCheck' };

/**
 * Next steps by backend status. `needs` is the permission(s) required; the
 * server enforces the same state machine and permissions.
 */
const ACTIONS = {
  pending: [
    { action: 'confirm', label: 'Confirm Appointment', short: 'Confirm', needs: MANAGE, tone: 'is-success', icon: 'check' },
    { action: 'reject', label: 'Cancel Request', short: 'Cancel', needs: MANAGE, reason: true, tone: 'is-danger', icon: 'close' },
    RESCHEDULE,
    REASSIGN,
  ],
  confirmed: [
    { action: 'check-in', label: 'Check In', needs: MANAGE, tone: 'is-success', icon: 'check' },
    RESCHEDULE,
    REASSIGN,
    { action: 'no-show', label: 'Mark No-Show', needs: PROGRESS, icon: 'alertCircle' },
    { action: 'cancel', label: 'Cancel Appointment', short: 'Cancel', needs: MANAGE, reason: true, tone: 'is-danger', icon: 'close' },
  ],
  reschedule_requested: [
    { action: 'approve-reschedule', label: 'Approve Requested Time', short: 'Approve', needs: MANAGE, tone: 'is-success', icon: 'check' },
    { action: 'confirm', label: 'Keep Original Time', short: 'Keep time', needs: MANAGE, icon: 'clock' },
    REASSIGN,
    { action: 'cancel', label: 'Cancel Appointment', short: 'Cancel', needs: MANAGE, reason: true, tone: 'is-danger', icon: 'close' },
  ],
  checked_in: [
    { action: 'start', label: 'Start Visit', needs: PROGRESS, tone: 'is-success', icon: 'check' },
    { action: 'no-show', label: 'Mark No-Show', needs: PROGRESS, icon: 'alertCircle' },
  ],
  in_progress: [{ action: 'complete', label: 'Complete Visit', needs: PROGRESS, tone: 'is-success', icon: 'check' }],
};

// What each one-click step asks before it runs (the patient is notified of most).
const CONFIRMATIONS = {
  confirm: (name) => `Confirm this appointment? ${name} will be notified.`,
  'approve-reschedule': (name) => `Move the appointment to the requested time? ${name} will be notified.`,
  'check-in': (name) => `Check in ${name} for this visit?`,
  start: (name) => `Start the visit with ${name}?`,
  complete: () => 'Mark this visit as completed? This cannot be undone.',
  'no-show': (name) => `Mark ${name} as a no-show? This cannot be undone.`,
};

// Front desk: the line shown after a step works.
const DONE_MESSAGES = {
  confirm: 'Appointment confirmed.',
  'approve-reschedule': 'Appointment moved to the requested time.',
  'check-in': 'Patient checked in.',
  start: 'Visit started.',
  complete: 'Visit completed.',
  'no-show': 'Status updated to no-show.',
  cancel: 'Appointment cancelled.',
  reject: 'Request cancelled.',
  reschedule: 'Appointment rescheduled.',
};

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

function ClinicAppointmentDetailPage() {
  const { appointmentId } = useParams();
  const { clinicId, membership, can } = useClinicAccess();
  const queryClient = useQueryClient();
  const queryKey = ['clinic', clinicId, 'appointment', appointmentId];
  const query = useQuery({ queryKey, queryFn: () => getClinicAppointment(clinicId, appointmentId) });
  const [pending, setPending] = useState(null); // the action being asked about
  const [reason, setReason] = useState('');
  const [dentistId, setDentistId] = useState('');
  const [doneMessage, setDoneMessage] = useState('');
  const dentists = useQuery({
    queryKey: ['clinic', clinicId, 'dentists'],
    queryFn: () => getClinicDentists(clinicId),
    enabled: Boolean(pending?.reassign),
  });
  const isDentist = isDentistMember(membership);
  const isFrontDesk = isFrontDeskMember(membership);
  const backHref = getClinicHref(clinicId, isDentist ? 'schedule' : 'appointments');
  const a = query.data;
  // The front desk design has no reassign: that stays with the clinic admin.
  // A patient cannot arrive for another day's visit, so the desk checks in on the day only.
  const notThisDay = (item) => item.action === 'check-in' && toBusinessDateKey(a.startsAt) !== businessTodayKey();
  const actions = a ? (ACTIONS[a.backendStatus] ?? []).filter((item) => can(...item.needs) && !(isFrontDesk && (item.reassign || notThisDay(item)))) : [];

  const settled = () => {
    setPending(null);
    setReason('');
    setDentistId('');
    queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
  };
  const run = useMutation({
    mutationFn: ({ action, body }) => appointmentAction(clinicId, appointmentId, action, body),
    onSuccess: (_, { action }) => {
      settled();
      setDoneMessage(DONE_MESSAGES[action] ?? '');
    },
  });
  const reassign = useMutation({
    mutationFn: () => reassignAppointment(clinicId, appointmentId, Number(dentistId)),
    onSuccess: settled,
  });

  const start = (item) => {
    setDoneMessage('');
    run.reset();
    reassign.reset();
    setPending(item);
  };

  const button = (item, short) => (
    <button key={item.action} type="button" className={`clinic-action-button ${item.tone ?? ''}`} disabled={run.isPending} onClick={() => start(item)}>
      <Icon name={item.icon} size={16} />
      {short ? item.short ?? item.label : item.label}
    </button>
  );

  return (
    <ClinicLayout
      section="appointments"
      title="Appointment Details"
      subtitle={isFrontDesk ? null : undefined}
      requires={['appointments.view_all', 'appointments.view_assigned']}
      hideSearch
      headerActions={!isFrontDesk && actions.length > 0 && <div className="clinic-header-actions clinic-header-only">{actions.slice(0, 4).map((item) => button(item, true))}</div>}
    >
      <BackLink href={backHref}>{isDentist ? 'Back to Schedule' : 'Back to Appointments'}</BackLink>
      {doneMessage && (
        <p className={`clinic-saved-note${isFrontDesk ? ' is-navy' : ''}`} role="status">
          <Icon name="checkCircle" size={16} />
          {doneMessage}
        </p>
      )}
      <QueryState query={query} loadingLabel="Loading appointment…">
        {(data) => isFrontDesk ? (
          <FrontDeskDetails appointment={data} clinicId={clinicId} can={can} actions={actions} actionButton={button} actionError={pending ? null : run.error} />
        ) : (
          <div className="clinic-split is-reverse">
            <div>
              <Card
                title={data.service}
                subtitle={`Appointment #${data.reference}`}
                actions={
                  <div className="clinic-header-actions">
                    <Pill tone={STATUS_TONES[data.backendStatus] ?? 'neutral'}>{getClinicStatusLabel(data.backendStatus)}</Pill>
                    {data.type && <Pill tone={data.type === 'walk_in' ? 'purple' : 'warning'}>{data.type === 'walk_in' ? 'Walk-in' : 'Online'}</Pill>}
                  </div>
                }
              >
                <dl className="clinic-detail-tiles">
                  <Tile icon="user" label="Patient" value={data.patient?.name} />
                  <Tile icon="stethoscope" label="Dentist" value={data.dentist} />
                  <Tile icon="calendarBlank" label="Date" value={data.startsAt ? formatDate(data.startsAt) : data.date} />
                  <Tile icon="clock" label="Time" value={data.startsAt ? formatTime(data.startsAt) : data.time} />
                  <Tile icon="phone" label="Phone" value={data.patient?.phone} />
                  <Tile icon="user" label="Patient age" value={data.patient?.age != null ? `${data.patient.age} years old` : null} />
                  {data.patient?.email && <Tile icon="mail" label="Email" value={data.patient.email} />}
                  {data.branch && <Tile icon="mapPin" label="Branch" value={`${data.branch} — ${data.branchAddress}`} />}
                  {data.requestedDateTime && <Tile icon="refresh" label="Requested new time" value={data.requestedDateTime} />}
                </dl>
                {data.notes && (
                  <p className="clinic-note-box">
                    <strong>Clinical notes</strong>
                    {data.notes}
                  </p>
                )}
                {data.cancellationReason && (
                  <p className="clinic-note-box">
                    <strong>Reason given</strong>
                    {data.cancellationReason}
                  </p>
                )}
                {data.patient?.id && can('patients.view') && (
                  <p className="clinic-form-gap">
                    <a href={`${getClinicHref(clinicId, 'patients')}/${data.patient.id}`}>Open patient profile</a>
                  </p>
                )}
              </Card>

              <Card title="History">
                <ol className="portal-list">
                  {data.history.map((entry, index) => (
                    <li key={`${entry.at}-${index}`} className="portal-list-item">
                      <Badge status={entry.to}>{getClinicStatusLabel(entry.to)}</Badge> <span className="portal-table-muted">{formatDateTime(entry.at)}</span>
                      {entry.reason && <p className="portal-list-item-meta">{entry.reason}</p>}
                    </li>
                  ))}
                </ol>
              </Card>
            </div>

            <div>
              {actions.length > 0 && (
                <Card title="Quick Actions">
                  <div className="clinic-quick-actions">{actions.map((item) => button(item, false))}</div>
                  {!pending && <FormError error={run.error} />}
                </Card>
              )}
              {can('records.view') && (
                <Card title="Patient Medical Flags">
                  {data.medicalFlags.length > 0 ? (
                    data.medicalFlags.map((flag) => (
                      <p key={flag} className="clinic-note-box">
                        {flag}
                      </p>
                    ))
                  ) : (
                    <p className="clinic-admin-card-sub">No medical flags recorded.</p>
                  )}
                </Card>
              )}
            </div>
          </div>
        )}
      </QueryState>

      {pending?.reason && (
        <Modal title={pending.label} onClose={() => setPending(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              run.mutate({ action: pending.action, body: { reason: reason.trim() } });
            }}
          >
            {isFrontDesk && <p className="portal-confirm-message">Are you sure you want to cancel this appointment? This action cannot be undone.</p>}
            <Field label="Reason (shared with the patient)" as="textarea" required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
            <FormError error={run.error} />
            <div className="portal-form-actions">
              <button type="button" className="btn btn-outline" onClick={() => setPending(null)}>
                {isFrontDesk ? 'Keep Appointment' : 'Back'}
              </button>
              <button type="submit" className={`btn ${isFrontDesk ? 'btn-danger' : 'btn-primary'}`} disabled={!reason.trim() || run.isPending}>
                {run.isPending ? 'Saving…' : isFrontDesk ? 'Yes, Cancel' : pending.label}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {pending?.reassign && (
        <Modal title="Reassign Dentist" onClose={() => setPending(null)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              reassign.mutate();
            }}
          >
            <p className="portal-confirm-message">Assign a different dentist to this appointment. The time stays the same, so they must be free then.</p>
            <Field
              label="Select dentist"
              as="select"
              required
              options={[
                { value: '', label: dentists.isPending ? 'Loading…' : 'Choose…' },
                ...(dentists.data ?? []).filter((d) => d.is_active && String(d.id) !== String(a?.dentistId)).map((d) => ({ value: String(d.id), label: d.name })),
              ]}
              value={dentistId}
              onChange={(event) => setDentistId(event.target.value)}
            />
            <FormError error={reassign.error} />
            <div className="portal-form-actions">
              <button type="button" className="btn btn-outline" onClick={() => setPending(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={!dentistId || reassign.isPending}>
                {reassign.isPending ? 'Saving…' : 'Reassign'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {pending && !pending.reason && !pending.slot && !pending.reassign && (
        <ConfirmDialog
          title={pending.label}
          message={(CONFIRMATIONS[pending.action] ?? (() => 'Continue?'))(a?.patient?.name ?? 'The patient')}
          confirmLabel={pending.label}
          danger={pending.action === 'no-show'}
          isBusy={run.isPending}
          error={run.error}
          onConfirm={() => run.mutate({ action: pending.action })}
          onCancel={() => setPending(null)}
        />
      )}

      {pending?.slot && (
        <SlotPickerModal
          title="Reschedule Appointment"
          clinicId={clinicId}
          dentistId={a?.dentistId}
          serviceRateId={a?.serviceRateId}
          askReason
          confirmLabel="Confirm Reschedule"
          isSaving={run.isPending}
          error={run.error}
          onClose={() => setPending(null)}
          onConfirm={(slot, slotReason) => run.mutate({ action: 'reschedule', body: { starts_at: slot.startsAt, reason: slotReason || undefined } })}
        />
      )}
    </ClinicLayout>
  );
}

export default ClinicAppointmentDetailPage;
