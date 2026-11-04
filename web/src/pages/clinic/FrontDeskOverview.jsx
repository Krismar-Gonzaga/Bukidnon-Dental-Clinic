import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Card } from '../../components/clinic/ClinicAdminUi';
import { InitialsTile, Pill, StatTile } from '../../components/clinic/ClinicUi';
import { QueryState } from '../../components/StatusMessage';
import { useAuth } from '../../auth/AuthContext';
import { getClinicHref } from '../../config/clinicNavigation';
import { useClinic } from '../../layouts/ClinicLayout';
import { NOTIFICATIONS_KEY } from '../../hooks/useUnreadNotifications';
import { getClinicAppointments } from '../../services/clinicPortalApi';
import { getNotifications } from '../../services/notificationApi';
import { addDaysToKey, businessTodayKey, formatDate, formatTime } from '../../utils/dateTime';
import { getNotificationHref } from '../../utils/notificationLinks';
import { hasCheckedIn, statusOf, summarizeToday } from './frontDesk';
import '../../components/clinic/ClinicAdminUi.css';
import './FrontDesk.css';

const UPCOMING_LIMIT = 4;
const UPCOMING_DAYS = 3;
const NOTICE_LIMIT = 2;

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

const greeting = () => {
  const hour = Number(new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Manila' }));
  if (hour < 12) return 'Good morning,';
  return hour < 18 ? 'Good afternoon,' : 'Good evening,';
};

function Hero({ summary, checkInHref }) {
  const { user } = useAuth();
  return (
    <section className="clinic-hero" aria-label="Today at a glance">
      <div>
        <p className="clinic-hero-greeting">{greeting()}</p>
        <h2 className="clinic-hero-name">{user?.name}</h2>
        <p className="clinic-hero-summary">
          {summary ? (
            <>
              <strong>{plural(summary.total, 'appointment', 'appointments')}</strong> today. <strong className="is-accent">{plural(summary.waiting, 'patient', 'patients')}</strong> in the waiting area.
            </>
          ) : (
            "Loading today's figures…"
          )}
        </p>
      </div>
      <div className="clinic-hero-actions">
        <a href={checkInHref} className="clinic-hero-button is-solid">
          <Icon name="userCheck" size={18} />
          Check In Patient
        </a>
      </div>
    </section>
  );
}

function QueueRow({ appointment, number, href }) {
  const status = statusOf(appointment.backendStatus);
  const arrived = hasCheckedIn(appointment.backendStatus);
  const isPending = appointment.backendStatus === 'pending';
  return (
    <li>
      <a href={href} className={`frontdesk-queue-row${arrived ? ' is-arrived' : ''}${isPending ? ' is-pending' : ''}`}>
        <span className="frontdesk-number">{number}</span>
        <span className="frontdesk-row-body">
          <span className="frontdesk-row-title">{appointment.patient?.name}</span>
          <br />
          <span className="frontdesk-row-sub">
            {appointment.service} · {appointment.time}
          </span>
        </span>
        <span className="frontdesk-row-side">
          {arrived ? <span className="frontdesk-arrived-label">Checked In</span> : <span>Not checked in</span>}
          <Pill tone={status.tone}>{status.label}</Pill>
        </span>
      </a>
    </li>
  );
}

function Glance({ summary, upcomingCount }) {
  const rows = [
    ['Waiting', summary.waiting, 'warning'],
    ['Ongoing', summary.ongoing, 'info'],
    ['Completed', summary.completed, 'success'],
    ['No-show', summary.noShow, 'danger'],
    [`Upcoming (${UPCOMING_DAYS} days)`, upcomingCount, 'purple'],
  ];
  return (
    <Card title="Today at a Glance">
      <dl className="clinic-stat-rows">
        {rows.map(([label, value, tone]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              <span className={`frontdesk-count is-${tone}`}>{value}</span>
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function RecentNotifications({ allHref }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const query = useQuery({ queryKey: [...NOTIFICATIONS_KEY, 'recent'], queryFn: () => getNotifications({ perPage: NOTICE_LIMIT }) });
  return (
    <Card title="Recent Notifications">
      <QueryState query={query} loadingLabel="Loading notifications…">
        {({ notifications }) =>
          notifications.length === 0 ? (
            <p className="clinic-admin-card-sub">No notifications yet.</p>
          ) : (
            <ul className="frontdesk-list">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <button type="button" className="frontdesk-mini-notice" onClick={() => navigate(getNotificationHref(notification, user) ?? allHref)}>
                    <Icon name="bell" size={16} />
                    <span className="frontdesk-mini-notice-text">
                      <span className="frontdesk-mini-notice-title">{notification.title}</span>
                      <span>{notification.message}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
      <p className="clinic-form-gap">
        <a href={allHref} className="clinic-link-button">
          View all
        </a>
      </p>
    </Card>
  );
}

/** The front desk's day: who is due, who has arrived, and what comes next. */
function FrontDeskOverview() {
  const { clinicId, can } = useClinic();
  const today = businessTodayKey();
  const tomorrow = addDaysToKey(today, 1);
  const appointmentsHref = getClinicHref(clinicId, 'appointments');
  const checkInHref = getClinicHref(clinicId, 'check-in');

  const todayQuery = useQuery({
    queryKey: ['clinic', clinicId, 'appointments', 'today', today],
    queryFn: () => getClinicAppointments(clinicId, { from: today, to: today, per_page: 100 }),
  });
  const upcomingQuery = useQuery({
    queryKey: ['clinic', clinicId, 'appointments', 'upcoming', today],
    queryFn: () => getClinicAppointments(clinicId, { from: tomorrow, to: addDaysToKey(today, UPCOMING_DAYS), status: 'pending,confirmed', per_page: 100 }),
  });
  const summary = todayQuery.data ? summarizeToday(todayQuery.data.appointments) : null;
  const upcoming = upcomingQuery.data?.appointments ?? [];

  const quickActions = [
    can('patients.manage') && { href: `${getClinicHref(clinicId, 'patients')}?register=1`, icon: 'userPlus', label: 'Register Patient' },
    can('appointments.manage') && { href: `${appointmentsHref}/new`, icon: 'calendarBlank', label: 'Schedule Appointment' },
    can('appointments.manage') && { href: checkInHref, icon: 'userCheck', label: 'Check In Patient' },
    { href: `${appointmentsHref}?date=${today}`, icon: 'calendar', label: "Today's Appointments" },
  ].filter(Boolean);

  return (
    <>
      <Hero summary={summary} checkInHref={checkInHref} />
      <div className="frontdesk-stats clinic-form-gap">
        <StatTile icon="calendarBlank" tone="blue" value={summary?.total ?? '—'} label="Today's Appointments" note="All statuses" />
        <StatTile icon="userCheck" tone="blue" value={summary?.checkedIn ?? '—'} label="Checked In" note="In queue or ongoing" />
        <StatTile icon="checkCircle" tone="blue" value={summary?.completed ?? '—'} label="Completed" note="Today" />
        <StatTile icon="clock" tone="amber" value={summary?.pending ?? '—'} label="Pending Confirmation" note="Needs action" />
      </div>

      <h2 className="frontdesk-section-title">Quick Actions</h2>
      <div className="frontdesk-quick">
        {quickActions.map(({ href, icon, label }) => (
          <a key={label} href={href} className="clinic-quick">
            <Icon name={icon} size={24} />
            {label}
          </a>
        ))}
      </div>

      <div className="frontdesk-grid">
        <div>
          <Card
            title="Today's Appointment Queue"
            actions={
              <a href={`${appointmentsHref}?date=${today}`} className="clinic-link-button">
                View all
              </a>
            }
          >
            <QueryState query={todayQuery} loadingLabel="Loading today's appointments…">
              {({ appointments }) =>
                appointments.length === 0 ? (
                  <p className="clinic-admin-card-sub">No appointments today.</p>
                ) : (
                  <ul className="frontdesk-list">
                    {appointments.map((appointment, index) => (
                      <QueueRow key={appointment.id} appointment={appointment} number={index + 1} href={`${appointmentsHref}/${appointment.id}`} />
                    ))}
                  </ul>
                )
              }
            </QueryState>
          </Card>
          <Card title="Upcoming Appointments">
            <QueryState query={upcomingQuery} loadingLabel="Loading upcoming appointments…">
              {() =>
                upcoming.length === 0 ? (
                  <p className="clinic-admin-card-sub">Nothing booked for the next {UPCOMING_DAYS} days.</p>
                ) : (
                  <ul className="frontdesk-list">
                    {upcoming.slice(0, UPCOMING_LIMIT).map((appointment) => (
                      <li key={appointment.id} className="frontdesk-upcoming-row">
                        <InitialsTile name={appointment.patient?.name} size="sm" tone="soft" />
                        <div className="frontdesk-row-body">
                          <p className="frontdesk-row-title">{appointment.patient?.name}</p>
                          <p className="frontdesk-row-sub">{appointment.service}</p>
                        </div>
                        <p className="frontdesk-upcoming-when">
                          {formatDate(appointment.startsAt)}
                          <span>{formatTime(appointment.startsAt)}</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                )
              }
            </QueryState>
          </Card>
        </div>
        <div>
          {summary && <Glance summary={summary} upcomingCount={upcoming.length} />}
          <RecentNotifications allHref={getClinicHref(clinicId, 'notifications')} />
        </div>
      </div>
    </>
  );
}

export default FrontDeskOverview;
