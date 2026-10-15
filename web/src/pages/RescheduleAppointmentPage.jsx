import { useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PatientLayout from '../layouts/PatientLayout';
import Icon from '../components/Icon';
import BookingSchedulePicker from '../components/patient/BookingSchedulePicker';
import SuccessCard from '../components/patient/SuccessCard';
import { QueryState } from '../components/StatusMessage';
import { RESCHEDULED_TITLE } from '../config/appointments';
import {
  getAppointmentDetailsHref,
  PATIENT_HISTORY_HREF,
} from '../config/patientNavigation';
import { useScheduleSelection } from '../hooks/useScheduleSelection';
import { getAppointment, rescheduleAppointment } from '../services/patientApi';
import { getErrorMessage } from '../services/apiErrors';
import '../components/patient/patientPanel.css';
import './RescheduleAppointmentPage.css';

const RESCHEDULABLE = ['pending', 'confirmed'];

/**
 * A pending request moves straight to the new time. A confirmed appointment
 * sends a reschedule request; the clinic confirms the new time and the
 * original slot is kept until then.
 */
function RescheduleForm({ appointment }) {
  const queryClient = useQueryClient();
  const schedule = useScheduleSelection({
    clinicId: appointment.clinicId,
    serviceRateId: appointment.serviceRateId,
    dentistId: appointment.dentistId,
  });
  const successRef = useRef(null);
  const detailsHref = getAppointmentDetailsHref(appointment.id);

  const reschedule = useMutation({
    mutationFn: () => rescheduleAppointment(appointment.id, schedule.selectedSlot.startsAt),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patient'] }),
    onError: () => schedule.refreshSlots(),
  });

  useEffect(() => {
    if (reschedule.isSuccess) successRef.current?.focus();
  }, [reschedule.isSuccess]);

  if (reschedule.isSuccess) {
    const isRequest = reschedule.data.appointment.backendStatus === 'reschedule_requested';
    return (
      <SuccessCard
        ref={successRef}
        title={isRequest ? 'Reschedule Requested' : RESCHEDULED_TITLE}
        message={
          isRequest
            ? `The clinic will confirm your new time (${reschedule.data.appointment.requestedDateTime}). Your original appointment is kept until then.`
            : `Your request is now for ${reschedule.data.appointment.dateTime}. The clinic will review it.`
        }
        action={
          <a href={PATIENT_HISTORY_HREF} className="btn btn-primary">
            View All Appointments
          </a>
        }
      />
    );
  }

  return (
    <form
      className="patient-panel reschedule-card"
      onSubmit={(event) => {
        event.preventDefault();
        reschedule.mutate();
      }}
    >
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
        isDateOpen={schedule.isDateOpen}
        timeSlots={schedule.timeSlots}
        selectedDateKey={schedule.dateKey}
        selectedTime={schedule.time}
        onDateSelect={schedule.selectDate}
        onTimeSelect={schedule.selectTime}
        isLoadingSlots={schedule.isLoadingSlots}
        slotsMessage={schedule.slotsError ? getErrorMessage(schedule.slotsError) : ''}
        dateLabelPrefix="Select New Date"
        timeLabel="Select New Time"
      />

      {reschedule.isError && (
        <p className="reschedule-error" role="alert">
          {getErrorMessage(reschedule.error)}
        </p>
      )}

      <div className="reschedule-actions">
        <a href={detailsHref} className="btn reschedule-cancel">
          Cancel
        </a>
        <button type="submit" className="btn btn-primary" disabled={!schedule.isComplete || reschedule.isPending}>
          {reschedule.isPending ? 'Saving…' : 'Confirm Reschedule'}
        </button>
      </div>
    </form>
  );
}

function RescheduleAppointmentPage({ appointmentId }) {
  const query = useQuery({
    queryKey: ['patient', 'appointment', appointmentId],
    queryFn: () => getAppointment(appointmentId),
  });

  return (
    <PatientLayout title="Reschedule Appointment" activeHref={PATIENT_HISTORY_HREF}>
      <div className="reschedule-page">
        <a href={getAppointmentDetailsHref(appointmentId)} className="patient-back-link">
          <Icon name="chevronLeft" size={16} />
          Back to Appointment
        </a>
        <QueryState query={query} loadingLabel="Loading appointment…">
          {(appointment) =>
            RESCHEDULABLE.includes(appointment.backendStatus) && appointment.serviceRateId && appointment.dentistId ? (
              <RescheduleForm appointment={appointment} />
            ) : (
              <p className="patient-panel reschedule-missing">This appointment cannot be rescheduled online.</p>
            )
          }
        </QueryState>
      </div>
    </PatientLayout>
  );
}

export default RescheduleAppointmentPage;
