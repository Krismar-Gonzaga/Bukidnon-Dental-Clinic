import Icon from '../Icon';
import './patientPanel.css';
import './DashboardAppointmentCard.css';

// Actions are not connected until appointment pages and the API exist.
function DashboardAppointmentCard({ appointment }) {
  const { service, dentist, clinic, status, dateTime } = appointment;
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
          <button
            type="button"
            className="btn patient-btn-sm patient-btn-outline"
            aria-label={`Reschedule ${service}`}
          >
            Reschedule
          </button>
        )}
        <button
          type="button"
          className="btn btn-primary patient-btn-sm"
          aria-label={`View ${service}`}
        >
          View
        </button>
      </div>
    </article>
  );
}

export default DashboardAppointmentCard;
