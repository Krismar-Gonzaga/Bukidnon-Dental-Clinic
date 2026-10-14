import { useEffect, useRef, useState } from 'react';
import PatientLayout from '../layouts/PatientLayout';
import Icon from '../components/Icon';
import BookingSchedulePicker from '../components/patient/BookingSchedulePicker';
import SuccessCard from '../components/patient/SuccessCard';
import {
  RESCHEDULABLE_STATUSES,
  RESCHEDULED_MESSAGE,
  RESCHEDULED_TITLE,
} from '../config/appointments';
import {
  getAppointmentDetailsHref,
  PATIENT_HISTORY_HREF,
} from '../config/patientNavigation';
import { useScheduleSelection } from '../hooks/useScheduleSelection';
import { findMockAppointment } from '../mocks/appointmentHistory';
import { MOCK_DASHBOARD_NOTIFICATIONS, MOCK_PATIENT } from '../mocks/patientDashboard';
import '../components/patient/patientPanel.css';
import './RescheduleAppointmentPage.css';

// Reschedule an upcoming appointment with MOCK data. Confirming only shows
// the success screen; nothing is sent or saved until the API is wired up.
function RescheduleAppointmentPage({ appointmentId }) {
  const appointment = findMockAppointment(appointmentId);
  const canReschedule = RESCHEDULABLE_STATUSES.includes(appointment?.status);
  const schedule = useScheduleSelection();
  const [isRescheduled, setIsRescheduled] = useState(false);
  const successRef = useRef(null);
  const detailsHref = getAppointmentDetailsHref(appointmentId);

  useEffect(() => {
    if (isRescheduled) successRef.current?.focus();
  }, [isRescheduled]);

  const handleSubmit = (event) => {
    event.preventDefault();
    // MOCK reschedule: replace with the appointments API call during integration.
    setIsRescheduled(true);
  };

  const renderContent = () => {
    if (!canReschedule) {
      return (
        <p className="patient-panel reschedule-missing">
          This appointment cannot be rescheduled.
        </p>
      );
    }

    if (isRescheduled) {
      return (
        <SuccessCard
          ref={successRef}
          title={RESCHEDULED_TITLE}
          message={RESCHEDULED_MESSAGE}
          action={
            <a href={PATIENT_HISTORY_HREF} className="btn btn-primary">
              View All Appointments
            </a>
          }
        />
      );
    }

    return (
      <form className="patient-panel reschedule-card" onSubmit={handleSubmit}>
        <h2 className="reschedule-title">Reschedule Appointment</h2>
        <p className="reschedule-current">
          <Icon name="alertCircle" size={18} />
          <span>
            Current appointment:{' '}
            <strong>
              {appointment.date} at {appointment.time}
            </strong>{' '}
            with {appointment.dentist}
          </span>
        </p>

        <BookingSchedulePicker
          dates={schedule.dates}
          timeSlots={schedule.timeSlots}
          selectedDateKey={schedule.dateKey}
          selectedTime={schedule.time}
          onDateSelect={schedule.selectDate}
          onTimeSelect={schedule.selectTime}
          dateLabelPrefix="Select New Date"
          timeLabel="Select New Time"
        />

        <div className="reschedule-actions">
          <a href={detailsHref} className="btn reschedule-cancel">
            Cancel
          </a>
          <button type="submit" className="btn btn-primary" disabled={!schedule.isComplete}>
            Confirm Reschedule
          </button>
        </div>
      </form>
    );
  };

  return (
    <PatientLayout
      title="Reschedule Appointment"
      activeHref={PATIENT_HISTORY_HREF}
      user={MOCK_PATIENT}
      hasUnreadNotifications={MOCK_DASHBOARD_NOTIFICATIONS.some(({ unread }) => unread)}
    >
      <div className="reschedule-page">
        <a href={detailsHref} className="patient-back-link">
          <Icon name="chevronLeft" size={16} />
          Back to Appointment
        </a>
        {renderContent()}
      </div>
    </PatientLayout>
  );
}

export default RescheduleAppointmentPage;
