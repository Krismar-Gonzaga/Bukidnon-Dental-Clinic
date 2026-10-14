import { getAppointmentStatusLabel } from '../../config/appointments';
import './AppointmentStatusBadge.css';

// status: pending | upcoming | completed | cancelled
function AppointmentStatusBadge({ status }) {
  return (
    <span className={`appointment-status-badge appointment-status-badge--${status}`}>
      {getAppointmentStatusLabel(status)}
    </span>
  );
}

export default AppointmentStatusBadge;
