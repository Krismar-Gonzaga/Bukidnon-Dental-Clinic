import { useQuery } from '@tanstack/react-query';
import PatientLayout from '../layouts/PatientLayout';
import DashboardWelcome from '../components/patient/DashboardWelcome';
import DashboardStatCard from '../components/patient/DashboardStatCard';
import DashboardAppointmentCard from '../components/patient/DashboardAppointmentCard';
import DashboardNotifications from '../components/patient/DashboardNotifications';
import DashboardQuickActions from '../components/patient/DashboardQuickActions';
import { EmptyState, QueryState } from '../components/StatusMessage';
import {
  PATIENT_BOOK_HREF,
  PATIENT_DASHBOARD_HREF,
  PATIENT_HISTORY_HREF,
  PATIENT_QUICK_ACTIONS,
} from '../config/patientNavigation';
import { getPatientDashboard } from '../services/patientApi';
import { getNotifications } from '../services/notificationApi';
import { NOTIFICATIONS_KEY } from '../hooks/useUnreadNotifications';
import { getGreeting } from '../utils/patientDashboard';
import './PatientDashboardPage.css';

export const PATIENT_DASHBOARD_KEY = ['patient', 'dashboard'];

const toStats = (counts) => [
  { id: 'upcoming', label: 'Upcoming', value: counts.upcoming, icon: 'calendarBlank', tone: 'blue' },
  { id: 'completed', label: 'Completed', value: counts.completed, icon: 'checkCircle', tone: 'green' },
  { id: 'saved', label: 'Saved Clinics', value: counts.saved_clinics, icon: 'heart', tone: 'red' },
  { id: 'reviews', label: 'Reviews Given', value: counts.reviews_given, icon: 'star', tone: 'amber' },
];

// The card shows "Pending" until the clinic confirms; other active states
// display as confirmed.
const toDashboardCard = (appointment) => ({
  ...appointment,
  status: appointment.backendStatus === 'pending' ? 'pending' : 'confirmed',
});

function PatientDashboardPage() {
  const dashboard = useQuery({ queryKey: PATIENT_DASHBOARD_KEY, queryFn: getPatientDashboard });
  const notifications = useQuery({
    queryKey: [...NOTIFICATIONS_KEY, 'latest'],
    queryFn: () => getNotifications({ perPage: 3 }),
  });

  return (
    <PatientLayout title="Dashboard" activeHref={PATIENT_DASHBOARD_HREF}>
      <QueryState query={dashboard} loadingLabel="Loading your dashboard…">
        {(data) => {
          const upcoming = data.upcoming.map(toDashboardCard);
          return (
            <>
              <DashboardWelcome
                greeting={getGreeting()}
                name={data.name}
                confirmedCount={Math.max(0, data.counts.upcoming - data.counts.pending)}
                pendingCount={data.counts.pending}
              />

              <section className="patient-dashboard-stats" aria-label="Summary">
                {toStats(data.counts).map(({ id, ...stat }) => (
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
                  {upcoming.length > 0 ? (
                    <div className="patient-dashboard-appointments">
                      {upcoming.map((appointment) => (
                        <DashboardAppointmentCard key={appointment.id} appointment={appointment} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      icon="calendarBlank"
                      title="No upcoming appointments"
                      action={
                        <a href={PATIENT_BOOK_HREF} className="btn btn-primary btn-sm">
                          Book an Appointment
                        </a>
                      }
                    />
                  )}
                </section>

                <div className="patient-dashboard-side">
                  <DashboardNotifications notifications={notifications.data?.notifications ?? []} />
                  <DashboardQuickActions actions={PATIENT_QUICK_ACTIONS} />
                </div>
              </div>
            </>
          );
        }}
      </QueryState>
    </PatientLayout>
  );
}

export default PatientDashboardPage;
