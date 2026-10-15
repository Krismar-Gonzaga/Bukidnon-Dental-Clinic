import { useEffect, useRef, useState } from 'react';
import PatientLayout from '../layouts/PatientLayout';
import Icon from '../components/Icon';
import BookingOption from '../components/patient/BookingOption';
import AppointmentStatusBadge from '../components/patient/AppointmentStatusBadge';
import StarRatingInput from '../components/patient/StarRatingInput';
import SuccessCard from '../components/patient/SuccessCard';
import { PATIENT_HISTORY_HREF, PATIENT_REVIEWS_HREF } from '../config/patientNavigation';
import {
  REVIEW_INTRO,
  REVIEW_PLACEHOLDER,
  REVIEW_SUBMITTED_MESSAGE,
  REVIEW_SUBMITTED_TITLE,
} from '../config/reviews';
import { MOCK_APPOINTMENT_HISTORY } from '../mocks/appointmentHistory';
import { MOCK_DASHBOARD_NOTIFICATIONS, MOCK_PATIENT } from '../mocks/patientDashboard';
import '../components/patient/patientPanel.css';
import './FeedbackPage.css';

const COMPLETED_APPOINTMENTS = MOCK_APPOINTMENT_HISTORY.filter(
  ({ status }) => status === 'completed'
);

// ?appointment=<id> preselects a completed appointment (from History or Details).
const getAppointmentFromQuery = () =>
  new URLSearchParams(window.location.search).get('appointment');

// Feedback & Ratings with MOCK completed appointments. Submitting only shows
// the success screen; nothing is sent or saved until the API is wired up.
function FeedbackPage({ initialAppointmentId = getAppointmentFromQuery() }) {
  const startingId = COMPLETED_APPOINTMENTS.some(({ id }) => id === initialAppointmentId)
    ? initialAppointmentId
    : null;
  const [appointmentId, setAppointmentId] = useState(startingId);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const headingRef = useRef(null);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (hasMounted.current) headingRef.current?.focus();
    hasMounted.current = true;
  }, [isSubmitted]);

  const handleSubmit = (event) => {
    event.preventDefault();
    // MOCK submit: replace with the patient feedback API call during integration.
    setIsSubmitted(true);
  };

  const handleLeaveAnother = () => {
    setAppointmentId(null);
    setRating(0);
    setReviewText('');
    setIsSubmitted(false);
  };

  return (
    <PatientLayout
      title="Feedback & Ratings"
      activeHref={PATIENT_REVIEWS_HREF}
      user={MOCK_PATIENT}
      hasUnreadNotifications={MOCK_DASHBOARD_NOTIFICATIONS.some(({ unread }) => unread)}
    >
      <div className="feedback-page">
        <a href={PATIENT_HISTORY_HREF} className="patient-back-link">
          <Icon name="chevronLeft" size={16} />
          Back to History
        </a>
        {isSubmitted ? (
          <SuccessCard
            ref={headingRef}
            title={REVIEW_SUBMITTED_TITLE}
            message={REVIEW_SUBMITTED_MESSAGE}
            action={
              <button type="button" className="btn btn-primary" onClick={handleLeaveAnother}>
                Leave Another Review
              </button>
            }
          />
        ) : (
          <>
            <p className="feedback-intro">{REVIEW_INTRO}</p>
            <form className="patient-panel feedback-card" onSubmit={handleSubmit}>
              <h2
                id="feedback-appointments-title"
                className="feedback-title"
                ref={headingRef}
                tabIndex={-1}
              >
                Select Appointment to Review
              </h2>
              {COMPLETED_APPOINTMENTS.length > 0 ? (
                <div
                  role="radiogroup"
                  aria-labelledby="feedback-appointments-title"
                  className="feedback-appointments"
                >
                  {COMPLETED_APPOINTMENTS.map(({ id, service, clinic, date, status }) => (
                    <BookingOption
                      key={id}
                      name="appointment"
                      value={id}
                      title={service}
                      subtitle={`${clinic} · ${date}`}
                      media={
                        <span className="feedback-appointment-icon">
                          <Icon name="checkCircle" size={20} />
                        </span>
                      }
                      aside={<AppointmentStatusBadge status={status} />}
                      isSelected={id === appointmentId}
                      onSelect={setAppointmentId}
                    />
                  ))}
                </div>
              ) : (
                <p className="feedback-empty">No completed appointments to review yet.</p>
              )}

              <hr className="feedback-divider" />

              <h2 id="feedback-rating-title" className="feedback-title">
                Your Rating
              </h2>
              <StarRatingInput
                value={rating}
                onChange={setRating}
                labelledBy="feedback-rating-title"
              />

              <label htmlFor="feedback-review" className="feedback-review-label">
                Your Review
              </label>
              <textarea
                id="feedback-review"
                className="feedback-review"
                rows={4}
                placeholder={REVIEW_PLACEHOLDER}
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value)}
              />

              <button
                type="submit"
                className="btn btn-primary btn-lg feedback-submit"
                disabled={!appointmentId || rating === 0}
              >
                Submit Review
              </button>
            </form>
          </>
        )}
      </div>
    </PatientLayout>
  );
}

export default FeedbackPage;
