import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import ClinicLayout, { useClinic } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { Badge, ConfirmDialog, Field, FormError, Modal, Section } from '../../components/portal/PortalUi';
import SlotPickerModal from '../../components/portal/SlotPickerModal';
import { QueryState } from '../../components/StatusMessage';
import { getClinicHref, getClinicStatusLabel, isDentistMember } from '../../config/clinicNavigation';
import { appointmentAction, getClinicAppointment } from '../../services/clinicPortalApi';
import { formatDateTime } from '../../utils/dateTime';

/**
 * Next steps by backend status. `needs` is the permission(s) required; the
 * server enforces the same state machine and permissions.
 */
const ACTIONS = {
  pending: [
    { action: 'confirm', label: 'Confirm', needs: ['appointments.manage'], primary: true },
    { action: 'reschedule', label: 'Propose another time', needs: ['appointments.manage'], slot: true },
    { action: 'reject', label: 'Decline', needs: ['appointments.manage'], reason: true, danger: true },
  ],
  confirmed: [
    { action: 'check-in', label: 'Check in', needs: ['appointments.manage'], primary: true },
    { action: 'reschedule', label: 'Reschedule', needs: ['appointments.manage'], slot: true },
    { action: 'no-show', label: 'Mark no-show', needs: ['appointments.manage', 'appointments.progress'] },
    { action: 'cancel', label: 'Cancel', needs: ['appointments.manage'], reason: true, danger: true },
  ],
  reschedule_requested: [
    { action: 'approve-reschedule', label: 'Approve requested time', needs: ['appointments.manage'], primary: true },
    { action: 'confirm', label: 'Keep original time', needs: ['appointments.manage'] },
    { action: 'cancel', label: 'Cancel', needs: ['appointments.manage'], reason: true, danger: true },
  ],
  checked_in: [
    { action: 'start', label: 'Start visit', needs: ['appointments.manage', 'appointments.progress'], primary: true },
    { action: 'no-show', label: 'Mark no-show', needs: ['appointments.manage', 'appointments.progress'] },
  ],
  in_progress: [
    { action: 'complete', label: 'Complete visit', needs: ['appointments.manage', 'appointments.progress'], primary: true },
  ],
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

function AppointmentDetail({ appointmentId }) {
  const { clinicId, membership, can } = useClinic();
  const backHref = getClinicHref(clinicId, isDentistMember(membership) ? 'schedule' : 'appointments');
  const queryClient = useQueryClient();
  const queryKey = ['clinic', clinicId, 'appointment', appointmentId];
  const query = useQuery({ queryKey, queryFn: () => getClinicAppointment(clinicId, appointmentId) });
  const [pending, setPending] = useState(null); // action needing a reason, a slot or a confirmation
  const [reason, setReason] = useState('');

  const run = useMutation({
    mutationFn: ({ action, body }) => appointmentAction(clinicId, appointmentId, action, body),
    onSuccess: () => {
      setPending(null);
      setReason('');
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
    },
  });

  const start = (item) => {
    run.reset();
    setPending(item);
  };

  return (
    <QueryState query={query} loadingLabel="Loading appointment…">
      {(a) => {
        const actions = (ACTIONS[a.backendStatus] ?? []).filter((item) => can(...item.needs));
        return (
          <div className="portal-stack">
            <a href={backHref} className="patient-back-link">
              <Icon name="chevronLeft" size={16} />
              {isDentistMember(membership) ? 'Back to schedule' : 'Back to appointments'}
            </a>

            <Section
              title={`${a.service} · #${a.reference}`}
              subtitle={a.dateTime}
              actions={<Badge status={a.backendStatus}>{getClinicStatusLabel(a.backendStatus)}</Badge>}
            >
              <dl className="portal-details">
                <dt>Patient</dt>
                <dd>{a.patient?.name}</dd>
                <dt>Contact</dt>
                <dd>{[a.patient?.phone, a.patient?.email].filter(Boolean).join(' · ') || '—'}</dd>
                <dt>Dentist</dt>
                <dd>{a.dentist}</dd>
                <dt>Branch</dt>
                <dd>{a.branch ? `${a.branch} — ${a.branchAddress}` : '—'}</dd>
                <dt>Reason for visit</dt>
                <dd>{a.reason || '—'}</dd>
                {a.notes && (
                  <>
                    <dt>Patient notes</dt>
                    <dd>{a.notes}</dd>
                  </>
                )}
                {a.requestedDateTime && (
                  <>
                    <dt>Requested new time</dt>
                    <dd>{a.requestedDateTime}</dd>
                  </>
                )}
                {a.cancellationReason && (
                  <>
                    <dt>Reason given</dt>
                    <dd>{a.cancellationReason}</dd>
                  </>
                )}
              </dl>

              {actions.length > 0 && (
                <div className="portal-actions portal-spaced-top">
                  {actions.map((item) => (
                    <button
                      key={item.action}
                      type="button"
                      className={`btn btn-sm ${item.primary ? 'btn-primary' : 'btn-outline'}`}
                      disabled={run.isPending}
                      onClick={() => start(item)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
              {!pending && <FormError error={run.error} />}

              {a.patient?.id && can('patients.view') && (
                <p className="portal-spaced-top">
                  <a href={`${getClinicHref(clinicId, 'patients')}/${a.patient.id}`}>
                    Open patient{can('records.view') ? ' and clinical records' : ''}
                  </a>
                </p>
              )}
            </Section>

            <Section title="History">
              <ol className="portal-list">
                {a.history.map((entry, index) => (
                  <li key={`${entry.at}-${index}`} className="portal-list-item">
                    <Badge status={entry.to}>{getClinicStatusLabel(entry.to)}</Badge>{' '}
                    <span className="portal-table-muted">{formatDateTime(entry.at)}</span>
                    {entry.reason && <p className="portal-list-item-meta">{entry.reason}</p>}
                  </li>
                ))}
              </ol>
            </Section>

            {pending?.reason && (
              <Modal title={pending.label} onClose={() => setPending(null)}>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    run.mutate({ action: pending.action, body: { reason: reason.trim() } });
                  }}
                >
                  <Field
                    label="Reason (shared with the patient)"
                    as="textarea"
                    required
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <FormError error={run.error} />
                  <div className="portal-form-actions">
                    <button type="button" className="btn btn-outline" onClick={() => setPending(null)}>
                      Back
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={!reason.trim() || run.isPending}>
                      {run.isPending ? 'Saving…' : pending.label}
                    </button>
                  </div>
                </form>
              </Modal>
            )}

            {pending && !pending.reason && !pending.slot && (
              <ConfirmDialog
                title={pending.label}
                message={(CONFIRMATIONS[pending.action] ?? (() => 'Continue?'))(a.patient?.name ?? 'The patient')}
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
                title={pending.label}
                clinicId={clinicId}
                dentistId={a.dentistId}
                serviceRateId={a.serviceRateId}
                askReason
                confirmLabel="Save new time"
                isSaving={run.isPending}
                error={run.error}
                onClose={() => setPending(null)}
                onConfirm={(slot, slotReason) =>
                  run.mutate({ action: 'reschedule', body: { starts_at: slot.startsAt, reason: slotReason || undefined } })
                }
              />
            )}
          </div>
        );
      }}
    </QueryState>
  );
}

function ClinicAppointmentDetailPage() {
  const { appointmentId } = useParams();
  return (
    <ClinicLayout section="appointments" title="Appointment" requires={['appointments.view_all', 'appointments.view_assigned']}>
      <AppointmentDetail appointmentId={appointmentId} />
    </ClinicLayout>
  );
}

export default ClinicAppointmentDetailPage;
