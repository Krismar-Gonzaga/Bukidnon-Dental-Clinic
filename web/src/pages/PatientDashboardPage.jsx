import PatientLayout from '../layouts/PatientLayout';
import DashboardWelcome from '../components/patient/DashboardWelcome';
import DashboardStatCard from '../components/patient/DashboardStatCard';
import DashboardAppointmentCard from '../components/patient/DashboardAppointmentCard';
import DashboardNotifications from '../components/patient/DashboardNotifications';
import DashboardQuickActions from '../components/patient/DashboardQuickActions';
import {
  PATIENT_DASHBOARD_HREF,
  PATIENT_HISTORY_HREF,
  PATIENT_QUICK_ACTIONS,
} from '../config/patientNavigation';
import {
  MOCK_DASHBOARD_APPOINTMENTS,
  MOCK_DASHBOARD_NOTIFICATIONS,
  MOCK_DASHBOARD_STATS,
  MOCK_PATIENT,
} from '../mocks/patientDashboard';
import {
  countAppointmentsByStatus,
  getGreeting,
} from '../utils/patientDashboard';
import './PatientDashboardPage.css';

// Patient dashboard with MOCK data; not connected to the backend yet.
function PatientDashboardPage() {
  const appointments = MOCK_DASHBOARD_APPOINTMENTS;
  const notifications = MOCK_DASHBOARD_NOTIFICATIONS;

  return (
    <PatientLayout
      title="Dashboard"
      activeHref={PATIENT_DASHBOARD_HREF}
      user={MOCK_PATIENT}
      hasUnreadNotifications={notifications.some(({ unread }) => unread)}
    >
      <DashboardWelcome
        greeting={getGreeting()}
        name={MOCK_PATIENT.name}
        confirmedCount={countAppointmentsByStatus(appointments, 'confirmed')}
        pendingCount={countAppointmentsByStatus(appointments, 'pending')}
      />

      <section className="patient-dashboard-stats" aria-label="Summary">
        {MOCK_DASHBOARD_STATS.map(({ id, ...stat }) => (
          <DashboardStatCard key={id} {...stat} />
        ))}
      </section>

      <div className="patient-dashboard-grid">
        <section aria-labelledby="patient-dashboard-appointments-title">
          <div className="patient-dashboard-section-header">
            <h2
              id="patient-dashboard-appointments-title"
              className="patient-dashboard-section-title"
            >
              Appointments
            </h2>
            <a href={PATIENT_HISTORY_HREF} className="patient-dashboard-view-all">
              View All
            </a>
          </div>
          <div className="patient-dashboard-appointments">
            {appointments.map((appointment) => (
              <DashboardAppointmentCard
                key={appointment.id}
                appointment={appointment}
              />
            ))}
          </div>
        </section>

        <div className="patient-dashboard-side">
          <DashboardNotifications notifications={notifications} />
          <DashboardQuickActions actions={PATIENT_QUICK_ACTIONS} />
        </div>
      </div>
    </PatientLayout>
  );
}

export default PatientDashboardPage;
