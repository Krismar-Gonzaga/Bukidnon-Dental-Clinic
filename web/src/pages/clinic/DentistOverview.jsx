import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useClinic } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { Badge } from '../../components/portal/PortalUi';
import NewRecordModal from '../../components/portal/NewRecordModal';
import { ErrorState, LoadingState, QueryState } from '../../components/StatusMessage';
import { getClinicHref, getClinicStatusLabel, getRecordTypeLabel } from '../../config/clinicNavigation';
import { getClinicDashboard, getClinicRecords } from '../../services/clinicPortalApi';
import { toAppointment } from '../../services/adapters';
import { useAuth } from '../../auth/AuthContext';
import { businessMinutes, businessTodayKey, dateFromKey, formatRelative, formatTime, WEEKDAY_NAMES } from '../../utils/dateTime';
import './DentistOverview.css';

const SCHEDULE_PREVIEW = 3;
const NOTES_PREVIEW = 3;
const NOT_SCHEDULED = ['cancelled', 'rejected'];
const WAITING = ['pending', 'confirmed', 'reschedule_requested', 'checked_in'];

const count = (value) => new Intl.NumberFormat('en-PH').format(value ?? 0);
const plural = (n, one, many) => `${count(n)} ${n === 1 ? one : many}`;
const isScheduled = (a) => !NOT_SCHEDULED.includes(a.backendStatus);

/** The current time, refreshed every minute ("starts in 15 minutes"). */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

function greeting(now) {
  const hour = Math.floor(businessMinutes(now.toISOString()) / 60);
  if (hour < 12) return 'Good morning';
  return hour < 18 ? 'Good afternoon' : 'Good evening';
}

const doctorName = (name = '') => (/^dr\.?\s/i.test(name) ? name : `Dr. ${name}`);

/** "You have 4 appointments today. The first one starts in 15 minutes." */
export function daySummary(appointments, now) {
  const scheduled = appointments.filter(isScheduled);
  if (scheduled.length === 0) return 'You have no appointments scheduled for today.';

  const head = `You have ${plural(scheduled.length, 'appointment', 'appointments')} scheduled for today.`;
  const inProgress = scheduled.find((a) => a.backendStatus === 'in_progress');
  if (inProgress) return `${head} Your visit with ${inProgress.patient?.name ?? 'a patient'} is in progress.`;

  const next = scheduled.find((a) => WAITING.includes(a.backendStatus) && new Date(a.startsAt) > now);
  if (!next) return `${head} No more visits are waiting today.`;

  const minutes = Math.round((new Date(next.startsAt) - now) / 60000);
  const when = minutes < 60 ? `in ${plural(Math.max(minutes, 1), 'minute', 'minutes')}` : `at ${formatTime(next.startsAt)}`;
  const which = scheduled.every((a) => new Date(a.startsAt) > now) ? 'The first one' : 'The next one';
  return `${head} ${which} starts ${when}.`;
}

/** "+8% vs last Monday", against the same weekday a week ago. */
function weekChange(current, previous, weekday) {
  if (!previous) return { text: `None last ${weekday}`, direction: 'flat' };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { text: `Same as last ${weekday}`, direction: 'flat' };
  return { text: `${pct > 0 ? '+' : ''}${pct}% vs last ${weekday}`, direction: pct > 0 ? 'up' : 'down' };
}

function MetricCard({ label, value, icon, tone, change }) {
  return (
    <div className="dentist-metric">
      <div className="dentist-metric-top">
        <span className={`dentist-metric-icon is-${tone}`} aria-hidden="true">
          <Icon name={icon} size={24} />
        </span>
        {change && <span className={`dentist-metric-change is-${change.direction}`}>{change.text}</span>}
      </div>
      <p className="dentist-metric-label">{label}</p>
      <p className="dentist-metric-value">{value}</p>
    </div>
  );
}

function ScheduleRow({ appointment }) {
  const { clinicId } = useClinic();
  const [clock, period] = formatTime(appointment.startsAt).split(' ');
  const muted = !isScheduled(appointment);

  return (
    <li>
      <a
        href={`${getClinicHref(clinicId, 'appointments')}/${appointment.id}`}
        className={`dentist-schedule-row${muted ? ' is-muted' : ''}`}
      >
        <span className="dentist-schedule-time">
          <span className="dentist-schedule-clock">{clock.padStart(5, '0')}</span>
          <span className="dentist-schedule-period">{period}</span>
        </span>
        <span className="dentist-schedule-divider" aria-hidden="true" />
        <span className="dentist-schedule-body">
          <span className="dentist-schedule-head">
            <span className="dentist-schedule-patient">{appointment.patient?.name ?? 'Patient'}</span>
            <Badge status={appointment.backendStatus}>{getClinicStatusLabel(appointment.backendStatus)}</Badge>
          </span>
          <span className="dentist-schedule-meta">
            {[appointment.service, appointment.branch].filter(Boolean).join(' • ')}
          </span>
        </span>
        <Icon name="chevronRight" size={20} className="dentist-schedule-chevron" />
      </a>
    </li>
  );
}

function TodaySchedule({ appointments }) {
  const { clinicId } = useClinic();
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? appointments : appointments.slice(0, SCHEDULE_PREVIEW);
  const hiddenCount = appointments.length - SCHEDULE_PREVIEW;

  return (
    <section className="dentist-card" aria-labelledby="dentist-today-title">
      <div className="dentist-card-header">
        <h3 id="dentist-today-title" className="dentist-card-title">
          Today&apos;s Schedule
        </h3>
        <a href={getClinicHref(clinicId, 'schedule')} className="dentist-card-link">
          View Calendar
        </a>
      </div>
      {appointments.length === 0 ? (
        <p className="dentist-empty">No appointments today.</p>
      ) : (
        <ul className="dentist-schedule-list">
          {shown.map((a) => (
            <ScheduleRow key={a.id} appointment={a} />
          ))}
        </ul>
      )}
      {hiddenCount > 0 && (
        <button type="button" className="dentist-schedule-more" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
          <Icon name="chevronDown" size={18} className={expanded ? 'is-flipped' : undefined} />
          {expanded ? 'Show fewer appointments' : `Show ${plural(hiddenCount, 'more appointment', 'more appointments')}`}
        </button>
      )}
    </section>
  );
}

function QuickAction({ icon, label, href, onClick }) {
  const content = (
    <>
      <span className="dentist-action-label">
        <Icon name={icon} size={22} className="dentist-action-icon" />
        {label}
      </span>
      <Icon name="arrowRight" size={20} className="dentist-action-arrow" />
    </>
  );
  return (
    <li>
      {href ? (
        <a href={href} className="dentist-action">
          {content}
        </a>
      ) : (
        <button type="button" className="dentist-action" onClick={onClick}>
          {content}
        </button>
      )}
    </li>
  );
}

const RECORD_ACTIONS = {
  treatment: { title: 'Create treatment plan', recordType: 'treatment' },
  examination: { title: 'Add examination note', recordType: 'examination' },
};

function QuickActions() {
  const { clinicId, can } = useClinic();
  const [recordAction, setRecordAction] = useState(null);
  const [saved, setSaved] = useState(null);
  const patientsHref = getClinicHref(clinicId, 'patients');

  return (
    <section className="dentist-panel" aria-labelledby="dentist-actions-title">
      <h3 id="dentist-actions-title" className="dentist-overline">
        Quick Actions
      </h3>
      <ul className="dentist-action-list">
        {can('patients.manage') && <QuickAction icon="userPlus" label="Add New Patient" href={`${patientsHref}?register=1`} />}
        {can('records.write') && (
          <>
            <QuickAction icon="clipboardList" label="Create Treatment Plan" onClick={() => setRecordAction(RECORD_ACTIONS.treatment)} />
            <QuickAction icon="stethoscope" label="Add Examination Note" onClick={() => setRecordAction(RECORD_ACTIONS.examination)} />
          </>
        )}
        {can('patients.view') && <QuickAction icon="users" label="Find a Patient" href={patientsHref} />}
      </ul>
      {saved && (
        <p className="dentist-saved" role="status">
          <Icon name="checkCircle" size={18} />
          <span>
            Record saved for <a href={`${patientsHref}/${saved.id}`}>{saved.name}</a>.
          </span>
        </p>
      )}
      {recordAction && (
        <NewRecordModal
          clinicId={clinicId}
          title={recordAction.title}
          recordType={recordAction.recordType}
          onClose={() => setRecordAction(null)}
          onSaved={setSaved}
        />
      )}
    </section>
  );
}

const noteText = (record) =>
  [record.findings, record.procedures, record.chief_complaint, record.care_instructions, record.notes].find((text) => text?.trim()) ?? '';

function ClinicalNotes() {
  const { clinicId } = useClinic();
  const recordsHref = `${getClinicHref(clinicId, 'records')}?mine=1`;
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'records', 'mine', 'preview'],
    queryFn: () => getClinicRecords(clinicId, { mine: 1, per_page: NOTES_PREVIEW }),
  });

  return (
    <section className="dentist-card dentist-notes" aria-labelledby="dentist-notes-title">
      <div className="dentist-notes-header">
        <h3 id="dentist-notes-title" className="dentist-overline">
          Clinical Notes
        </h3>
        <a href={recordsHref} className="dentist-notes-more" aria-label="All my clinical notes">
          <Icon name="moreVertical" size={20} />
        </a>
      </div>
      {query.isPending ? (
        <LoadingState label="Loading notes…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <p className="dentist-empty">Notes you write in patient records appear here.</p>
      ) : (
        <ol className="dentist-note-list">
          {query.data.items.map((record, index) => (
            <li key={record.id} className={`dentist-note${index === 0 ? ' is-latest' : ''}`}>
              <p className="dentist-note-head">
                <a href={`${getClinicHref(clinicId, 'patients')}/${record.patient_id}`}>{record.patient?.name ?? 'Patient'}</a>
                <span className="dentist-note-time">
                  {getRecordTypeLabel(record.record_type)} · {formatRelative(record.created_at)}
                </span>
              </p>
              <p className="dentist-note-text">{noteText(record)}</p>
            </li>
          ))}
        </ol>
      )}
      <a href={recordsHref} className="dentist-notes-all">
        View All Notes
      </a>
    </section>
  );
}

/** Dentist dashboard (dentist design): today's patients, figures, quick actions and recent notes. */
function DentistOverview() {
  const { clinicId, can } = useClinic();
  const { user } = useAuth();
  const now = useNow();
  const query = useQuery({ queryKey: ['clinic', clinicId, 'dashboard'], queryFn: () => getClinicDashboard(clinicId) });

  return (
    <QueryState query={query} loadingLabel="Loading your day…">
      {(data) => {
        const today = (data.appointments?.today ?? []).map(toAppointment);
        const scheduledToday = today.filter(isScheduled).length;
        const weekday = WEEKDAY_NAMES[dateFromKey(businessTodayKey(now)).getDay()];
        const patients = data.my_patients;

        return (
          <div className="dentist-overview">
            <section className="dentist-welcome">
              <h2 className="dentist-welcome-title">
                {greeting(now)}, {doctorName(user?.name)}
              </h2>
              <p className="dentist-welcome-text">{daySummary(today, now)}</p>
            </section>

            <section className="dentist-metrics" aria-label="Today at a glance">
              {data.appointments && (
                <MetricCard
                  label="Today's Appointments"
                  value={count(scheduledToday)}
                  icon="calendarBlank"
                  tone="primary"
                  change={weekChange(scheduledToday, data.appointments.same_day_last_week, weekday)}
                />
              )}
              {patients && (
                <MetricCard
                  label="New Patients This Month"
                  value={count(patients.new_this_month)}
                  icon="userPlus"
                  tone="secondary"
                  change={{ text: patients.new_today ? `+${count(patients.new_today)} today` : `${count(patients.total)} in your care`, direction: patients.new_today ? 'up' : 'flat' }}
                />
              )}
            </section>

            <div className="dentist-columns">
              <div className="dentist-main-column">{data.appointments && <TodaySchedule appointments={today} />}</div>
              <div className="dentist-side-column">
                <QuickActions />
                {can('records.view') && <ClinicalNotes />}
              </div>
            </div>
          </div>
        );
      }}
    </QueryState>
  );
}

export default DentistOverview;
