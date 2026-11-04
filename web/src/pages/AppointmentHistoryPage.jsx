import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PatientLayout from '../layouts/PatientLayout';
import StatusFilterChips from '../components/patient/StatusFilterChips';
import AppointmentHistoryCard from '../components/patient/AppointmentHistoryCard';
import { QueryState } from '../components/StatusMessage';
import { ALL_APPOINTMENTS_FILTER, APPOINTMENT_FILTERS } from '../config/appointments';
import { PATIENT_HISTORY_HREF } from '../config/patientNavigation';
import { getAppointments } from '../services/patientApi';
import './AppointmentHistoryPage.css';

export const PATIENT_APPOINTMENTS_KEY = ['patient', 'appointments'];

function AppointmentHistoryPage() {
  const [filterId, setFilterId] = useState(ALL_APPOINTMENTS_FILTER.id);
  const query = useQuery({ queryKey: PATIENT_APPOINTMENTS_KEY, queryFn: getAppointments });

  return (
    <PatientLayout title="Appointment History" activeHref={PATIENT_HISTORY_HREF}>
      <div className="appointment-history">
        <StatusFilterChips
          filters={APPOINTMENT_FILTERS}
          activeId={filterId}
          onChange={setFilterId}
          label="Filter appointments by status"
        />

        <QueryState query={query} loadingLabel="Loading appointments…">
          {(all) => {
            const appointments =
              filterId === ALL_APPOINTMENTS_FILTER.id ? all : all.filter(({ status }) => status === filterId);

            return appointments.length > 0 ? (
              <ul className="appointment-history-list">
                {appointments.map((appointment) => (
                  <li key={appointment.id}>
                    <AppointmentHistoryCard appointment={appointment} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="appointment-history-empty">No appointments in this category.</p>
            );
          }}
        </QueryState>
      </div>
    </PatientLayout>
  );
}

export default AppointmentHistoryPage;
