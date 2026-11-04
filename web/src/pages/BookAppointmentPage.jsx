import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import PatientLayout from '../layouts/PatientLayout';
import BookingStepper from '../components/patient/BookingStepper';
import BookingClinicOption from '../components/patient/BookingClinicOption';
import BookingDentistOption from '../components/patient/BookingDentistOption';
import BookingServiceOption from '../components/patient/BookingServiceOption';
import BookingSchedulePicker from '../components/patient/BookingSchedulePicker';
import BookingReview from '../components/patient/BookingReview';
import BookingSubmitted from '../components/patient/BookingSubmitted';
import { EmptyState, ErrorState, LoadingState } from '../components/StatusMessage';
import {
  BOOKING_APPROVAL_NOTICE,
  BOOKING_ARRIVAL_NOTICE,
  BOOKING_STEPS,
  BOOKING_SUBMITTED_MESSAGE,
} from '../config/booking';
import { PATIENT_BOOK_HREF } from '../config/patientNavigation';
import { useScheduleSelection } from '../hooks/useScheduleSelection';
import { getClinic, searchClinics } from '../services/publicApi';
import { bookAppointment } from '../services/patientApi';
import { getErrorMessage } from '../services/apiErrors';
import { formatLongDate } from '../utils/bookingCalendar';
import '../components/patient/patientPanel.css';
import './BookAppointmentPage.css';

const LAST_STEP_INDEX = BOOKING_STEPS.length - 1;
const SCHEDULE_STEP_INDEX = BOOKING_STEPS.findIndex(({ id }) => id === 'schedule');

const newIdempotencyKey = () =>
  window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// Radio list for the single-choice steps, labelled by the step title.
function OptionGroup({ layout, children }) {
  return (
    <div
      role="radiogroup"
      aria-labelledby="book-step-title"
      className={`book-appointment-options${layout === 'grid' ? ' book-appointment-options--grid' : ''}`}
    >
      {children}
    </div>
  );
}

// ?clinic=<id> (from Find Clinics or a clinic page) preselects a clinic, and
// ?dentist=<id> (from a dentist's profile) that clinic's dentist.
function BookAppointmentPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [stepIndex, setStepIndex] = useState(0);
  const [clinicId, setClinicId] = useState(searchParams.get('clinic'));
  const [dentistId, setDentistId] = useState(searchParams.get('dentist'));
  const [serviceId, setServiceId] = useState(null);
  // One key per booking attempt: a retried submit cannot book twice.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const schedule = useScheduleSelection({ clinicId, serviceRateId: serviceId, dentistId });
  const { selectedDate, time } = schedule;
  const titleRef = useRef(null);
  const hasMounted = useRef(false);

  const clinics = useQuery({
    queryKey: ['clinics', 'bookable'],
    queryFn: () => searchClinics({ perPage: 50, sort: 'name' }),
  });
  const clinic = useQuery({
    queryKey: ['clinic', clinicId],
    queryFn: () => getClinic(clinicId),
    enabled: Boolean(clinicId),
  });

  const booking = useMutation({
    mutationFn: () =>
      bookAppointment(
        {
          clinicId,
          serviceRateId: serviceId,
          dentistId,
          branchId: schedule.selectedSlot.branchId,
          startsAt: schedule.selectedSlot.startsAt,
        },
        idempotencyKey
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patient'] }),
    onError: (error) => {
      // The slot was taken meanwhile: go back to the schedule with fresh times.
      if (error.response?.status === 409) {
        schedule.selectTime(null);
        schedule.refreshSlots();
        setIdempotencyKey(newIdempotencyKey());
        setStepIndex(SCHEDULE_STEP_INDEX);
      }
    },
  });

  // Move focus to the new step's (or confirmation's) title so keyboard and
  // screen reader users land on the changed content.
  useEffect(() => {
    if (hasMounted.current) titleRef.current?.focus();
    hasMounted.current = true;
  }, [stepIndex, booking.isSuccess]);

  const clinicList = clinics.data?.clinics ?? [];
  const selectedClinic = clinic.data;
  const selectedDentist = selectedClinic?.dentists.find(({ id }) => id === dentistId);
  const selectedService = selectedClinic?.services.find(({ id }) => id === serviceId);
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

  // Open dates and slots depend on the dentist and the service's duration.
  const handleDentistSelect = (id) => {
    if (id !== dentistId) schedule.clear();
    setDentistId(id);
  };
  const handleServiceSelect = (id) => {
    if (id !== serviceId) schedule.clear();
    setServiceId(id);
  };

  const clinicDependent = (render) => {
    if (clinic.isPending) return <LoadingState label="Loading clinic…" />;
    if (clinic.isError) return <ErrorState error={clinic.error} onRetry={() => clinic.refetch()} />;
    return render(clinic.data);
  };

  const steps = {
    clinic: {
      isComplete: Boolean(clinicId),
      content: clinics.isPending ? (
        <LoadingState label="Loading clinics…" />
      ) : clinics.isError ? (
        <ErrorState error={clinics.error} onRetry={() => clinics.refetch()} />
      ) : clinicList.length === 0 ? (
        <EmptyState title="No clinics are accepting bookings yet." />
      ) : (
        <OptionGroup>
          {clinicList.map((item) => (
            <BookingClinicOption
              key={item.id}
              clinic={item}
              name="clinic"
              isSelected={item.id === clinicId}
              onSelect={handleClinicSelect}
            />
          ))}
        </OptionGroup>
      ),
    },
    dentist: {
      isComplete: Boolean(dentistId),
      content: clinicDependent((data) =>
        data.dentists.length === 0 ? (
          <EmptyState title="This clinic has no dentists accepting online bookings yet." />
        ) : (
          <OptionGroup>
            {data.dentists.map((dentist) => (
              <BookingDentistOption
                key={dentist.id}
                dentist={dentist}
                name="dentist"
                isSelected={dentist.id === dentistId}
                onSelect={handleDentistSelect}
              />
            ))}
          </OptionGroup>
        )
      ),
    },
    service: {
      isComplete: Boolean(serviceId),
      content: clinicDependent((data) =>
        data.services.length === 0 ? (
          <EmptyState title="This clinic has not published any services yet." />
        ) : (
          <OptionGroup layout="grid">
            {data.services.map((service) => (
              <BookingServiceOption
                key={service.id}
                service={service}
                name="service"
                isSelected={service.id === serviceId}
                onSelect={handleServiceSelect}
              />
            ))}
          </OptionGroup>
        )
      ),
    },
    schedule: {
      isComplete: schedule.isComplete,
      content: schedule.isLoadingDates ? (
        <LoadingState label="Checking the dentist's schedule…" />
      ) : (
        <BookingSchedulePicker
          dates={schedule.dates}
          isDateOpen={schedule.isDateOpen}
          timeSlots={schedule.timeSlots}
          selectedDateKey={schedule.dateKey}
          selectedTime={time}
          onDateSelect={schedule.selectDate}
          onTimeSelect={schedule.selectTime}
          isLoadingSlots={schedule.isLoadingSlots}
          slotsMessage={schedule.slotsError ? getErrorMessage(schedule.slotsError) : ''}
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
    booking.mutate();
  };

  return (
    <PatientLayout title={booking.isSuccess ? 'Booking Submitted' : 'Book Appointment'} activeHref={PATIENT_BOOK_HREF}>
      {booking.isSuccess ? (
        <BookingSubmitted
          ref={titleRef}
          rows={[
            { label: 'Reference', value: `#${booking.data.reference}` },
            { label: 'Clinic', value: booking.data.clinic },
            { label: 'Dentist', value: booking.data.dentist },
            { label: 'Service', value: booking.data.service },
            { label: 'Requested Date', value: booking.data.date },
            { label: 'Requested Time', value: booking.data.time },
          ]}
          message={BOOKING_SUBMITTED_MESSAGE}
          notice={BOOKING_APPROVAL_NOTICE}
        />
      ) : (
        <div className="book-appointment">
          <BookingStepper steps={BOOKING_STEPS} currentIndex={stepIndex} />

          <form className="patient-panel book-appointment-card" onSubmit={handleSubmit}>
            <h2 id="book-step-title" className="book-appointment-title" ref={titleRef} tabIndex={-1}>
              {step.title}
            </h2>

            {booking.isError && (
              <p className="book-appointment-error" role="alert">
                {getErrorMessage(booking.error)}
              </p>
            )}

            {content}

            <div className="book-appointment-footer">
              {stepIndex > 0 && (
                <button
                  type="button"
                  className="btn book-appointment-back"
                  onClick={() => setStepIndex(stepIndex - 1)}
                  disabled={booking.isPending}
                >
                  Back
                </button>
              )}
              <button type="submit" className="btn btn-primary" disabled={!isComplete || booking.isPending}>
                {booking.isPending ? 'Sending request…' : step.nextLabel}
              </button>
            </div>
          </form>
        </div>
      )}
    </PatientLayout>
  );
}

export default BookAppointmentPage;
