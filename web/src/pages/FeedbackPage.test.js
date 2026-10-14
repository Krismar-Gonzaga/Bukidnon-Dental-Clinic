import { fireEvent, render, screen, within } from '@testing-library/react';
import FeedbackPage from './FeedbackPage';
import { MOCK_APPOINTMENT_HISTORY } from '../mocks/appointmentHistory';

const COMPLETED = MOCK_APPOINTMENT_HISTORY.filter(({ status }) => status === 'completed');

test('lists only completed appointments to review', () => {
  render(<FeedbackPage initialAppointmentId={null} />);
  expect(
    screen.getByRole('heading', { level: 1, name: 'Feedback & Ratings' })
  ).toBeInTheDocument();
  expect(screen.getByText('You can only review completed appointments.')).toBeInTheDocument();

  const group = screen.getByRole('radiogroup', { name: 'Select Appointment to Review' });
  expect(within(group).getAllByRole('radio')).toHaveLength(COMPLETED.length);
  expect(within(group).queryByText('Root Canal Treatment')).not.toBeInTheDocument();
});

test('preselects the appointment passed from history or details', () => {
  render(<FeedbackPage initialAppointmentId="hist-4" />);
  expect(screen.getByRole('radio', { name: /Teeth Whitening/ })).toBeChecked();
});

test('ignores a preselected appointment that is not completed', () => {
  render(<FeedbackPage initialAppointmentId="hist-1" />);
  screen.getAllByRole('radio', { name: /Dental Cleaning|Teeth Whitening/ }).forEach((radio) => {
    expect(radio).not.toBeChecked();
  });
});

test('star rating shows its word and Submit needs an appointment and rating', () => {
  render(<FeedbackPage initialAppointmentId={null} />);
  const submit = screen.getByRole('button', { name: 'Submit Review' });
  expect(submit).toBeDisabled();

  fireEvent.click(screen.getByRole('radio', { name: /Teeth Whitening/ }));
  expect(submit).toBeDisabled();

  const stars = screen.getByRole('radiogroup', { name: 'Your Rating' });
  fireEvent.click(within(stars).getByRole('radio', { name: '4 stars, Very Good' }));
  expect(screen.getByText('Very Good')).toBeInTheDocument();
  expect(submit).toBeEnabled();

  expect(screen.getByLabelText('Your Review')).toHaveAttribute(
    'placeholder',
    'Share your experience with this clinic...'
  );
});

test('submitting shows the success screen; Leave Another Review resets the form', () => {
  render(<FeedbackPage initialAppointmentId="hist-3" />);
  fireEvent.click(screen.getByRole('radio', { name: '5 stars, Excellent' }));
  fireEvent.change(screen.getByLabelText('Your Review'), {
    target: { value: 'Gentle and quick.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Submit Review' }));

  expect(screen.getByRole('heading', { level: 2, name: 'Review Submitted!' })).toHaveFocus();

  fireEvent.click(screen.getByRole('button', { name: 'Leave Another Review' }));
  expect(
    screen.getByRole('heading', { level: 2, name: 'Select Appointment to Review' })
  ).toHaveFocus();
  expect(screen.getByLabelText('Your Review')).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Submit Review' })).toBeDisabled();
});

test('Back to History link shows on the form and after submitting', () => {
  render(<FeedbackPage initialAppointmentId="hist-3" />);
  expect(screen.getByRole('link', { name: 'Back to History' })).toHaveAttribute(
    'href',
    '/patient/appointments'
  );
  fireEvent.click(screen.getByRole('radio', { name: '4 stars, Very Good' }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit Review' }));
  expect(screen.getByRole('link', { name: 'Back to History' })).toBeInTheDocument();
});
