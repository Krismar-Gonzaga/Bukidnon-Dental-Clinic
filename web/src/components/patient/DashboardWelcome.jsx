import {
  PATIENT_FIND_CLINICS_HREF,
  PATIENT_BOOK_HREF,
} from '../../config/patientNavigation';
import { pluralize } from '../../utils/patientDashboard';
import './DashboardWelcome.css';

function DashboardWelcome({ greeting, name, confirmedCount, pendingCount }) {
  return (
    <section className="dashboard-welcome" aria-labelledby="dashboard-welcome-name">
      <p className="dashboard-welcome-greeting">{greeting},</p>
      <h2 id="dashboard-welcome-name" className="dashboard-welcome-name">
        {name}
      </h2>
      <p className="dashboard-welcome-summary">
        You have{' '}
        <strong>
          {pluralize(confirmedCount, 'confirmed appointment', 'confirmed appointments')}
        </strong>{' '}
        and{' '}
        <strong className="dashboard-welcome-pending">
          {pluralize(pendingCount, 'pending approval', 'pending approvals')}
        </strong>
        .
      </p>
      <div className="dashboard-welcome-actions">
        <a href={PATIENT_BOOK_HREF} className="btn dashboard-welcome-btn-light">
          Book Appointment
        </a>
        <a href={PATIENT_FIND_CLINICS_HREF} className="btn dashboard-welcome-btn-ghost">
          Find Clinics
        </a>
      </div>
    </section>
  );
}

export default DashboardWelcome;
