import Icon from '../Icon';
import { getAppointmentDetailsHref, getRescheduleHref } from '../../config/patientNavigation';
import './patientPanel.css';
import './DashboardAppointmentCard.css';

// View and Reschedule open the appointment's details and reschedule pages.
function DashboardAppointmentCard({ appointment }) {
  const { id, service, dentist, clinic, status, dateTime } = appointment;
  const isPending = status === 'pending';

  return (
    <article
      className={`dashboard-appointment${isPending ? ' is-pending' : ''}`}
    >
      <span className="dashboard-appointment-icon">
        <Icon name={isPending ? 'clock' : 'calendarBlank'} size={22} />
      </span>

      <div className="dashboard-appointment-body">
        <div className="dashboard-appointment-heading">
          <h3 className="dashboard-appointment-service">{service}</h3>
          {isPending && (
            <span className="dashboard-appointment-badge">Pending</span>
          )}
        </div>
        <p className="dashboard-appointment-meta">
          {dentist} · {clinic}
        </p>
        {isPending ? (
          <p className="dashboard-appointment-note">
            Awaiting clinic approval · Requested {dateTime}
          </p>
        ) : (
          <p className="dashboard-appointment-time">
            <Icon name="clock" size={13} />
            {dateTime}
          </p>
        )}
      </div>

      <div className="dashboard-appointment-actions">
        {!isPending && (
          <a
            href={getRescheduleHref(id)}
            className="btn patient-btn-sm patient-btn-outline"
            aria-label={`Reschedule ${service}`}
          >
            Reschedule
          </a>
        )}
        <a
          href={getAppointmentDetailsHref(id)}
          className="btn btn-primary patient-btn-sm"
          aria-label={`View ${service}`}
        >
          View
        </a>
      </div>
    </article>
  );
}

export default DashboardAppointmentCard;
