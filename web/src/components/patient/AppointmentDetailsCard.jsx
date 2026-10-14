import Icon from '../Icon';
import AppointmentStatusBadge from './AppointmentStatusBadge';
import './AppointmentDetailsCard.css';

// Full details of one appointment. `children` holds status-specific content
// (notices, actions) below the detail rows.
function AppointmentDetailsCard({ appointment, children }) {
  const { reference, service, dentist, clinic, status, date, time } = appointment;
  const rows = [
    { label: 'Clinic', value: clinic, icon: 'building' },
    { label: 'Dentist', value: dentist, icon: 'user' },
    { label: 'Service', value: service, icon: 'clipboardList' },
    { label: 'Date', value: date, icon: 'calendarBlank' },
    { label: 'Time', value: time, icon: 'clock' },
  ];

  return (
    <section className="patient-panel appointment-details" aria-labelledby="appointment-details-title">
      <div className="appointment-details-header">
        <div>
          <h2
            id="appointment-details-title"
            className="appointment-details-title"
            tabIndex={-1}
          >
            {service}
          </h2>
          <p className="appointment-details-reference">Appointment #{reference}</p>
        </div>
        <AppointmentStatusBadge status={status} />
      </div>

      <dl className="appointment-details-rows">
        {rows.map(({ label, value, icon }) => (
          <div key={label} className="appointment-details-row">
            <span className="appointment-details-icon">
              <Icon name={icon} size={18} />
            </span>
            <div>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          </div>
        ))}
      </dl>

      {children}
    </section>
  );
}

export default AppointmentDetailsCard;
