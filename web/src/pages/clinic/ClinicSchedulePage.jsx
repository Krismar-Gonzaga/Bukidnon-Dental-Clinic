import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import ClinicLayout, { useClinic } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { ErrorState, LoadingState } from '../../components/StatusMessage';
import { getClinicHref, getClinicStatusLabel } from '../../config/clinicNavigation';
import { getClinicAppointmentsInRange } from '../../services/clinicPortalApi';
import {
  addDaysToKey,
  businessMinutes,
  businessTodayKey,
  dateFromKey,
  formatTime,
  toBusinessDateKey,
  WEEKDAY_SHORT,
} from '../../utils/dateTime';
import './ClinicSchedulePage.css';

const VIEWS = [
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'day', label: 'Day' },
];
const HOUR_HEIGHT = 80; // px per hour in the time grid (design: h-20)
const DEFAULT_HOURS = { start: 8, end: 17 };
const MIN_BLOCK_MINUTES = 20;
const DEFAULT_MINUTES = 30;
const MONTH_CELL_ITEMS = 3;
// Cancelled and declined requests are not on the calendar.
const OFF_CALENDAR = ['cancelled', 'rejected'];
const WAITING = ['pending', 'confirmed', 'reschedule_requested', 'checked_in', 'in_progress'];

const BLOCK_TONES = {
  in_progress: 'active',
  confirmed: 'confirmed',
  checked_in: 'confirmed',
  pending: 'pending',
  reschedule_requested: 'pending',
  completed: 'done',
  no_show: 'missed',
};

const count = (value) => new Intl.NumberFormat('en-PH').format(value ?? 0);
const plural = (n, one, many) => `${count(n)} ${n === 1 ? one : many}`;
const keyOf = (date) =>
  [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
const mondayOf = (key) => addDaysToKey(key, -((dateFromKey(key).getDay() + 6) % 7));
const monthStart = (key) => `${key.slice(0, 7)}-01`;
const shiftMonth = (key, months) => {
  const date = dateFromKey(monthStart(key));
  date.setMonth(date.getMonth() + months);
  return keyOf(date);
};
const monthEnd = (key) => addDaysToKey(shiftMonth(key, 1), -1);
const monthTitle = (key) => dateFromKey(key).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
const hourLabel = (hour) => `${String(hour % 12 || 12).padStart(2, '0')}:00 ${hour < 12 ? 'AM' : 'PM'}`;

/** Dates shown and fetched for a view around the anchor date. */
export function viewRange(view, anchor) {
  if (view === 'day') return { from: anchor, to: anchor, days: [anchor] };
  if (view === 'week') {
    const from = mondayOf(anchor);
    return { from, to: addDaysToKey(from, 6), days: Array.from({ length: 7 }, (_, i) => addDaysToKey(from, i)) };
  }
  // Month: whole Monday-first weeks around the month.
  const from = mondayOf(monthStart(anchor));
  const last = monthEnd(anchor);
  const to = addDaysToKey(mondayOf(last), 6);
  const days = [];
  for (let day = from; day <= to; day = addDaysToKey(day, 1)) days.push(day);
  return { from, to, days };
}

function step(view, anchor, direction) {
  if (view === 'day') return addDaysToKey(anchor, direction);
  if (view === 'week') return addDaysToKey(anchor, 7 * direction);
  return shiftMonth(anchor, direction);
}

function startMinutes(a) {
  return businessMinutes(a.startsAt);
}

function endMinutes(a) {
  const minutes = a.endsAt ? (new Date(a.endsAt) - new Date(a.startsAt)) / 60000 : a.durationMinutes ?? DEFAULT_MINUTES;
  return startMinutes(a) + Math.max(minutes, MIN_BLOCK_MINUTES);
}

/** Side-by-side lanes for overlapping appointments in one day. */
function withLanes(appointments) {
  const sorted = [...appointments].sort((a, b) => startMinutes(a) - startMinutes(b));
  const laneEnds = [];
  const placed = sorted.map((a) => {
    let lane = laneEnds.findIndex((end) => end <= startMinutes(a));
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = endMinutes(a);
    return { appointment: a, lane };
  });
  return placed.map((item) => ({ ...item, lanes: laneEnds.length }));
}

function hourRange(appointments) {
  if (appointments.length === 0) return DEFAULT_HOURS;
  return {
    start: Math.min(DEFAULT_HOURS.start, ...appointments.map((a) => Math.floor(startMinutes(a) / 60))),
    end: Math.max(DEFAULT_HOURS.end, ...appointments.map((a) => Math.ceil(endMinutes(a) / 60))),
  };
}

function AppointmentBlock({ appointment, lane, lanes, startHour }) {
  const { clinicId } = useClinic();
  const tone = BLOCK_TONES[appointment.backendStatus] ?? 'done';
  const top = ((startMinutes(appointment) - startHour * 60) / 60) * HOUR_HEIGHT;
  const height = ((endMinutes(appointment) - startMinutes(appointment)) / 60) * HOUR_HEIGHT;
  const label = `${formatTime(appointment.startsAt)}, ${appointment.service} with ${appointment.patient?.name ?? 'patient'}, ${getClinicStatusLabel(appointment.backendStatus)}`;

  return (
    <a
      href={`${getClinicHref(clinicId, 'appointments')}/${appointment.id}`}
      className={`schedule-block is-${tone}`}
      style={{ top, height, left: `calc(${(lane / lanes) * 100}% + 4px)`, width: `calc(${100 / lanes}% - 8px)` }}
      aria-label={label}
      title={label}
    >
      <span className="schedule-block-head">
        <span className="schedule-block-service">{appointment.service}</span>
        {tone === 'active' ? (
          <span className="schedule-block-live">
            <span className="schedule-block-pulse" aria-hidden="true" />
            ACTIVE
          </span>
        ) : tone === 'confirmed' ? (
          <Icon name="checkCircle" size={14} />
        ) : tone === 'pending' ? (
          <Icon name="clock" size={14} />
        ) : null}
      </span>
      <span className="schedule-block-line">{appointment.patient?.name}</span>
      <span className="schedule-block-line is-faint">
        {formatTime(appointment.startsAt)}
        {appointment.branch ? ` · ${appointment.branch}` : ''}
      </span>
    </a>
  );
}

function TimeGrid({ days, byDay, today }) {
  const visible = days.flatMap((day) => byDay[day] ?? []);
  const { start, end } = hourRange(visible);
  const hours = Array.from({ length: end - start }, (_, i) => start + i);
  const bodyHeight = hours.length * HOUR_HEIGHT;

  return (
    <div className="schedule-grid-scroll">
      <div className="schedule-grid" style={{ gridTemplateColumns: `80px repeat(${days.length}, minmax(120px, 1fr))` }}>
        <div className="schedule-time-column">
          <div className="schedule-head-cell schedule-time-head">TIME</div>
          {hours.map((hour) => (
            <div key={hour} className="schedule-time-cell">
              {hourLabel(hour)}
            </div>
          ))}
        </div>
        {days.map((day) => {
          const date = dateFromKey(day);
          const isToday = day === today;
          return (
            <div key={day} className={`schedule-day-column${isToday ? ' is-today' : ''}`}>
              <div className="schedule-head-cell" aria-current={isToday ? 'date' : undefined}>
                <span className="schedule-head-weekday">{WEEKDAY_SHORT[date.getDay()].toUpperCase()}</span>
                <span className="schedule-head-date">{date.getDate()}</span>
              </div>
              <div className="schedule-day-body" style={{ height: bodyHeight }}>
                {withLanes(byDay[day] ?? []).map(({ appointment, lane, lanes }) => (
                  <AppointmentBlock key={appointment.id} appointment={appointment} lane={lane} lanes={lanes} startHour={start} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthGrid({ days, byDay, anchor, today, onOpenDay }) {
  const { clinicId } = useClinic();
  const month = anchor.slice(0, 7);

  return (
    <div className="schedule-grid-scroll">
      <div className="schedule-month">
        {days.slice(0, 7).map((day) => (
          <div key={`head-${day}`} className="schedule-month-weekday">
            {WEEKDAY_SHORT[dateFromKey(day).getDay()].toUpperCase()}
          </div>
        ))}
        {days.map((day) => {
          const items = byDay[day] ?? [];
          const extra = items.length - MONTH_CELL_ITEMS;
          const date = dateFromKey(day);
          return (
            <div
              key={day}
              className={`schedule-month-cell${day.startsWith(month) ? '' : ' is-outside'}${day === today ? ' is-today' : ''}`}
            >
              <button
                type="button"
                className="schedule-month-date"
                onClick={() => onOpenDay(day)}
                aria-label={`${date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}: ${plural(items.length, 'appointment', 'appointments')}`}
              >
                {date.getDate()}
              </button>
              <ul className="schedule-month-items">
                {items.slice(0, MONTH_CELL_ITEMS).map((a) => (
                  <li key={a.id}>
                    <a
                      href={`${getClinicHref(clinicId, 'appointments')}/${a.id}`}
                      className={`schedule-month-item is-${BLOCK_TONES[a.backendStatus] ?? 'done'}`}
                    >
                      {formatTime(a.startsAt)} {a.patient?.name}
                    </a>
                  </li>
                ))}
              </ul>
              {extra > 0 && (
                <button type="button" className="schedule-month-more" onClick={() => onOpenDay(day)}>
                  +{extra} more
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const initials = (name = '') =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '?';

/** Happening now: started and not yet over, and not finished or missed. */
const isNow = (a, now) =>
  a.backendStatus === 'in_progress' ||
  (['confirmed', 'checked_in'].includes(a.backendStatus) &&
    new Date(a.startsAt) <= now &&
    now < new Date(a.endsAt ?? new Date(a.startsAt).getTime() + DEFAULT_MINUTES * 60000));

function TodayAgenda({ onViewAll }) {
  const { clinicId } = useClinic();
  const today = businessTodayKey();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const query = useQuery({
    queryKey: ['clinic', clinicId, 'appointments', 'calendar', today, today],
    queryFn: () => getClinicAppointmentsInRange(clinicId, { from: today, to: today }),
  });
  const agenda = (query.data?.appointments ?? []).filter((a) => !OFF_CALENDAR.includes(a.backendStatus));
  const completed = agenda.filter((a) => a.backendStatus === 'completed').length;
  const remaining = agenda.filter((a) => WAITING.includes(a.backendStatus)).length;

  return (
    <aside className="schedule-agenda" aria-labelledby="schedule-agenda-title">
      <div className="schedule-agenda-header">
        <h3 id="schedule-agenda-title" className="schedule-agenda-title">
          Today&apos;s Agenda
        </h3>
        <button type="button" className="schedule-link-button" onClick={onViewAll}>
          View All
        </button>
      </div>

      {query.isPending ? (
        <LoadingState label="Loading today…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : agenda.length === 0 ? (
        <p className="schedule-agenda-empty">No appointments today.</p>
      ) : (
        <ul className="schedule-agenda-list">
          {agenda.map((a) => {
            const live = isNow(a, now);
            const over = ['completed', 'no_show'].includes(a.backendStatus);
            return (
              <li key={a.id}>
                <a
                  href={`${getClinicHref(clinicId, 'appointments')}/${a.id}`}
                  className={`schedule-agenda-card${live ? ' is-now' : ''}${over ? ' is-over' : ''}`}
                >
                  {live && <span className="schedule-agenda-now">NOW</span>}
                  <span className="schedule-agenda-person">
                    <span className="schedule-agenda-avatar" aria-hidden="true">
                      {initials(a.patient?.name)}
                    </span>
                    <span>
                      <span className="schedule-agenda-name">{a.patient?.name ?? 'Patient'}</span>
                      <span className="schedule-agenda-service">{a.service}</span>
                    </span>
                  </span>
                  <span className="schedule-agenda-meta">
                    <span>
                      <Icon name="clock" size={16} />
                      {formatTime(a.startsAt)}
                    </span>
                    <span>
                      <Icon name="mapPin" size={16} />
                      {a.branch || getClinicStatusLabel(a.backendStatus)}
                    </span>
                  </span>
                  {!live && <span className="visually-hidden">{getClinicStatusLabel(a.backendStatus)}</span>}
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <div className="schedule-agenda-status">
        <p className="schedule-agenda-status-title">Daily Status</p>
        <dl className="schedule-agenda-stats">
          <div>
            <dt>Completed</dt>
            <dd className="is-primary">{query.data ? String(completed).padStart(2, '0') : '—'}</dd>
          </div>
          <div>
            <dt>Remaining</dt>
            <dd>{query.data ? String(remaining).padStart(2, '0') : '—'}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}

export function Schedule() {
  const { clinicId, can } = useClinic();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = businessTodayKey();
  const view = VIEWS.some(({ value }) => value === searchParams.get('view')) ? searchParams.get('view') : 'week';
  const anchor = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('date') ?? '') ? searchParams.get('date') : today;
  const { from, to, days } = viewRange(view, anchor);

  const go = (nextView, nextAnchor) => setSearchParams({ view: nextView, date: nextAnchor });

  const query = useQuery({
    queryKey: ['clinic', clinicId, 'appointments', 'calendar', from, to],
    queryFn: () => getClinicAppointmentsInRange(clinicId, { from, to }),
    placeholderData: keepPreviousData,
  });

  const appointments = (query.data?.appointments ?? []).filter((a) => !OFF_CALENDAR.includes(a.backendStatus));
  const byDay = appointments.reduce((groups, a) => {
    const day = toBusinessDateKey(a.startsAt);
    if (!groups[day]) groups[day] = [];
    groups[day].push(a);
    return groups;
  }, {});

  // Week view: Monday to Saturday, plus Sunday when something is booked.
  const shownDays = view === 'week' && !byDay[days[6]] ? days.slice(0, 6) : days;
  const inPeriod = view === 'month' ? appointments.filter((a) => toBusinessDateKey(a.startsAt).startsWith(anchor.slice(0, 7))) : appointments;
  const periodName = { day: 'today', week: 'this week', month: 'this month' }[view];
  const periodLabel = view === 'day' && anchor !== today ? 'on this day' : periodName;

  return (
    <div className="schedule-page">
      <div className="schedule-main">
        <div className="schedule-toolbar">
          <div>
            <h2 className="schedule-title">
              {view === 'day'
                ? dateFromKey(anchor).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
                : monthTitle(view === 'week' ? from : anchor)}
            </h2>
            <p className="schedule-subtitle" aria-live="polite">
              {query.data
                ? `${plural(inPeriod.length, 'appointment', 'appointments')} scheduled ${periodLabel}${can('appointments.view_all') ? '' : ' with you'}`
                : 'Loading appointments…'}
              {query.isFetching && query.data ? ' · updating…' : ''}
            </p>
          </div>

          <div className="schedule-views" role="group" aria-label="Calendar view">
            {VIEWS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`schedule-view${view === value ? ' is-active' : ''}`}
                aria-pressed={view === value}
                onClick={() => go(value, anchor)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="schedule-nav">
            <button type="button" className="schedule-nav-arrow" aria-label={`Previous ${view}`} onClick={() => go(view, step(view, anchor, -1))}>
              <Icon name="chevronLeft" size={20} />
            </button>
            <button type="button" className="schedule-today" onClick={() => go(view, today)}>
              Today
            </button>
            <button type="button" className="schedule-nav-arrow" aria-label={`Next ${view}`} onClick={() => go(view, step(view, anchor, 1))}>
              <Icon name="chevronRight" size={20} />
            </button>
          </div>
        </div>

        {query.isPending ? (
          <LoadingState label="Loading calendar…" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : (
          <>
            {!query.data.complete && (
              <p className="portal-inline-error" role="alert">
                Only the first 500 appointments in this period are shown. Use the day or week view to see the rest.
              </p>
            )}
            {view === 'month' ? (
              <MonthGrid days={days} byDay={byDay} anchor={anchor} today={today} onOpenDay={(day) => go('day', day)} />
            ) : (
              <TimeGrid days={shownDays} byDay={byDay} today={today} />
            )}
          </>
        )}
      </div>

      <TodayAgenda onViewAll={() => go('day', today)} />
    </div>
  );
}

function ClinicSchedulePage() {
  return (
    <ClinicLayout section="schedule" title="Schedule" requires={['appointments.view_all', 'appointments.view_assigned']}>
      <Schedule />
    </ClinicLayout>
  );
}

export default ClinicSchedulePage;
