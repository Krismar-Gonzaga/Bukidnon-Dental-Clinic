import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import ClinicLayout, { useClinicAccess } from '../../../layouts/ClinicLayout';
import Icon from '../../../components/Icon';
import { TableFooter } from '../../../components/admin/AdminData';
import { Card } from '../../../components/clinic/ClinicAdminUi';
import { AppointmentDecision, FilterSelect, Pill } from '../../../components/clinic/ClinicUi';
import { QueryState } from '../../../components/StatusMessage';
import { getClinicHref } from '../../../config/clinicNavigation';
import { getClinicAppointments, getClinicAppointmentsInRange } from '../../../services/clinicPortalApi';
import { addDaysToKey, businessTodayKey, dateFromKey, formatDate, formatTime, toBusinessDateKey, WEEKDAY_SHORT } from '../../../utils/dateTime';
import { hourParts, statusOf } from '../frontDesk';
import { formatDay } from './dentistUi';
import '../../../components/clinic/ClinicAdminUi.css';
import './Dentist.css';

const PAGE_SIZE = 50;
// The list opens around today: older visits are one date search away.
const DAYS_BACK = 7;
const DAYS_IN_WEEK = 7;

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending,reschedule_requested', label: 'Pending' },
  { value: 'confirmed,checked_in', label: 'Confirmed' },
  { value: 'in_progress', label: 'Ongoing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled,rejected,no_show', label: 'Cancelled' },
];

const needsAnswer = (appointment) => appointment.backendStatus === 'pending';

function mondayOf(key) {
  const day = dateFromKey(key).getDay();
  return addDaysToKey(key, day === 0 ? -6 : 1 - day);
}

function AppointmentRow({ appointment, href, onConfirm }) {
  const { hour, period } = hourParts(appointment.startsAt);
  const status = statusOf(appointment.backendStatus);
  return (
    <li className="dentist-appointment">
      <a href={href} className="dentist-appointment-open" aria-label={`Open appointment for ${appointment.patient?.name}`}>
        <span className="dentist-hour">
          {hour}
          <small>{period}</small>
        </span>
        <span>
          <span className="dentist-name-line">
            <span className="dentist-row-title">{appointment.patient?.name}</span>
            <Pill tone={status.tone}>{status.label}</Pill>
          </span>
          <span className="dentist-row-sub" style={{ display: 'block' }}>
            {appointment.service}
          </span>
          {appointment.treatmentNotes && <span className="dentist-note-line" style={{ display: 'block' }}>{appointment.treatmentNotes}</span>}
        </span>
      </a>
      {needsAnswer(appointment) && (
        <button type="button" className="dentist-confirm" aria-label={`Confirm appointment for ${appointment.patient?.name}`} onClick={() => onConfirm(appointment)}>
          Confirm
        </button>
      )}
      <a href={href} aria-hidden="true" tabIndex={-1} style={{ color: '#003f87' }}>
        <Icon name="chevronRight" size={18} />
      </a>
    </li>
  );
}

/** Appointments under their day, in the order the day comes. */
function ListView({ clinicId, status, dateFilter, startOn, onConfirm }) {
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'appointments', 'dentist-list', status, dateFilter, startOn, page],
    // Typing a date looks across every visit; otherwise the list starts a month back.
    queryFn: () =>
      getClinicAppointments(clinicId, {
        status: status || undefined,
        from: startOn ?? (dateFilter ? undefined : addDaysToKey(businessTodayKey(), -DAYS_BACK)),
        to: startOn ?? undefined,
        page,
        per_page: PAGE_SIZE,
      }),
    placeholderData: keepPreviousData,
  });
  const appointmentsHref = getClinicHref(clinicId, 'appointments');

  return (
    <QueryState query={query} loadingLabel="Loading appointments…">
      {({ appointments, meta }) => {
        const term = dateFilter.trim().toLowerCase();
        const shown = term ? appointments.filter((a) => formatDate(a.startsAt).toLowerCase().includes(term)) : appointments;
        const days = [];
        shown.forEach((appointment) => {
          const key = toBusinessDateKey(appointment.startsAt);
          const last = days[days.length - 1];
          if (last?.key === key) last.items.push(appointment);
          else days.push({ key, items: [appointment] });
        });

        if (shown.length === 0) return <p className="portal-empty">No appointments match these filters.</p>;

        return (
          <>
            {days.map(({ key, items }) => (
              <section key={key} aria-label={formatDay(key)}>
                <h2 className="dentist-day-head">
                  {formatDay(key)}
                  <span className="dentist-day-count">{items.length === 1 ? '1 appt' : `${items.length} appts`}</span>
                </h2>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {items.map((appointment) => (
                    <AppointmentRow key={appointment.id} appointment={appointment} href={`${appointmentsHref}/${appointment.id}`} onConfirm={onConfirm} />
                  ))}
                </ul>
              </section>
            ))}
            <TableFooter meta={meta} perPage={PAGE_SIZE} onPageChange={setPage} noun="appointments" label="Appointment pages" />
          </>
        );
      }}
    </QueryState>
  );
}

function CalendarView({ clinicId, status }) {
  const today = businessTodayKey();
  const [monday, setMonday] = useState(() => mondayOf(today));
  const sunday = addDaysToKey(monday, DAYS_IN_WEEK - 1);
  const appointmentsHref = getClinicHref(clinicId, 'appointments');
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'appointments', 'dentist-week', monday, status],
    queryFn: () => getClinicAppointmentsInRange(clinicId, { from: monday, to: sunday, status: status || undefined }),
    placeholderData: keepPreviousData,
  });
  const days = useMemo(() => Array.from({ length: DAYS_IN_WEEK }, (_, offset) => addDaysToKey(monday, offset)), [monday]);

  return (
    <Card
      title={`Week of ${formatDay(monday)} – ${formatDay(sunday)}`}
      actions={
        <div className="dentist-actions-row" style={{ marginTop: 0 }}>
          <button type="button" className="clinic-link-button" aria-label="Previous week" onClick={() => setMonday(addDaysToKey(monday, -DAYS_IN_WEEK))}>
            <Icon name="chevronLeft" size={18} />
          </button>
          <button type="button" className="clinic-link-button" aria-label="Next week" onClick={() => setMonday(addDaysToKey(monday, DAYS_IN_WEEK))}>
            <Icon name="chevronRight" size={18} />
          </button>
        </div>
      }
    >
      <QueryState query={query} loadingLabel="Loading this week…">
        {({ appointments }) => (
          <div className="dentist-week">
            {days.map((key) => {
              const items = appointments.filter((a) => toBusinessDateKey(a.startsAt) === key);
              return (
                <div key={key} className={`dentist-week-day${key === today ? ' is-today' : ''}`}>
                  <p className="dentist-week-title">
                    {WEEKDAY_SHORT[dateFromKey(key).getDay()]} {dateFromKey(key).getDate()}
                  </p>
                  {items.length === 0 ? (
                    <span className="dentist-muted">No appts</span>
                  ) : (
                    items.map((appointment) => (
                      <a key={appointment.id} href={`${appointmentsHref}/${appointment.id}`} className="dentist-week-chip">
                        {formatTime(appointment.startsAt)} {String(appointment.patient?.name ?? '').split(' ')[0]}
                      </a>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}
      </QueryState>
    </Card>
  );
}

/** My Appointments: a list by day or a week calendar, and an answer to a pending request. */
function DentistAppointments() {
  const { clinicId } = useClinicAccess();
  const [params] = useSearchParams();
  const startOn = params.get('date');
  const [view, setView] = useState('list');
  const [status, setStatus] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [decision, setDecision] = useState(null);
  const total = useQuery({
    queryKey: ['clinic', clinicId, 'appointments', 'dentist-total'],
    queryFn: () => getClinicAppointments(clinicId, { per_page: 1 }),
  });
  const totalCount = total.data?.meta?.total;

  return (
    <ClinicLayout
      section="appointments"
      title="My Appointments"
      subtitle={totalCount != null ? `${totalCount} total appointments` : null}
      hideSearch
      headerActions={
        <div className="dentist-view-switch" role="group" aria-label="Appointment view">
          {[
            ['list', 'List'],
            ['calendar', 'Calendar'],
          ].map(([value, label]) => (
            <button key={value} type="button" className={view === value ? 'is-active' : undefined} aria-pressed={view === value} onClick={() => setView(value)}>
              {label}
            </button>
          ))}
        </div>
      }
    >
      <div className="dentist-toolbar">
        <FilterSelect label="Filter by status" value={status} onChange={setStatus} options={STATUS_FILTERS} />
        {view === 'list' && (
          <label>
            <span className="visually-hidden">Filter by date</span>
            <input type="search" className="dentist-text-filter" placeholder="Filter by date (e.g. July)" maxLength={40} value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          </label>
        )}
      </div>

      {view === 'list' ? (
        <ListView clinicId={clinicId} status={status} dateFilter={dateFilter} startOn={startOn} onConfirm={(appointment) => setDecision({ appointment, action: 'confirm' })} />
      ) : (
        <CalendarView clinicId={clinicId} status={status} />
      )}
      {decision && <AppointmentDecision clinicId={clinicId} decision={decision} onClose={() => setDecision(null)} />}
    </ClinicLayout>
  );
}

export default DentistAppointments;
