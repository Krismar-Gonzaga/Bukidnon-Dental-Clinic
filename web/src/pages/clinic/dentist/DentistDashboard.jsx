import { useQuery } from '@tanstack/react-query';
import Icon from '../../../components/Icon';
import { Card } from '../../../components/clinic/ClinicAdminUi';
import { InitialsTile, Pill, StatTile } from '../../../components/clinic/ClinicUi';
import { QueryState } from '../../../components/StatusMessage';
import { useAuth } from '../../../auth/AuthContext';
import { getClinicHref } from '../../../config/clinicNavigation';
import { NOTIFICATIONS_KEY } from '../../../hooks/useUnreadNotifications';
import { useClinic } from '../../../layouts/ClinicLayout';
import { toAppointment } from '../../../services/adapters';
import { getDentistOverview } from '../../../services/dentistApi';
import { getNotifications } from '../../../services/notificationApi';
import { businessMinutes, businessTodayKey, formatShortDate, formatTime, WEEKDAY_SHORT, dateFromKey } from '../../../utils/dateTime';
import { getNotificationHref } from '../../../utils/notificationLinks';
import { statusOf } from '../frontDesk';
import { dateAndTime, formatDay } from './dentistUi';
import '../../../components/clinic/ClinicAdminUi.css';
import './Dentist.css';

const RECENT_NOTIFICATIONS = 3;

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const doctorName = (name = '') => (/^dr\.?\s/i.test(name) ? name : `Dr. ${name}`);

function greeting() {
  const hour = Math.floor(businessMinutes(new Date().toISOString()) / 60);
  if (hour < 12) return 'Good morning';
  return hour < 18 ? 'Good afternoon' : 'Good evening';
}

function QueueRow({ appointment, number, href }) {
  const status = statusOf(appointment.backendStatus);
  const tone = appointment.backendStatus === 'in_progress' ? ' is-ongoing' : appointment.backendStatus === 'pending' ? ' is-pending' : '';
  return (
    <li>
      <a href={href} className={`dentist-queue-row${tone}`}>
        <span className="dentist-queue-number">{number}</span>
        <span className="dentist-queue-body">
          <span className="dentist-row-title">{appointment.patient?.name}</span>
          <span className="dentist-row-sub" style={{ display: 'block' }}>
            {appointment.service}
          </span>
        </span>
        <span className="dentist-queue-when">
          {formatTime(appointment.startsAt)}
          <Pill tone={status.tone}>{status.label}</Pill>
        </span>
        <span className="dentist-go" aria-hidden="true">
          <Icon name="chevronRight" size={18} />
        </span>
      </a>
    </li>
  );
}

function WeekChart({ week }) {
  const highest = Math.max(1, ...week.map(({ total }) => total));
  const day = ({ date }) => WEEKDAY_SHORT[dateFromKey(date).getDay()];
  return (
    <>
      <div className="dentist-chart" role="img" aria-label={`Appointments this week: ${week.map((d) => `${day(d)} ${d.total}`).join(', ')}`}>
        {week.map((item) => (
          <div key={item.date} className="dentist-chart-column">
            {item.total > 0 && <span className="dentist-chart-value">{item.total}</span>}
            {item.total > 0 && <div className="dentist-chart-bar" style={{ height: `${(item.total / highest) * 85}%` }} />}
          </div>
        ))}
      </div>
      <div className="dentist-chart-labels" aria-hidden="true">
        {week.map((item) => (
          <span key={item.date}>{day(item)}</span>
        ))}
      </div>
    </>
  );
}

function RecentNotifications() {
  const { user } = useAuth();
  const query = useQuery({ queryKey: [...NOTIFICATIONS_KEY, 'recent'], queryFn: () => getNotifications({ perPage: RECENT_NOTIFICATIONS }) });
  return (
    <Card title="Recent Notifications">
      <QueryState query={query} loadingLabel="Loading notifications…">
        {({ notifications }) =>
          notifications.length === 0 ? (
            <p className="clinic-admin-card-sub">No notifications yet.</p>
          ) : (
            <ul className="dentist-side-list">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <a href={getNotificationHref(notification, user) ?? '#'} className="dentist-mini-notice" style={{ color: 'inherit', textDecoration: 'none' }}>
                    <Icon name="bell" size={18} />
                    <span>
                      <span className="dentist-row-title" style={{ display: 'block', fontSize: '0.8125rem' }}>
                        {notification.title}
                      </span>
                      <span className="dentist-row-sub" style={{ display: 'block', fontSize: '0.75rem' }}>
                        {notification.message}
                      </span>
                      <span className="dentist-muted">{notification.time}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
    </Card>
  );
}

/** A dentist's day: who is next, what needs an answer, who is coming, and what is due. */
function DentistDashboard() {
  const { clinicId } = useClinic();
  const { user } = useAuth();
  const href = (section) => getClinicHref(clinicId, section);
  const appointmentsHref = href('appointments');
  const query = useQuery({ queryKey: ['clinic', clinicId, 'dentist', 'overview', businessTodayKey()], queryFn: () => getDentistOverview(clinicId) });

  const quickActions = [
    { href: appointmentsHref, icon: 'calendarBlank', label: 'Appointments' },
    { href: href('patients'), icon: 'users', label: 'Patient Records' },
    { href: href('dental-chart'), icon: 'activity', label: 'Dental Chart' },
    { href: href('prescriptions'), icon: 'bookOpen', label: 'Prescriptions' },
    { href: href('clinical-notes'), icon: 'clipboardList', label: 'Clinical Notes' },
    { href: href('follow-ups'), icon: 'calendarPlus', label: 'Follow-ups' },
  ];

  return (
    <QueryState query={query} loadingLabel="Loading your day…">
      {(data) => {
        const today = data.today.map(toAppointment);
        const pending = data.pending_requests.map(toAppointment);
        const upcoming = data.upcoming_patients.map(toAppointment);
        const { counts } = data;

        return (
          <>
            <section className="dentist-hero">
              <div>
                <p className="dentist-hero-greeting">{greeting()},</p>
                <h2 className="dentist-hero-name">{doctorName(user?.name)}</h2>
                <p className="dentist-hero-text">
                  You have <strong>{plural(counts.today, 'appointment', 'appointments')}</strong> today.{' '}
                  {counts.pending > 0 && (
                    <>
                      <strong className="is-alert">{plural(counts.pending, 'request', 'requests')}</strong> need your review.
                    </>
                  )}
                </p>
              </div>
              <div className="dentist-hero-actions">
                <a href={href('my-schedule')} className="dentist-hero-button">
                  <Icon name="calendarBlank" size={18} />
                  View Schedule
                </a>
                <a href={href('patients')} className="dentist-hero-button is-soft">
                  <Icon name="users" size={18} />
                  My Patients
                </a>
              </div>
            </section>

            <div className="frontdesk-stats clinic-form-gap">
              <StatTile icon="calendarBlank" tone="blue" value={counts.today} label="Today's Appointments" note={`${counts.today_confirmed} confirmed`} />
              <StatTile icon="clock" tone="amber" value={counts.pending} label="Pending Requests" note="Awaiting confirmation" />
              <StatTile icon="users" tone="green" value={counts.active_patients} label="Active Patients" note="Total caseload" />
              <StatTile
                icon="calendarPlus"
                tone="purple"
                value={counts.upcoming}
                label="Upcoming (3 days)"
                note={`${formatShortDate(`${data.upcoming_range.from}T12:00:00+08:00`)} – ${formatShortDate(`${data.upcoming_range.to}T12:00:00+08:00`)}`}
              />
            </div>

            <h2 className="frontdesk-section-title">Quick Actions</h2>
            <div className="dentist-quick">
              {quickActions.map((action) => (
                <a key={action.label} href={action.href} className="clinic-quick">
                  <Icon name={action.icon} size={24} />
                  {action.label}
                </a>
              ))}
            </div>

            <div className="dentist-split clinic-form-gap">
              <div className="dentist-stack">
                <Card
                  title="Today's Patient Queue"
                  actions={
                    <a href={`${appointmentsHref}?date=${businessTodayKey()}`} className="clinic-link-button">
                      View all
                    </a>
                  }
                >
                  {today.length === 0 ? (
                    <p className="clinic-admin-card-sub">No appointments today.</p>
                  ) : (
                    <ul className="dentist-queue">
                      {today.map((appointment, index) => (
                        <QueueRow key={appointment.id} appointment={appointment} number={index + 1} href={`${appointmentsHref}/${appointment.id}`} />
                      ))}
                    </ul>
                  )}
                </Card>
                <Card title="Appointments This Week">
                  <WeekChart week={data.week} />
                </Card>
              </div>

              <div className="dentist-stack">
                <Card title="Pending Requests" actions={counts.pending > 0 && <Pill tone="warning">{counts.pending}</Pill>}>
                  {pending.length === 0 ? (
                    <p className="clinic-admin-card-sub">Nothing is waiting for you.</p>
                  ) : (
                    <div className="dentist-side-list">
                      {pending.map((appointment) => (
                        <div key={appointment.id} className="dentist-request">
                          <div className="dentist-request-head">
                            <p className="dentist-row-title">{appointment.patient?.name}</p>
                            <span className="dentist-request-status">{statusOf(appointment.backendStatus).label}</span>
                          </div>
                          <p className="dentist-row-sub">{appointment.service}</p>
                          <p className="dentist-row-sub">{dateAndTime(appointment.startsAt)}</p>
                          <a href={`${appointmentsHref}/${appointment.id}`} className="btn btn-primary btn-sm">
                            Review
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card
                  title="Upcoming Patients"
                  actions={
                    <a href={appointmentsHref} className="clinic-link-button">
                      View all
                    </a>
                  }
                >
                  {upcoming.length === 0 ? (
                    <p className="clinic-admin-card-sub">Nobody is booked for the next three days.</p>
                  ) : (
                    <ul className="dentist-side-list">
                      {upcoming.map((appointment) => (
                        <li key={appointment.id} className="dentist-side-row">
                          <InitialsTile name={appointment.patient?.name} size="sm" tone="soft" />
                          <span>
                            <span className="dentist-row-title" style={{ display: 'block', fontSize: '0.875rem' }}>
                              {appointment.patient?.name}
                            </span>
                            <span className="dentist-row-sub" style={{ display: 'block', fontSize: '0.75rem' }}>
                              {dateAndTime(appointment.startsAt)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card title="Follow-ups Due">
                  {data.follow_ups_due.length === 0 ? (
                    <p className="clinic-admin-card-sub">No follow-ups scheduled.</p>
                  ) : (
                    <ul className="dentist-side-list">
                      {data.follow_ups_due.map((followUp) => (
                        <li key={followUp.id} className="dentist-side-row">
                          <span className={`dentist-dot${followUp.priority === 'high' ? ' is-high' : ''}`} aria-hidden="true" />
                          <span>
                            <span className="dentist-row-title" style={{ display: 'block', fontSize: '0.875rem' }}>
                              {followUp.patient}
                            </span>
                            <span className="dentist-row-sub" style={{ display: 'block', fontSize: '0.75rem' }}>
                              {formatDay(followUp.due_on)}
                              {followUp.priority === 'high' && <span className="visually-hidden"> (high priority)</span>}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="clinic-form-gap" style={{ marginBottom: 0 }}>
                    <a href={href('follow-ups')} className="dentist-link">
                      View all follow-ups
                    </a>
                  </p>
                </Card>

                <RecentNotifications />
              </div>
            </div>
          </>
        );
      }}
    </QueryState>
  );
}

export default DentistDashboard;
