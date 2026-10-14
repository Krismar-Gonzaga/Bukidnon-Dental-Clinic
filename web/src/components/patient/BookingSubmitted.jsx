import { forwardRef } from 'react';
import Icon from '../Icon';
import BookingReview from './BookingReview';
import {
  PATIENT_DASHBOARD_HREF,
  PATIENT_HISTORY_HREF,
} from '../../config/patientNavigation';
import './BookingSubmitted.css';

// Confirmation shown after the patient submits a booking request.
// The ref goes to the heading so focus can move there after submit.
const BookingSubmitted = forwardRef(function BookingSubmitted(
  { rows, message, notice },
  headingRef
) {
  return (
    <section className="patient-panel booking-submitted" aria-labelledby="booking-submitted-title">
      <span className="booking-submitted-icon">
        <Icon name="clock" size={40} />
      </span>
      <span className="booking-submitted-badge">Pending</span>
      <h2
        id="booking-submitted-title"
        className="booking-submitted-title"
        ref={headingRef}
        tabIndex={-1}
      >
        Appointment Request Sent!
      </h2>
      <p className="booking-submitted-message">{message}</p>

      <div className="booking-submitted-details">
        <BookingReview rows={rows} notice={notice} />
      </div>

      <div className="booking-submitted-actions">
        <a href={PATIENT_DASHBOARD_HREF} className="btn booking-submitted-secondary">
          Dashboard
        </a>
        <a href={PATIENT_HISTORY_HREF} className="btn btn-primary">
          View Appointments
        </a>
      </div>
    </section>
  );
});

export default BookingSubmitted;
