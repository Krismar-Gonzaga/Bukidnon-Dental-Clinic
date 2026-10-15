import { fireEvent, screen } from '@testing-library/react';
import FeedbackPage from './FeedbackPage';
import { getReviewableAppointments, submitReview } from '../services/patientApi';
import { getNotifications } from '../services/notificationApi';
import { apiError, PATIENT_USER, renderWithProviders } from '../testUtils';
import { appointment, emptyNotifications } from '../testFixtures';

jest.mock('../services/patientApi');
jest.mock('../services/notificationApi');

beforeEach(() => {
  getNotifications.mockResolvedValue(emptyNotifications);
  getReviewableAppointments.mockResolvedValue([appointment({ status: 'completed' })]);
});

const renderPage = (route = '/patient/reviews') => renderWithProviders(<FeedbackPage />, { user: PATIENT_USER, route });

test('submits a rating and comment for a completed visit', async () => {
  submitReview.mockResolvedValue({ id: '1' });
  renderPage();

  fireEvent.click(await screen.findByRole('radio', { name: /Dental Cleaning/ }));
  const submit = screen.getByRole('button', { name: 'Submit Review' });
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole('radio', { name: /^4 stars/ }));
  fireEvent.change(screen.getByLabelText('Your Review'), { target: { value: '  Gentle and on time.  ' } });
  fireEvent.click(submit);

  expect(await screen.findByRole('button', { name: 'Leave Another Review' })).toBeInTheDocument();
  expect(submitReview).toHaveBeenCalledWith('12', { rating: 4, comment: 'Gentle and on time.' });
});

test('preselects the appointment from ?appointment=', async () => {
  renderPage('/patient/reviews?appointment=12');
  expect(await screen.findByRole('radio', { name: /Dental Cleaning/ })).toBeChecked();
});

test('shows the server message for an already reviewed visit', async () => {
  submitReview.mockRejectedValue(apiError(409, { message: 'You already reviewed this appointment.' }));
  renderPage('/patient/reviews?appointment=12');

  await screen.findByRole('radio', { name: /Dental Cleaning/ });
  fireEvent.click(screen.getByRole('radio', { name: /^5 stars/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit Review' }));

  expect(await screen.findByText('You already reviewed this appointment.')).toBeInTheDocument();
});

test('explains when there is nothing to review', async () => {
  getReviewableAppointments.mockResolvedValue([]);
  renderPage();
  expect(await screen.findByText('No completed appointments to review yet.')).toBeInTheDocument();
});
