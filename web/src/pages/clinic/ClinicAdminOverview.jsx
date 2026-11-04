import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useClinic } from '../../layouts/ClinicLayout';
import Icon from '../../components/Icon';
import { BarChart, LineChart } from '../../components/clinic/ClinicCharts';
import { AppointmentDecision, StatTile } from '../../components/clinic/ClinicUi';
import { ErrorState, LoadingState } from '../../components/StatusMessage';
import { getClinicHref } from '../../config/clinicNavigation';
import { useAuth } from '../../auth/AuthContext';
import { getAppointmentCalendar, getClinicAppointments, getClinicInsights } from '../../services/clinicPortalApi';
import { businessMinutes, businessTodayKey, dateFromKey, formatCompactDateTime, formatRelative } from '../../utils/dateTime';
import { InviteByEmailModal } from '../../components/clinic/ClinicAdminUi';
import './ClinicAdminOverview.css';

// Clinic admin dashboard (clinic admin design). Every figure comes from the
// API; the revenue is an estimate (listed price of completed visits).

const PENDING_SHOWN = 4;
const count = (value) => new Intl.NumberFormat('en-PH').format(value ?? 0);
const peso = (amount) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 }).format(amount ?? 0);
const pesoAxis = (amount) => (amount >= 1000 ? `₱${Math.round(amount / 100) / 10}k` : `₱${amount}`);
const plural = (n, one, many) => `${n === 1 ? one : many}`;

function greeting() {
  const minutes = businessMinutes(new Date().toISOString());
  if (minutes < 12 * 60) return 'Good morning,';
  return minutes < 18 * 60 ? 'Good afternoon,' : 'Good evening,';
}

function todayNote(today, yesterday) {
  const difference = today - yesterday;
  if (difference === 0) return 'Same as yesterday';
  return `${difference > 0 ? '+' : ''}${difference} from yesterday`;
}

/** "12% vs last month" with a direction, or null when there is nothing to compare. */
function revenueChange({ this_month: current, last_month: previous }) {
  if (!previous) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return { up: pct >= 0, text: `${Math.abs(pct)}% vs last month` };
}

function Hero({ insights, can, clinicId }) {
  const { user } = useAuth();
  const { clinicName } = useClinic();
  const [isInviting, setIsInviting] = useState(false);
  const appointments = insights?.today.appointments;
  const pending = insights?.today.pending_requests;

  return (
    <section className="clinic-hero" aria-label="Today at a glance">
      <div>
        <p className="clinic-hero-greeting">{greeting()}</p>
        <h2 className="clinic-hero-name">{user?.name}</h2>
        <p className="clinic-hero-summary">
          {insights ? (
            <>
              You have <strong>{count(appointments)} {plural(appointments, 'appointment', 'appointments')}</strong> today and{' '}
              <strong className="is-accent">{count(pending)} pending {plural(pending, 'approval', 'approvals')}</strong>.
            </>
          ) : (
            "Loading today's figures…"
          )}
        </p>
      </div>
      <div className="clinic-hero-actions">
        {can('appointments.manage') && (
          <a href={`${getClinicHref(clinicId, 'appointments')}/walk-in`} className="clinic-hero-button is-solid">
            <Icon name="calendarBlank" size={18} />
            Walk-in Appointment
          </a>
        )}
        {can('clinic.staff.manage') && (
          <button type="button" className="clinic-hero-button" onClick={() => setIsInviting(true)}>
            <Icon name="userPlus" size={18} />
            Invite Dentist
          </button>
        )}
      </div>
      {isInviting && <InviteByEmailModal clinicId={clinicId} clinicName={clinicName} role="dentist" title="Invite Dentist by Email" onClose={() => setIsInviting(false)} />}
    </section>
  );
}

function Stats({ insights, clinicId }) {
  const href = (section, query = '') => `${getClinicHref(clinicId, section)}${query}`;
  const { today, patients, dentists, staff, revenue } = insights;
  const change = revenueChange(revenue);

  return (
    <div className="clinic-overview-stats">
      <StatTile icon="calendarBlank" tone="blue" value={count(today.appointments)} label="Today's Appointments" note={todayNote(today.appointments, today.yesterday)} href={href('appointments', `?date=${today.date}`)} />
      <StatTile icon="clock" tone="amber" value={count(today.pending_requests)} label="Pending Requests" note={today.pending_requests ? 'Needs approval' : 'All caught up'} href={href('appointments', '?status=pending')} />
      <StatTile icon="users" tone="green" value={count(patients.total)} label="Total Patients" note={`+${count(patients.new_this_month)} this month`} href={href('patients')} />
      <StatTile icon="stethoscope" tone="purple" value={count(dentists.active)} label="Active Dentists" note={dentists.inactive ? `${dentists.inactive} inactive` : 'All active'} href={href('dentists')} />
      <StatTile icon="user" tone="teal" value={count(staff.total)} label="Clinic Staff" note={`${count(staff.active)} active`} href={href('staff')} />
      <StatTile
        icon="trendingUp"
        tone="green"
        value={peso(revenue.this_month)}
        label="Monthly Revenue"
        note={change ? change.text : 'Estimate from completed visits'}
        noteIcon={change ? (change.up ? 'trendingUp' : 'trendingDown') : undefined}
        href={href('reports')}
      />
    </div>
  );
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const FULL_DAY_FORMAT = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

function AppointmentsOverview({ days }) {
  const rows = days.map((day, index) => {
    const date = dateFromKey(day.date);
    return { ...day, key: day.date, label: index === days.length - 1 ? 'Today' : DAY_FORMAT.format(date), fullLabel: FULL_DAY_FORMAT.format(date) };
  });

  return (
    <section className="clinic-card-soft" aria-labelledby="overview-appointments">
      <h2 id="overview-appointments" className="clinic-card-soft-title">
        Appointments Overview
      </h2>
      <p className="clinic-card-soft-sub">Last 7 days</p>
      <BarChart
        caption="Appointments in the last 7 days"
        labelHeader="Day"
        rows={rows}
        series={[
          { key: 'confirmed', label: 'Confirmed', color: 'blue' },
          { key: 'pending', label: 'Pending', color: 'amber' },
          { key: 'cancelled', label: 'Cancelled', color: 'red' },
        ]}
      />
    </section>
  );
}

const MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'short' });
const LONG_MONTH_FORMAT = new Intl.DateTimeFormat('en-US', { month: 'long' });

function RevenueOverview({ revenue }) {
  const change = revenueChange(revenue);
  const rows = revenue.by_month.map(({ month, total }) => {
    const date = dateFromKey(`${month}-01`);
    return { key: month, label: MONTH_FORMAT.format(date), fullLabel: LONG_MONTH_FORMAT.format(date), value: total };
  });

  return (
    <section className="clinic-card-soft" aria-labelledby="overview-revenue">
      <div className="clinic-card-soft-head">
        <div>
          <h2 id="overview-revenue" className="clinic-card-soft-title">
            Revenue Overview
          </h2>
          <p className="clinic-card-soft-sub">Year to date · {revenue.year} · estimated from completed visits</p>
        </div>
        {change && (
          <span className={`clinic-trend${change.up ? '' : ' is-down'}`}>
            <Icon name={change.up ? 'trendingUp' : 'trendingDown'} size={16} />
            {change.text}
          </span>
        )}
      </div>
      <LineChart caption={`Estimated revenue by month, ${revenue.year}`} rows={rows} valueLabel="Revenue" formatValue={peso} formatAxis={pesoAxis} />
    </section>
  );
}

const ACTIVITY_ICONS = {
  appointment: { icon: 'checkCircle', tone: 'green' },
  patient: { icon: 'user', tone: 'blue' },
  membership: { icon: 'users', tone: 'purple' },
  inventory: { icon: 'clipboardList', tone: 'amber' },
  review: { icon: 'star', tone: 'amber' },
};

function RecentActivity({ activity }) {
  return (
    <section className="clinic-card-soft" aria-labelledby="overview-activity">
      <h2 id="overview-activity" className="clinic-card-soft-title">
        Recent Activity
      </h2>
      {activity.length === 0 ? (
        <p className="clinic-card-soft-sub clinic-overview-empty">Nothing recorded yet.</p>
      ) : (
        <ul className="clinic-activity">
          {activity.map((entry) => {
            const { icon, tone } = ACTIVITY_ICONS[entry.kind] ?? { icon: 'history', tone: 'blue' };
            return (
              <li key={entry.id}>
                <span className={`clinic-tile-icon is-${tone} clinic-activity-icon`} aria-hidden="true">
                  <Icon name={icon} size={18} />
                </span>
                <div>
                  <p className="clinic-activity-text">{entry.subject ? `${entry.title}: ${entry.subject}` : entry.title}</p>
                  <p className="clinic-card-soft-sub">
                    {formatRelative(entry.created_at)}
                    {entry.actor ? ` · ${entry.actor}` : ''}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function PendingApprovals({ clinicId, canDecide }) {
  const [decision, setDecision] = useState(null);
  const query = useQuery({
    queryKey: ['clinic', clinicId, 'appointments', 'pending-approvals'],
    queryFn: () => getClinicAppointments(clinicId, { status: 'pending', from: businessTodayKey(), per_page: PENDING_SHOWN }),
  });
  const rows = query.data?.appointments ?? [];

  return (
    <section className="clinic-card-soft" aria-labelledby="overview-pending">
      <div className="clinic-card-soft-head">
        <h2 id="overview-pending" className="clinic-card-soft-title">
          Pending Approvals
        </h2>
        <a href={`${getClinicHref(clinicId, 'appointments')}?status=pending`} className="clinic-overview-link">
          View all
        </a>
      </div>
      {query.isPending ? (
        <LoadingState label="Loading requests…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : rows.length === 0 ? (
        <p className="clinic-card-soft-sub">No requests waiting.</p>
      ) : (
        <ul className="clinic-pending-list">
          {rows.map((a) => (
            <li key={a.id} className="clinic-pending">
              <span className="clinic-pending-icon" aria-hidden="true">
                <Icon name="clock" size={20} />
              </span>
              <a href={`${getClinicHref(clinicId, 'appointments')}/${a.id}`} className="clinic-pending-text">
                <span className="clinic-pending-name">{a.patient?.name}</span>
                <span className="clinic-pending-meta">
                  {a.service} · {formatCompactDateTime(a.startsAt)}
                </span>
              </a>
              {canDecide && (
                <div className="clinic-pending-actions">
                  <button type="button" className="clinic-pending-button is-accept" aria-label={`Confirm ${a.patient?.name}`} onClick={() => setDecision({ appointment: a, action: 'confirm' })}>
                    <Icon name="check" size={18} />
                  </button>
                  <button type="button" className="clinic-pending-button is-decline" aria-label={`Decline ${a.patient?.name}`} onClick={() => setDecision({ appointment: a, action: 'reject' })}>
                    <Icon name="close" size={18} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {decision && <AppointmentDecision clinicId={clinicId} decision={decision} onClose={() => setDecision(null)} />}
    </section>
  );
}

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const CALENDAR_TITLE = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

const moveMonth = (key, by) => {
  const date = dateFromKey(`${key}-01`);
  date.setMonth(date.getMonth() + by);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

/** Day cells for a month grid starting on Monday; null fills the leading gap. */
export function monthCells(month) {
  const first = dateFromKey(`${month}-01`);
  const total = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  return [...Array(lead).fill(null), ...Array.from({ length: total }, (_, index) => `${month}-${String(index + 1).padStart(2, '0')}`)];
}

function MonthCalendar({ clinicId, todayCount }) {
  const today = businessTodayKey();
  const [month, setMonth] = useState(today.slice(0, 7));
  const query = useQuery({ queryKey: ['clinic', clinicId, 'appointments', 'calendar', month], queryFn: () => getAppointmentCalendar(clinicId, month) });
  const counts = Object.fromEntries((query.data?.days ?? []).map((d) => [d.date, d.total]));
  const appointmentsHref = getClinicHref(clinicId, 'appointments');

  return (
    <section className="clinic-card-soft" aria-labelledby="overview-calendar">
      <div className="clinic-card-soft-head clinic-calendar-head">
        <h2 id="overview-calendar" className="clinic-card-soft-title">
          {CALENDAR_TITLE.format(dateFromKey(`${month}-01`))}
        </h2>
        <div className="clinic-calendar-nav">
          <button type="button" className="clinic-icon-action" aria-label="Previous month" onClick={() => setMonth((m) => moveMonth(m, -1))}>
            <Icon name="chevronLeft" size={18} />
          </button>
          <button type="button" className="clinic-icon-action" aria-label="Next month" onClick={() => setMonth((m) => moveMonth(m, 1))}>
            <Icon name="chevronRight" size={18} />
          </button>
        </div>
      </div>
      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <div className="clinic-calendar" aria-busy={query.isFetching}>
          {WEEKDAYS.map((day) => (
            <span key={day} className="clinic-calendar-weekday">
              {day}
            </span>
          ))}
          {monthCells(month).map((key, index) => {
            if (!key) return <span key={`gap-${index}`} />;
            const total = counts[key] ?? 0;
            const day = Number(key.slice(8));
            const isToday = key === today;
            if (!total && !isToday) {
              return (
                <span key={key} className="clinic-calendar-day">
                  {day}
                </span>
              );
            }
            return (
              <a
                key={key}
                href={`${appointmentsHref}?date=${key}`}
                className={`clinic-calendar-day is-link${isToday ? ' is-today' : ' has-appointments'}`}
                aria-current={isToday ? 'date' : undefined}
                aria-label={`${FULL_DAY_FORMAT.format(dateFromKey(key))}: ${total} ${plural(total, 'appointment', 'appointments')}`}
              >
                {day}
              </a>
            );
          })}
        </div>
      )}
      <p className="clinic-calendar-note">
        <span className="clinic-calendar-dot" aria-hidden="true" />
        Today: {count(todayCount)} {plural(todayCount, 'appointment', 'appointments')}
      </p>
    </section>
  );
}

function QuickActions({ clinicId, can }) {
  const tile = (href, icon, label) => (
    <a href={href} className="clinic-quick">
      <Icon name={icon} size={24} />
      {label}
    </a>
  );

  return (
    <section className="clinic-card-soft" aria-labelledby="overview-quick">
      <h2 id="overview-quick" className="clinic-card-soft-title">
        Quick Actions
      </h2>
      <div className="clinic-quick-grid">
        {can('appointments.manage') && (
          <a href={`${getClinicHref(clinicId, 'appointments')}/walk-in`} className="clinic-quick">
            <Icon name="calendarBlank" size={24} />
            Walk-in Appt
          </a>
        )}
        {can('patients.manage') && tile(`${getClinicHref(clinicId, 'patients')}?register=1`, 'userPlus', 'Add Patient')}
        {can('inventory.manage') && tile(`${getClinicHref(clinicId, 'inventory')}?new=1`, 'package', 'Add Inventory')}
        {can('reports.view') && tile(getClinicHref(clinicId, 'reports'), 'barChart', 'View Reports')}
        {can('clinic.staff.manage') && tile(`${getClinicHref(clinicId, 'dentists')}/new`, 'stethoscope', 'Invite Dentist')}
        {can('clinic.settings.manage') && tile(getClinicHref(clinicId, 'clinic-settings'), 'settings', 'Settings')}
      </div>
    </section>
  );
}

/** The design's sections; `children` (the operations details) follow below. */
function ClinicAdminOverview({ children }) {
  const { clinicId, can } = useClinic();
  const query = useQuery({ queryKey: ['clinic', clinicId, 'insights'], queryFn: () => getClinicInsights(clinicId) });
  const insights = query.data;

  return (
    <div className="clinic-overview">
      <Hero insights={insights} can={can} clinicId={clinicId} />

      {query.isPending && <LoadingState label="Loading dashboard figures…" />}
      {query.isError && <ErrorState error={query.error} title="The dashboard figures could not load" onRetry={() => query.refetch()} />}
      {insights && <Stats insights={insights} clinicId={clinicId} />}

      <div className="clinic-overview-grid">
        <div className="clinic-overview-column">
          {insights && <AppointmentsOverview days={insights.appointments_by_day} />}
          {insights && <RevenueOverview revenue={insights.revenue} />}
          {insights && <RecentActivity activity={insights.activity} />}
        </div>
        <div className="clinic-overview-column">
          <PendingApprovals clinicId={clinicId} canDecide={can('appointments.manage')} />
          <MonthCalendar clinicId={clinicId} todayCount={insights?.today.appointments ?? 0} />
          <QuickActions clinicId={clinicId} can={can} />
        </div>
      </div>

      {children}
    </div>
  );
}

export default ClinicAdminOverview;
