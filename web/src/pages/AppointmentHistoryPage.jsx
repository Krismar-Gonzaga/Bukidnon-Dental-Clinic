import { useState } from 'react';
import PatientLayout from '../layouts/PatientLayout';
import StatusFilterChips from '../components/patient/StatusFilterChips';
import AppointmentHistoryCard from '../components/patient/AppointmentHistoryCard';
import { ALL_APPOINTMENTS_FILTER, APPOINTMENT_FILTERS } from '../config/appointments';
import { PATIENT_HISTORY_HREF } from '../config/patientNavigation';
import { MOCK_APPOINTMENT_HISTORY } from '../mocks/appointmentHistory';
import { MOCK_DASHBOARD_NOTIFICATIONS, MOCK_PATIENT } from '../mocks/patientDashboard';
import './AppointmentHistoryPage.css';

// Patient appointment history with MOCK data; not connected to the backend yet.
function AppointmentHistoryPage() {
  const [filterId, setFilterId] = useState(ALL_APPOINTMENTS_FILTER.id);

  const appointments =
    filterId === ALL_APPOINTMENTS_FILTER.id
      ? MOCK_APPOINTMENT_HISTORY
      : MOCK_APPOINTMENT_HISTORY.filter(({ status }) => status === filterId);

  return (
    <PatientLayout
      title="Appointment History"
      activeHref={PATIENT_HISTORY_HREF}
      user={MOCK_PATIENT}
      hasUnreadNotifications={MOCK_DASHBOARD_NOTIFICATIONS.some(({ unread }) => unread)}
    >
      <div className="appointment-history">
        <StatusFilterChips
          filters={APPOINTMENT_FILTERS}
          activeId={filterId}
          onChange={setFilterId}
          label="Filter appointments by status"
        />

        {appointments.length > 0 ? (
          <ul className="appointment-history-list">
            {appointments.map((appointment) => (
              <li key={appointment.id}>
                <AppointmentHistoryCard appointment={appointment} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="appointment-history-empty">No appointments in this category.</p>
        )}
      </div>
    </PatientLayout>
  );
}

export default AppointmentHistoryPage;
