import Icon from '../Icon';
import AppointmentStatusBadge from './AppointmentStatusBadge';
import {
  getAppointmentDetailsHref,
  getRescheduleHref,
  getReviewHref,
} from '../../config/patientNavigation';
import './patientPanel.css';
import './AppointmentHistoryCard.css';

// View, Reschedule, and Review link to their pages.
function AppointmentHistoryCard({ appointment }) {
  const { id, service, dentist, clinic, status, date, time } = appointment;
  const dateTime = `${date} at ${time}`;

  return (
    <article className="appointment-history-card">
      <span className="appointment-history-icon">
        <Icon name="calendarBlank" size={22} />
      </span>

      <div className="appointment-history-body">
        <div className="appointment-history-heading">
          <h2 className="appointment-history-service">{service}</h2>
          <AppointmentStatusBadge status={status} />
        </div>
        <p className="appointment-history-meta">
          {dentist} · {clinic}
        </p>
        <p className="appointment-history-time">{dateTime}</p>
      </div>

      <div className="appointment-history-actions">
        {status === 'pending' && (
          <span className="appointment-history-awaiting">Awaiting Approval</span>
        )}
        {status === 'upcoming' && (
          <a
            href={getRescheduleHref(id)}
            className="btn patient-btn-sm patient-btn-outline"
            aria-label={`Reschedule ${service}`}
          >
            Reschedule
          </a>
        )}
        {status === 'completed' && (
          <a
            href={getReviewHref(id)}
            className="btn patient-btn-sm patient-btn-outline"
            aria-label={`Review ${service} on ${dateTime}`}
          >
            Review
          </a>
        )}
        <a
          href={getAppointmentDetailsHref(id)}
          className="btn btn-primary patient-btn-sm"
          aria-label={`View ${service} on ${dateTime}`}
        >
          View
        </a>
      </div>
    </article>
  );
}

export default AppointmentHistoryCard;
