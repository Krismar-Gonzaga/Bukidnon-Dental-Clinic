import { useEffect, useRef, useState } from 'react';
import PatientLayout from '../layouts/PatientLayout';
import Icon from '../components/Icon';
import ConfirmDialog from '../components/ConfirmDialog';
import AppointmentDetailsCard from '../components/patient/AppointmentDetailsCard';
import {
  CANCELLABLE_STATUSES,
  getCancelAppointmentMessage,
  PENDING_APPROVAL_TEXT,
  PENDING_APPROVAL_TITLE,
  RESCHEDULABLE_STATUSES,
} from '../config/appointments';
import {
  getRescheduleHref,
  getReviewHref,
  PATIENT_HISTORY_HREF,
} from '../config/patientNavigation';
import { findMockAppointment } from '../mocks/appointmentHistory';
import { MOCK_DASHBOARD_NOTIFICATIONS, MOCK_PATIENT } from '../mocks/patientDashboard';
import '../components/patient/patientPanel.css';
import './AppointmentDetailsPage.css';

// Appointment details with MOCK data. Cancelling only changes the status on
// this page; nothing is sent or saved until the appointments API is wired up.
function AppointmentDetailsPage({ appointmentId }) {
  const [appointment, setAppointment] = useState(() =>
    findMockAppointment(appointmentId)
  );
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const cardRef = useRef(null);
  const status = appointment?.status;
  const previousStatus = useRef(status);
  const isPending = status === 'pending';
  const canCancel = CANCELLABLE_STATUSES.includes(status);
  const canReschedule = RESCHEDULABLE_STATUSES.includes(status);
  const canReview = status === 'completed';

  // After a status change (e.g. cancelled), the Cancel button is gone, so
  // move focus to the card heading instead of losing it.
  useEffect(() => {
    if (previousStatus.current !== status) {
      cardRef.current?.querySelector('h2')?.focus();
      previousStatus.current = status;
    }
  }, [status]);

  const handleConfirmCancel = () => {
    setAppointment((current) => ({ ...current, status: 'cancelled' }));
    setIsConfirmingCancel(false);
  };

  return (
    <PatientLayout
      title="Appointment Details"
      activeHref={PATIENT_HISTORY_HREF}
      user={MOCK_PATIENT}
      hasUnreadNotifications={MOCK_DASHBOARD_NOTIFICATIONS.some(({ unread }) => unread)}
    >
      <div className="appointment-details-page" ref={cardRef}>
        <a href={PATIENT_HISTORY_HREF} className="patient-back-link">
          <Icon name="chevronLeft" size={16} />
          Back to History
        </a>

        {appointment ? (
          <AppointmentDetailsCard appointment={appointment}>
            {isPending && (
              <div className="appointment-details-notice">
                <Icon name="clock" size={18} />
                <div>
                  <p className="appointment-details-notice-title">
                    {PENDING_APPROVAL_TITLE}
                  </p>
                  <p className="appointment-details-notice-text">
                    {PENDING_APPROVAL_TEXT}
                  </p>
                </div>
              </div>
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
                  <a
                    href={getRescheduleHref(appointment.id)}
                    className="btn appointment-details-reschedule"
                  >
                    Reschedule
                  </a>
                )}
                {canCancel && (
                  <button
                    type="button"
                    className="btn appointment-details-cancel"
                    onClick={() => setIsConfirmingCancel(true)}
                  >
                    {isPending ? 'Cancel Request' : 'Cancel Appointment'}
                  </button>
                )}
              </div>
            )}
          </AppointmentDetailsCard>
        ) : (
          <p className="patient-panel appointment-details-missing">
            This appointment could not be found.
          </p>
        )}
      </div>

      {isConfirmingCancel && (
        <ConfirmDialog
          title="Cancel Appointment?"
          message={getCancelAppointmentMessage(appointment.dentist)}
          cancelLabel="Keep Appointment"
          confirmLabel="Yes, Cancel"
          onCancel={() => setIsConfirmingCancel(false)}
          onConfirm={handleConfirmCancel}
        />
      )}
    </PatientLayout>
  );
}

export default AppointmentDetailsPage;
