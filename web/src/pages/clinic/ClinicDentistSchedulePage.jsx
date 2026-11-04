import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ClinicLayout, { useClinicAccess } from '../../layouts/ClinicLayout';
import { Card } from '../../components/clinic/ClinicAdminUi';
import { FilterSelect, Pill } from '../../components/clinic/ClinicUi';
import { QueryState } from '../../components/StatusMessage';
import { getClinicAppointments, getClinicDentists, getClinicServices } from '../../services/clinicPortalApi';
import { getAvailability } from '../../services/publicApi';
import { addDaysToKey, businessTodayKey, dateFromKey, formatClockTime } from '../../utils/dateTime';
import { hasCheckedIn, statusOf, workingDaysLabel } from './frontDesk';
import '../../components/clinic/ClinicAdminUi.css';
import './FrontDesk.css';

// Yesterday, today and the three days ahead, as in the design.
const DAY_OFFSETS = [-1, 0, 1, 2, 3];
const MAX_SLOTS = 8;

const dayLabel = (key, options) => new Intl.DateTimeFormat('en-US', options).format(dateFromKey(key));

function hoursLabel(schedules) {
  if (schedules.length === 0) return 'Not set';
  const starts = schedules.map((s) => s.starts_at).sort();
  const ends = schedules.map((s) => s.ends_at).sort();
  return `${formatClockTime(starts[0])} – ${formatClockTime(ends[ends.length - 1])}`;
}

function Availability({ dentist, clinicName }) {
  const schedules = dentist.schedules ?? [];
  return (
    <Card title={`${dentist.name} — Availability`}>
      <dl className="clinic-stat-rows">
        <div>
          <dt>Working Days</dt>
          <dd>{workingDaysLabel([...new Set(schedules.map((s) => s.day_of_week))])}</dd>
        </div>
        <div>
          <dt>Hours</dt>
          <dd>{hoursLabel(schedules)}</dd>
        </div>
        <div>
          <dt>Clinic</dt>
          <dd>{clinicName}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{dentist.is_active ? 'Active' : 'Inactive'}</dd>
        </div>
      </dl>
    </Card>
  );
}

function AvailableSlots({ clinicId, dentistId, date }) {
  const services = useQuery({ queryKey: ['clinic', clinicId, 'services'], queryFn: () => getClinicServices(clinicId) });
  // Open times depend on length, so the shortest service shows every time that could be booked.
  const shortest = (services.data ?? []).filter((s) => s.is_available).sort((a, b) => a.duration_minutes - b.duration_minutes)[0];
  const slots = useQuery({
    queryKey: ['clinic', clinicId, 'slots', 'schedule', shortest?.id, dentistId, date],
    queryFn: () => getAvailability({ clinicId, serviceRateId: shortest.id, dentistId, date }),
    enabled: Boolean(shortest && dentistId),
  });
  const isToday = date === businessTodayKey();

  return (
    <Card title={isToday ? 'Available Slots Today' : `Available Slots — ${dayLabel(date, { month: 'long', day: 'numeric' })}`}>
      {!shortest && !services.isPending ? (
        <p className="clinic-admin-card-sub">No services are available to book yet.</p>
      ) : (
        <QueryState query={slots} loadingLabel="Checking open times…">
          {(list) =>
            list.length === 0 ? (
              <p className="clinic-admin-card-sub">No open times on this day.</p>
            ) : (
              <>
                <ul className="frontdesk-list">
                  {list.slice(0, MAX_SLOTS).map((slot) => (
                    <li key={slot.startsAt} className="frontdesk-slot">
                      {slot.label}
                      <span>Available</span>
                    </li>
                  ))}
                </ul>
                <p className="clinic-file-meta clinic-form-gap">Use these slots when scheduling new appointments{isToday ? ' for today' : ''}.</p>
              </>
            )
          }
        </QueryState>
      )}
    </Card>
  );
}

/** A dentist's day for the front desk. View only: schedules are set by the clinic admin. */
function ClinicDentistSchedulePage() {
  const { clinicId, membership, can } = useClinicAccess();
  const today = businessTodayKey();
  const [date, setDate] = useState(today);
  const [dentistId, setDentistId] = useState('');
  const dentists = useQuery({ queryKey: ['clinic', clinicId, 'dentists'], queryFn: () => getClinicDentists(clinicId) });
  const active = (dentists.data ?? []).filter((d) => d.is_active);
  const dentist = active.find((d) => String(d.id) === dentistId);

  useEffect(() => {
    if (!dentistId && active.length > 0) setDentistId(String(active[0].id));
  }, [dentistId, active]);

  const appointments = useQuery({
    queryKey: ['clinic', clinicId, 'appointments', 'dentist-schedule', dentistId, date],
    queryFn: () => getClinicAppointments(clinicId, { from: date, to: date, dentist_id: dentistId, per_page: 100 }),
    enabled: Boolean(dentistId) && can('appointments.view_all'),
  });
  const total = appointments.data?.meta?.total;

  return (
    <ClinicLayout section="dentist-schedule" title="Dentist Schedule" subtitle="View-only — cannot be modified by staff" requires={['appointments.view_all']} hideSearch>
      <div className="frontdesk-day-chips" role="group" aria-label="Day">
        {DAY_OFFSETS.map((offset) => {
          const key = addDaysToKey(today, offset);
          return (
            <button key={key} type="button" className={`frontdesk-day-chip${key === date ? ' is-active' : ''}`} aria-pressed={key === date} onClick={() => setDate(key)}>
              {dayLabel(key, { month: 'long', day: 'numeric' })}
            </button>
          );
        })}
        {active.length > 1 && (
          <FilterSelect label="Dentist" value={dentistId} onChange={setDentistId} options={active.map((d) => ({ value: String(d.id), label: d.name }))} />
        )}
      </div>
      <QueryState query={dentists} loadingLabel="Loading dentists…">
        {() =>
          active.length === 0 ? (
            <p className="portal-empty">No active dentists yet.</p>
          ) : (
            <div className="frontdesk-grid is-flush">
              <Card
                title={`${dayLabel(date, { month: 'long', day: 'numeric', year: 'numeric' })} — Schedule`}
                actions={total != null && <span className="clinic-admin-card-sub">{total} {total === 1 ? 'appointment' : 'appointments'}</span>}
              >
                {dentistId && (
                  <QueryState query={appointments} loadingLabel="Loading schedule…">
                    {({ appointments: rows }) =>
                      rows.length === 0 ? (
                        <p className="clinic-admin-card-sub">No appointments on this day.</p>
                      ) : (
                        <ul className="frontdesk-list">
                          {rows.map((a) => {
                            const status = statusOf(a.backendStatus);
                            const [clock, period] = a.time.split(' ');
                            return (
                              <li key={a.id} className="frontdesk-queue-row">
                                <span className="frontdesk-schedule-time">
                                  {clock}
                                  <br />
                                  {period}
                                </span>
                                <span className="frontdesk-row-body">
                                  <span className="frontdesk-row-title">{a.patient?.name}</span>
                                  <br />
                                  <span className="frontdesk-row-sub">{a.service}</span>
                                </span>
                                <span className="frontdesk-row-side">
                                  {a.dentist}
                                  <Pill tone={status.tone}>{status.label}</Pill>
                                  {hasCheckedIn(a.backendStatus) && a.backendStatus !== 'completed' && <Pill tone="info">Checked In</Pill>}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )
                    }
                  </QueryState>
                )}
              </Card>
              <div>
                {dentist && <Availability dentist={dentist} clinicName={membership?.clinic_name} />}
                {dentistId && <AvailableSlots clinicId={clinicId} dentistId={dentistId} date={date} />}
              </div>
            </div>
          )
        }
      </QueryState>
    </ClinicLayout>
  );
}

export default ClinicDentistSchedulePage;
