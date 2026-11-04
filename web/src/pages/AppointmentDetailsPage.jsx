import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import PatientLayout from '../layouts/PatientLayout';
import Icon from '../components/Icon';
import ConfirmDialog from '../components/ConfirmDialog';
import AppointmentDetailsCard from '../components/patient/AppointmentDetailsCard';
import { QueryState } from '../components/StatusMessage';
import {
  getCancelAppointmentMessage,
  PENDING_APPROVAL_TEXT,
  PENDING_APPROVAL_TITLE,
} from '../config/appointments';
import {
  getRescheduleHref,
  getReviewHref,
  PATIENT_HISTORY_HREF,
} from '../config/patientNavigation';
import { cancelAppointment, getAppointment } from '../services/patientApi';
import { getErrorMessage } from '../services/apiErrors';
import '../components/patient/patientPanel.css';
import './AppointmentDetailsPage.css';

// Backend statuses in which the patient may still change the appointment
// online (the server also enforces a cut-off before the start time).
const CANCELLABLE = ['pending', 'confirmed', 'reschedule_requested'];
const RESCHEDULABLE = ['pending', 'confirmed'];

const STATUS_NOTICES = {
  reschedule_requested: (a) => ({
    title: 'Reschedule requested',
    text: `You asked to move this appointment to ${a.requestedDateTime}. The clinic will confirm the new time; until then your original time is kept.`,
  }),
  rejected: (a) => ({
    title: 'Request declined',
    text: a.cancellationReason || 'The clinic could not accept this request.',
  }),
  cancelled: (a) => ({ title: 'Appointment cancelled', text: a.cancellationReason || '' }),
  no_show: () => ({ title: 'Marked as missed', text: 'Contact the clinic if this is a mistake.' }),
  checked_in: () => ({ title: 'You are checked in', text: 'Please wait to be called.' }),
};

function AppointmentDetailsPage({ appointmentId }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['patient', 'appointment', appointmentId],
    queryFn: () => getAppointment(appointmentId),
  });
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const cardRef = useRef(null);
  const backendStatus = query.data?.backendStatus;
  const previousStatus = useRef(backendStatus);

  const cancel = useMutation({
    mutationFn: () => cancelAppointment(appointmentId),
    onSuccess: () => {
      setIsConfirmingCancel(false);
      queryClient.invalidateQueries({ queryKey: ['patient'] });
    },
    onError: () => setIsConfirmingCancel(false),
  });

  // After a status change (e.g. cancelled), the Cancel button is gone, so
  // move focus to the card heading instead of losing it.
  useEffect(() => {
    if (previousStatus.current && previousStatus.current !== backendStatus) {
      cardRef.current?.querySelector('h2')?.focus();
    }
    previousStatus.current = backendStatus;
  }, [backendStatus]);

  return (
    <PatientLayout title="Appointment Details" activeHref={PATIENT_HISTORY_HREF}>
      <div className="appointment-details-page" ref={cardRef}>
        <a href={PATIENT_HISTORY_HREF} className="patient-back-link">
          <Icon name="chevronLeft" size={16} />
          Back to History
        </a>

        <QueryState query={query} loadingLabel="Loading appointment…">
          {(appointment) => {
            const status = appointment.backendStatus;
            const isPending = status === 'pending';
            const canCancel = CANCELLABLE.includes(status);
            const canReschedule = RESCHEDULABLE.includes(status);
            const canReview = status === 'completed' && !appointment.hasReview;
            const notice = STATUS_NOTICES[status]?.(appointment);

            return (
              <AppointmentDetailsCard appointment={appointment}>
                {isPending && (
                  <div className="appointment-details-notice">
                    <Icon name="clock" size={18} />
                    <div>
                      <p className="appointment-details-notice-title">{PENDING_APPROVAL_TITLE}</p>
                      <p className="appointment-details-notice-text">{PENDING_APPROVAL_TEXT}</p>
                    </div>
                  </div>
                )}
                {notice && (
                  <div className="appointment-details-notice">
                    <Icon name="info" size={18} />
                    <div>
                      <p className="appointment-details-notice-title">{notice.title}</p>
                      {notice.text && <p className="appointment-details-notice-text">{notice.text}</p>}
                    </div>
                  </div>
                )}
                {cancel.isError && (
                  <p className="appointment-details-error" role="alert">
                    {getErrorMessage(cancel.error)}
                  </p>
                )}
                {canReview && (
                  <div className="appointment-details-actions">
                    <a href={getReviewHref(appointment.id)} className="btn btn-primary">
                      Leave a Review
                    </a>
                  </div>
                )}
                {(canReschedule || canCancel) && (
                  <div className="appointment-details-actions">
                    {canReschedule && (
                      <a href={getRescheduleHref(appointment.id)} className="btn appointment-details-reschedule">
                        Reschedule
                      </a>
                    )}
                    {canCancel && (
                      <button
                        type="button"
                        className="btn appointment-details-cancel"
                        onClick={() => setIsConfirmingCancel(true)}
                        disabled={cancel.isPending}
                      >
                        {isPending ? 'Cancel Request' : 'Cancel Appointment'}
                      </button>
                    )}
                  </div>
                )}
              </AppointmentDetailsCard>
            );
          }}
        </QueryState>
      </div>

      {isConfirmingCancel && query.data && (
        <ConfirmDialog
          title="Cancel Appointment?"
          message={getCancelAppointmentMessage(query.data.dentist)}
          cancelLabel="Keep Appointment"
          confirmLabel={cancel.isPending ? 'Cancelling…' : 'Yes, Cancel'}
          onCancel={() => setIsConfirmingCancel(false)}
          onConfirm={() => cancel.mutate()}
        />
      )}
    </PatientLayout>
  );
}

export default AppointmentDetailsPage;
