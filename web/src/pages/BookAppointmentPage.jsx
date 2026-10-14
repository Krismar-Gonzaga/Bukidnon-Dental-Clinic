import { useEffect, useRef, useState } from 'react';
import PatientLayout from '../layouts/PatientLayout';
import BookingStepper from '../components/patient/BookingStepper';
import BookingClinicOption from '../components/patient/BookingClinicOption';
import BookingDentistOption from '../components/patient/BookingDentistOption';
import BookingServiceOption from '../components/patient/BookingServiceOption';
import BookingSchedulePicker from '../components/patient/BookingSchedulePicker';
import BookingReview from '../components/patient/BookingReview';
import BookingSubmitted from '../components/patient/BookingSubmitted';
import {
  BOOKING_APPROVAL_NOTICE,
  BOOKING_ARRIVAL_NOTICE,
  BOOKING_STEPS,
  BOOKING_SUBMITTED_MESSAGE,
} from '../config/booking';
import { PATIENT_BOOK_HREF } from '../config/patientNavigation';
import { BOOKING_CLINICS } from '../mocks/bookingClinics';
import { BOOKING_DENTISTS } from '../mocks/bookingDentists';
import { SERVICES } from '../mocks/services';
import { useScheduleSelection } from '../hooks/useScheduleSelection';
import { formatLongDate } from '../utils/bookingCalendar';
import { MOCK_DASHBOARD_NOTIFICATIONS, MOCK_PATIENT } from '../mocks/patientDashboard';
import '../components/patient/patientPanel.css';
import './BookAppointmentPage.css';

const LAST_STEP_INDEX = BOOKING_STEPS.length - 1;

// Radio list for the single-choice steps, labelled by the step title.
function OptionGroup({ layout, children }) {
  return (
    <div
      role="radiogroup"
      aria-labelledby="book-step-title"
      className={`book-appointment-options${
        layout === 'grid' ? ' book-appointment-options--grid' : ''
      }`}
    >
      {children}
    </div>
  );
}

// Booking flow with MOCK clinics, dentists, services, and schedule;
// nothing is saved yet. ?clinic=<id> (from Find Clinics) preselects a clinic
// when it is one of the bookable clinics.
const getClinicFromQuery = () => new URLSearchParams(window.location.search).get('clinic');

function BookAppointmentPage({ initialClinicId = getClinicFromQuery() }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [clinicId, setClinicId] = useState(() =>
    BOOKING_CLINICS.some(({ id }) => id === initialClinicId) ? initialClinicId : null
  );
  const [dentistId, setDentistId] = useState(null);
  const [serviceId, setServiceId] = useState(null);
  const schedule = useScheduleSelection();
  const { selectedDate, time } = schedule;
  const [isSubmitted, setIsSubmitted] = useState(false);
  const titleRef = useRef(null);
  const hasMounted = useRef(false);
  const selectedClinic = BOOKING_CLINICS.find(({ id }) => id === clinicId);
  const selectedDentist = BOOKING_DENTISTS.find(({ id }) => id === dentistId);
  const selectedService = SERVICES.find(({ id }) => id === serviceId);

  // Move focus to the new step's (or confirmation's) title so keyboard and
  // screen reader users land on the changed content.
  useEffect(() => {
    if (hasMounted.current) titleRef.current?.focus();
    hasMounted.current = true;
  }, [stepIndex, isSubmitted]);

  const step = BOOKING_STEPS[stepIndex];

  // Dentists and services belong to a clinic, so a new clinic clears them.
  const handleClinicSelect = (id) => {
    if (id !== clinicId) {
      setDentistId(null);
      setServiceId(null);
      schedule.clear();
    }
    setClinicId(id);
  };

  // Open dates and slots depend on the dentist.
  const handleDentistSelect = (id) => {
    if (id !== dentistId) schedule.clear();
    setDentistId(id);
  };

  const steps = {
    clinic: {
      isComplete: Boolean(clinicId),
      content: (
        <OptionGroup>
          {BOOKING_CLINICS.map((clinic) => (
            <BookingClinicOption
              key={clinic.id}
              clinic={clinic}
              name="clinic"
              isSelected={clinic.id === clinicId}
              onSelect={handleClinicSelect}
            />
          ))}
        </OptionGroup>
      ),
    },
    dentist: {
      isComplete: Boolean(dentistId),
      content: (
        <OptionGroup>
          {BOOKING_DENTISTS.map((dentist) => (
            <BookingDentistOption
              key={dentist.id}
              dentist={dentist}
              name="dentist"
              isSelected={dentist.id === dentistId}
              onSelect={handleDentistSelect}
            />
          ))}
        </OptionGroup>
      ),
    },
    service: {
      isComplete: Boolean(serviceId),
      content: (
        <OptionGroup layout="grid">
          {SERVICES.map((service) => (
            <BookingServiceOption
              key={service.id}
              service={service}
              name="service"
              isSelected={service.id === serviceId}
              onSelect={setServiceId}
            />
          ))}
        </OptionGroup>
      ),
    },
    schedule: {
      isComplete: schedule.isComplete,
      content: (
        <BookingSchedulePicker
          dates={schedule.dates}
          timeSlots={schedule.timeSlots}
          selectedDateKey={schedule.dateKey}
          selectedTime={time}
          onDateSelect={schedule.selectDate}
          onTimeSelect={schedule.selectTime}
        />
      ),
    },
    confirm: {
      isComplete: true,
      content: (
        <BookingReview
          rows={[
            { label: 'Clinic', value: selectedClinic?.name },
            { label: 'Dentist', value: selectedDentist?.name },
            { label: 'Service', value: selectedService?.name },
            { label: 'Date', value: selectedDate && formatLongDate(selectedDate) },
            { label: 'Time', value: time },
            { label: 'Estimated Cost', value: selectedService?.priceLabel },
          ]}
          notice={BOOKING_ARRIVAL_NOTICE}
        />
      ),
    },
  };
  const { isComplete, content } = steps[step.id];

  const handleSubmit = (event) => {
    event.preventDefault();
    if (stepIndex < LAST_STEP_INDEX) {
      setStepIndex(stepIndex + 1);
      return;
    }
    // MOCK submit: no booking endpoint is wired up yet, so nothing is sent
    // or saved. Replace with the appointments API call during integration.
    setIsSubmitted(true);
  };

  return (
    <PatientLayout
      title={isSubmitted ? 'Booking Submitted' : 'Book Appointment'}
      activeHref={PATIENT_BOOK_HREF}
      user={MOCK_PATIENT}
      hasUnreadNotifications={MOCK_DASHBOARD_NOTIFICATIONS.some(({ unread }) => unread)}
    >
      {isSubmitted ? (
        <BookingSubmitted
          ref={titleRef}
          rows={[
            { label: 'Clinic', value: selectedClinic?.name },
            { label: 'Dentist', value: selectedDentist?.name },
            { label: 'Service', value: selectedService?.name },
            { label: 'Requested Date', value: selectedDate && formatLongDate(selectedDate) },
            { label: 'Requested Time', value: time },
          ]}
          message={BOOKING_SUBMITTED_MESSAGE}
          notice={BOOKING_APPROVAL_NOTICE}
        />
      ) : (
        <div className="book-appointment">
          <BookingStepper steps={BOOKING_STEPS} currentIndex={stepIndex} />

          <form className="patient-panel book-appointment-card" onSubmit={handleSubmit}>
            <h2
              id="book-step-title"
              className="book-appointment-title"
              ref={titleRef}
              tabIndex={-1}
            >
              {step.title}
            </h2>

            {content}

            <div className="book-appointment-footer">
              {stepIndex > 0 && (
                <button
                  type="button"
                  className="btn book-appointment-back"
                  onClick={() => setStepIndex(stepIndex - 1)}
                >
                  Back
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={!isComplete}>
                {step.nextLabel}
              </button>
            </div>
          </form>
        </div>
      )}
    </PatientLayout>
  );
}

export default BookAppointmentPage;
