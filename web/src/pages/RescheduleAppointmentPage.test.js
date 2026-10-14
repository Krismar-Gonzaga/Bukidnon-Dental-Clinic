import { fireEvent, render, screen } from '@testing-library/react';
import RescheduleAppointmentPage from './RescheduleAppointmentPage';

const UPCOMING_ID = 'hist-2';
// Pin today so the calendar shows July 20-31, 2026.
const TODAY = new Date(2026, 6, 20, 9);

beforeEach(() => jest.useFakeTimers().setSystemTime(TODAY));
afterEach(() => jest.useRealTimers());

test('shows the current appointment and the new date and time pickers', () => {
  render(<RescheduleAppointmentPage appointmentId={UPCOMING_ID} />);

  expect(
    screen.getByRole('heading', { level: 1, name: 'Reschedule Appointment' })
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to Appointment' })).toHaveAttribute(
    'href',
    '/patient/appointments/hist-2'
  );
  expect(screen.getByText(/Current appointment:/)).toHaveTextContent(
    'Current appointment: July 22, 2026 at 10:00 AM with Dr. Maria Braganza'
  );
  expect(
    screen.getByRole('radiogroup', { name: 'Select New Date — July 2026' })
  ).toBeInTheDocument();
  expect(screen.getByRole('radiogroup', { name: 'Select New Time' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
    'href',
    '/patient/appointments/hist-2'
  );
});

test('Confirm Reschedule needs a date and time, then shows the success screen', () => {
  render(<RescheduleAppointmentPage appointmentId={UPCOMING_ID} />);
  const confirm = screen.getByRole('button', { name: 'Confirm Reschedule' });
  expect(confirm).toBeDisabled();

  fireEvent.click(screen.getByRole('radio', { name: 'Tuesday, July 28, 2026' }));
  fireEvent.click(screen.getByRole('radio', { name: '10:00 AM' }));
  expect(confirm).toBeEnabled();
  fireEvent.click(confirm);

  expect(
    screen.getByRole('heading', { level: 2, name: 'Appointment Rescheduled!' })
  ).toHaveFocus();
  expect(screen.getByRole('link', { name: 'View All Appointments' })).toHaveAttribute(
    'href',
    '/patient/appointments'
  );
});

test('appointments that are not upcoming cannot be rescheduled', () => {
  render(<RescheduleAppointmentPage appointmentId="hist-1" />);
  expect(screen.getByText('This appointment cannot be rescheduled.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Confirm Reschedule' })).not.toBeInTheDocument();
});
