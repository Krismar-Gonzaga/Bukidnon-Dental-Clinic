import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ClinicLayout, { useClinicAccess } from '../../../layouts/ClinicLayout';
import Icon from '../../../components/Icon';
import { Card } from '../../../components/clinic/ClinicAdminUi';
import { Field, FormError } from '../../../components/portal/PortalUi';
import { QueryState } from '../../../components/StatusMessage';
import { getClinicHref } from '../../../config/clinicNavigation';
import { cancelScheduleChange, getDentistSchedule, requestScheduleChange, submitScheduleChange } from '../../../services/dentistApi';
import { formatClockTime, formatDateTime, formatTime } from '../../../utils/dateTime';
import { WEEK_DAYS, workingDaysLabel } from '../frontDesk';
import { formatDay } from './dentistUi';
import '../../../components/clinic/ClinicAdminUi.css';
import './Dentist.css';

const firstName = (name = '') => name.split(' ')[0];
const monthDay = (key) => formatDay(key).replace(/,.*$/, '');

export function DayButtons({ days, onToggle }) {
  return (
    <div className="dentist-days" role={onToggle ? 'group' : undefined} aria-label={onToggle ? 'Working days' : undefined}>
      {WEEK_DAYS.map(({ day, label }) => {
        const isOn = days.includes(day);
        return onToggle ? (
          <button key={day} type="button" className={`dentist-day${isOn ? ' is-on' : ''}`} aria-pressed={isOn} onClick={() => onToggle(day)}>
            {label}
          </button>
        ) : (
          <span key={day} className={`dentist-day${isOn ? ' is-on' : ''}`} style={{ display: 'grid', placeItems: 'center' }}>
            {label}
            <span className="visually-hidden">{isOn ? ' (working)' : ' (off)'}</span>
          </span>
        );
      })}
    </div>
  );
}

function ChangeRequest({ clinicId }) {
  const [message, setMessage] = useState('');
  const send = useMutation({ mutationFn: () => requestScheduleChange(clinicId, message.trim()), onSuccess: () => setMessage('') });
  return (
    <Card title="Request Schedule Change" subtitle="Need to update your availability? Send a request to the clinic administrator.">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          send.mutate();
        }}
      >
        <Field label="Your request" as="textarea" rows={3} required maxLength={1000} placeholder="Describe your schedule change request…" value={message} onChange={(event) => setMessage(event.target.value)} />
        <FormError error={send.error} />
        {send.isSuccess && (
          <p className="clinic-saved-note is-navy" role="status">
            <Icon name="checkCircle" size={16} />
            Request sent to the clinic administrator.
          </p>
        )}
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={!message.trim() || send.isPending}>
          {send.isPending ? 'Sending…' : 'Send Request'}
        </button>
      </form>
    </Card>
  );
}

const changeSummary = (change) => `${change.branch ? `${change.branch}: ` : ''}${workingDaysLabel(change.days)} · ${formatClockTime(change.starts_at)} – ${formatClockTime(change.ends_at)}`;
const defaultBranch = (branches) => branches.find((branch) => branch.days.length > 0) ?? branches[0];

/** Proposed hours waiting for the administrator: the hours above stay in force until then. */
function PendingChange({ clinicId, change }) {
  const queryClient = useQueryClient();
  const cancel = useMutation({
    mutationFn: () => cancelScheduleChange(clinicId, change.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'dentist'] }),
  });
  return (
    <div className="dentist-change is-pending" role="status">
      <p className="dentist-change-title">
        <Icon name="clock" size={16} />
        Waiting for approval
      </p>
      <p className="dentist-change-text">{changeSummary(change)}</p>
      <p className="clinic-file-meta">Sent {formatDateTime(change.created_at)}. Your current hours stay in effect until your clinic administrator approves.</p>
      <FormError error={cancel.error} />
      <button type="button" className="dentist-link" disabled={cancel.isPending} onClick={() => cancel.mutate()}>
        {cancel.isPending ? 'Cancelling…' : 'Cancel Request'}
      </button>
    </div>
  );
}

function HoursCard({ clinicId, schedule, isEditing, onDone }) {
  const queryClient = useQueryClient();
  const branches = schedule.branches ?? [];
  const hasBranches = branches.length > 1;
  const first = defaultBranch(branches);
  // Hours are per branch: the form edits one branch, not the merged week shown above it.
  const [branchId, setBranchId] = useState(first?.id ?? null);
  const [days, setDays] = useState(first?.days ?? schedule.days);
  const [start, setStart] = useState(first?.starts_at ?? '08:00');
  const [end, setEnd] = useState(first?.ends_at ?? '17:00');
  const [note, setNote] = useState('');
  const chooseBranch = (id) => {
    const branch = branches.find((item) => String(item.id) === String(id));
    setBranchId(branch.id);
    setDays(branch.days);
    setStart(branch.starts_at ?? '08:00');
    setEnd(branch.ends_at ?? '17:00');
  };
  const save = useMutation({
    mutationFn: () => submitScheduleChange(clinicId, { days, starts_at: start, ends_at: end, note: note.trim() || undefined, branch_id: branchId ?? undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clinic', clinicId, 'dentist'] });
      onDone();
    },
  });
  const decision = schedule.last_decision;
  const wasDeclined = !schedule.pending_change && decision?.status === 'rejected';
  const toggle = (day) => setDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]));

  return (
    <Card title="Working Days & Hours">
      {isEditing && hasBranches && (
        <Field label="Branch" as="select" value={branchId ?? ''} onChange={(event) => chooseBranch(event.target.value)} options={branches.map(({ id, name }) => ({ value: id, label: name }))} />
      )}
      <DayButtons days={isEditing ? days : schedule.days} onToggle={isEditing ? toggle : undefined} />
      <div className="dentist-time-pair">
        {isEditing ? (
          <>
            <Field label="Start Time" type="time" value={start} onChange={(event) => setStart(event.target.value)} />
            <Field label="End Time" type="time" value={end} onChange={(event) => setEnd(event.target.value)} />
          </>
        ) : (
          <>
            <div className="dentist-info">
              <div>
                <p className="dentist-info-label">Start Time</p>
                <p className="dentist-info-value">{schedule.starts_at ? formatClockTime(schedule.starts_at) : 'Not set'}</p>
              </div>
            </div>
            <div className="dentist-info">
              <div>
                <p className="dentist-info-label">End Time</p>
                <p className="dentist-info-value">{schedule.ends_at ? formatClockTime(schedule.ends_at) : 'Not set'}</p>
              </div>
            </div>
          </>
        )}
      </div>
      {!isEditing && hasBranches && (
        <ul className="dentist-branch-hours">
          {branches.map((branch) => (
            <li key={branch.id}>
              <strong>{branch.name}</strong>
              <span>{branch.days.length > 0 ? `${workingDaysLabel(branch.days)} · ${formatClockTime(branch.starts_at)} – ${formatClockTime(branch.ends_at)}` : 'No hours here'}</span>
            </li>
          ))}
        </ul>
      )}
      {isEditing && (
        <>
          <Field label="Note to your administrator" as="textarea" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} />
          <p className="clinic-file-meta">Your clinic administrator approves changes before patients can book the new hours.</p>
          <FormError error={save.error} />
          <div className="dentist-actions-row">
            <button type="button" className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? 'Sending…' : 'Submit for Approval'}
            </button>
            <button type="button" className="btn btn-outline" onClick={onDone}>
              Cancel
            </button>
          </div>
        </>
      )}
      {schedule.pending_change && <PendingChange clinicId={clinicId} change={schedule.pending_change} />}
      {wasDeclined && !isEditing && (
        <div className="dentist-change is-declined" role="status">
          <p className="dentist-change-title">
            <Icon name="alertCircle" size={16} />
            Your last change was not approved
          </p>
          <p className="dentist-change-text">{changeSummary(decision)}</p>
          <p className="clinic-file-meta">Reason: {decision.review_note}</p>
        </div>
      )}
    </Card>
  );
}

/** My Schedule: working hours, this week's visits, and a way to ask the admin for changes. */
function DentistSchedulePage() {
  const { clinicId, can } = useClinicAccess();
  const [isEditing, setIsEditing] = useState(false);
  const query = useQuery({ queryKey: ['clinic', clinicId, 'dentist', 'schedule'], queryFn: () => getDentistSchedule(clinicId) });
  const data = query.data;
  const hours = data?.starts_at ? `${formatClockTime(data.starts_at)} – ${formatClockTime(data.ends_at)}` : 'Not set';
  const appointmentsHref = getClinicHref(clinicId, 'appointments');

  return (
    <ClinicLayout
      section="my-schedule"
      title="My Schedule"
      subtitle={data ? `${data.summary.clinic} · ${workingDaysLabel(data.days)} · ${hours}` : null}
      requires={['appointments.view_assigned']}
      hideSearch
      headerActions={
        data &&
        can('appointments.view_assigned') &&
        !data.pending_change &&
        !isEditing && (
          <button type="button" className="btn btn-primary clinic-header-button" onClick={() => setIsEditing(true)}>
            <Icon name="pencil" size={18} />
            Edit Schedule
          </button>
        )
      }
    >
      <QueryState query={query} loadingLabel="Loading your schedule…">
        {(schedule) => {
          const week = schedule.week.filter((day) => day.appointments.length > 0 || schedule.days.includes(new Date(`${day.date}T12:00:00+08:00`).getUTCDay()));
          const first = week[0]?.date;
          const last = week[week.length - 1]?.date;
          return (
            <div className="dentist-split">
              <div className="dentist-stack">
                <HoursCard key={isEditing ? 'editing' : 'viewing'} clinicId={clinicId} schedule={schedule} isEditing={isEditing} onDone={() => setIsEditing(false)} />
                <Card title={first ? `This Week (${monthDay(first)} – ${monthDay(last)})` : 'This Week'}>
                  {week.length === 0 ? (
                    <p className="clinic-admin-card-sub">No working days or visits this week.</p>
                  ) : (
                    <ul className="dentist-schedule-week">
                      {week.map((day) => (
                        <li key={day.date} className="dentist-schedule-row">
                          <span className="dentist-schedule-date">{monthDay(day.date)}</span>
                          <span className="dentist-schedule-chips">
                            {day.appointments.length === 0 ? (
                              <span className="dentist-muted">No appointments</span>
                            ) : (
                              day.appointments.map((appointment) => (
                                <a key={appointment.id} href={`${appointmentsHref}/${appointment.id}`} className="dentist-schedule-chip">
                                  {formatTime(appointment.starts_at)} — {firstName(appointment.patient)}
                                </a>
                              ))
                            )}
                          </span>
                          <span className="dentist-muted">{day.appointments.length === 1 ? '1 appt' : `${day.appointments.length} appts`}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
              <div className="dentist-stack">
                <Card title="Availability Summary">
                  <dl className="dentist-details">
                    {[
                      ['Working days', `${schedule.summary.working_days} days/week`],
                      ['Daily hours', hours],
                      ['Max daily slots', `${schedule.summary.max_daily_slots} slots`],
                      ['Clinic', schedule.summary.clinic],
                      ['Status', schedule.summary.status === 'active' ? 'Active' : 'Inactive'],
                    ].map(([label, value]) => (
                      <div key={label} className="dentist-detail-row">
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
                <ChangeRequest clinicId={clinicId} />
              </div>
            </div>
          );
        }}
      </QueryState>
    </ClinicLayout>
  );
}

export default DentistSchedulePage;
