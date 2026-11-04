import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '../Icon';
import { Card } from './ClinicAdminUi';
import { ConfirmDialog, Field, FormError, Modal } from '../portal/PortalUi';
import { approveScheduleChange, getScheduleChanges, rejectScheduleChange } from '../../services/clinicPortalApi';
import { formatClockTime, formatDateTime } from '../../utils/dateTime';
import { workingDaysLabel } from '../../pages/clinic/frontDesk';
import './ClinicAdminUi.css';
import './ScheduleApprovals.css';

const hours = (start, end) => (start ? `${formatClockTime(start)} – ${formatClockTime(end)}` : 'No hours set');

function DeclineModal({ clinicId, change, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const decline = useMutation({
    mutationFn: () => rejectScheduleChange(clinicId, change.id, reason.trim()),
    onSuccess: () => {
      onDone();
      onClose();
    },
  });
  return (
    <Modal title="Decline schedule change" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          decline.mutate();
        }}
      >
        <p className="portal-confirm-message">{change.dentist?.name} will be told the reason. Their current hours stay the same.</p>
        <Field label="Reason" as="textarea" rows={3} required maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
        <FormError error={decline.error} />
        <div className="portal-form-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Keep it
          </button>
          <button type="submit" className="btn btn-danger" disabled={!reason.trim() || decline.isPending}>
            {decline.isPending ? 'Saving…' : 'Decline'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Dentists' proposed hours waiting for a decision. Shows nothing when none are waiting. */
function ScheduleApprovals({ clinicId, dentistId }) {
  const queryClient = useQueryClient();
  const [approving, setApproving] = useState(null);
  const [declining, setDeclining] = useState(null);
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'schedule-changes', dentistId ?? 'all'],
    queryFn: () => getScheduleChanges(clinicId, dentistId ? { dentist_id: dentistId } : undefined),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['clinic', clinicId] });
  const approve = useMutation({
    mutationFn: (id) => approveScheduleChange(clinicId, id),
    onSuccess: () => {
      refresh();
      setApproving(null);
    },
  });
  const changes = query.data ?? [];

  if (query.isError) return <FormError error={query.error} />;
  if (changes.length === 0) return null;

  return (
    <Card title="Schedule Changes to Approve" subtitle="Nothing changes for patients until you approve." className="schedule-approvals">
      <ul className="schedule-approvals-list">
        {changes.map((change) => (
          <li key={change.id} className="schedule-approval">
            <p className="schedule-approval-who">{change.dentist?.name}</p>
            <p className="clinic-file-meta">
              {change.branch?.name} · Sent {formatDateTime(change.created_at)}
            </p>
            <dl className="schedule-approval-compare">
              <div>
                <dt>Now</dt>
                <dd>
                  {workingDaysLabel(change.current?.days ?? [])}
                  <span>{hours(change.current?.starts_at, change.current?.ends_at)}</span>
                </dd>
              </div>
              <div className="is-new">
                <dt>Requested</dt>
                <dd>
                  {workingDaysLabel(change.days)}
                  <span>{hours(change.starts_at, change.ends_at)}</span>
                </dd>
              </div>
            </dl>
            {change.note && <p className="schedule-approval-note">&ldquo;{change.note}&rdquo;</p>}
            {change.outside_hours > 0 && (
              <p className="clinic-warning-note">
                <Icon name="alertTriangle" size={16} />
                {change.outside_hours === 1 ? '1 booked visit falls' : `${change.outside_hours} booked visits fall`} outside these hours. Approving does not move them.
              </p>
            )}
            <div className="schedule-approval-actions">
              <button type="button" className="btn btn-primary btn-sm" aria-label={`Approve schedule change for ${change.dentist?.name}`} onClick={() => setApproving(change)}>
                Approve
              </button>
              <button type="button" className="btn btn-outline btn-sm" aria-label={`Decline schedule change for ${change.dentist?.name}`} onClick={() => setDeclining(change)}>
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
      {approving && (
        <ConfirmDialog
          title="Approve schedule change?"
          message={`${approving.dentist?.name}'s new hours take effect right away, and patients can book within them.`}
          confirmLabel="Approve"
          isBusy={approve.isPending}
          error={approve.error}
          onConfirm={() => approve.mutate(approving.id)}
          onCancel={() => setApproving(null)}
        />
      )}
      {declining && <DeclineModal clinicId={clinicId} change={declining} onClose={() => setDeclining(null)} onDone={refresh} />}
    </Card>
  );
}

export default ScheduleApprovals;
