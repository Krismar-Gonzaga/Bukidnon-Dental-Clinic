import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import PatientLayout from '../layouts/PatientLayout';
import Icon from '../components/Icon';
import BookingOption from '../components/patient/BookingOption';
import AppointmentStatusBadge from '../components/patient/AppointmentStatusBadge';
import StarRatingInput from '../components/patient/StarRatingInput';
import SuccessCard from '../components/patient/SuccessCard';
import { QueryState } from '../components/StatusMessage';
import { PATIENT_REVIEWS_HREF } from '../config/patientNavigation';
import {
  REVIEW_INTRO,
  REVIEW_PLACEHOLDER,
  REVIEW_SUBMITTED_MESSAGE,
  REVIEW_SUBMITTED_TITLE,
} from '../config/reviews';
import { getReviewableAppointments, submitReview } from '../services/patientApi';
import { getErrorMessage } from '../services/apiErrors';
import '../components/patient/patientPanel.css';
import './FeedbackPage.css';

const REVIEWABLE_KEY = ['patient', 'reviews', 'eligible'];

// Only completed appointments without a review are listed; the server also
// checks eligibility. ?appointment=<id> preselects one.
function FeedbackPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: REVIEWABLE_KEY, queryFn: getReviewableAppointments });
  const [appointmentId, setAppointmentId] = useState(searchParams.get('appointment'));
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const headingRef = useRef(null);
  const hasMounted = useRef(false);

  const review = useMutation({
    mutationFn: () => submitReview(appointmentId, { rating, comment: reviewText.trim() }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['patient'] }),
  });

  useEffect(() => {
    if (hasMounted.current) headingRef.current?.focus();
    hasMounted.current = true;
  }, [review.isSuccess]);

  const handleLeaveAnother = () => {
    setAppointmentId(null);
    setRating(0);
    setReviewText('');
    review.reset();
  };

  return (
    <PatientLayout title="Feedback & Ratings" activeHref={PATIENT_REVIEWS_HREF}>
      <div className="feedback-page">
        {review.isSuccess ? (
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
            <form
              className="patient-panel feedback-card"
              onSubmit={(event) => {
                event.preventDefault();
                review.mutate();
              }}
            >
              <h2 id="feedback-appointments-title" className="feedback-title" ref={headingRef} tabIndex={-1}>
                Select Appointment to Review
              </h2>
              <QueryState query={query} loadingLabel="Loading your completed visits…">
                {(appointments) =>
                  appointments.length > 0 ? (
                    <div role="radiogroup" aria-labelledby="feedback-appointments-title" className="feedback-appointments">
                      {appointments.map(({ id, service, clinic, date, status }) => (
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
                  )
                }
              </QueryState>

              <hr className="feedback-divider" />

              <h2 id="feedback-rating-title" className="feedback-title">
                Your Rating
              </h2>
              <StarRatingInput value={rating} onChange={setRating} labelledBy="feedback-rating-title" />

              <label htmlFor="feedback-review" className="feedback-review-label">
                Your Review
              </label>
              <textarea
                id="feedback-review"
                className="feedback-review"
                rows={4}
                maxLength={2000}
                placeholder={REVIEW_PLACEHOLDER}
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value)}
              />

              {review.isError && (
                <p className="feedback-error" role="alert">
                  {getErrorMessage(review.error)}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-lg feedback-submit"
                disabled={
                  !appointmentId ||
                  rating === 0 ||
                  review.isPending ||
                  !query.data?.some(({ id }) => id === appointmentId)
                }
              >
                {review.isPending ? 'Submitting…' : 'Submit Review'}
              </button>
            </form>
          </>
        )}
      </div>
    </PatientLayout>
  );
}

export default FeedbackPage;
