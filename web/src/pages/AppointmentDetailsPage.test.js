import { fireEvent, render, screen, within } from '@testing-library/react';
import AppointmentDetailsPage from './AppointmentDetailsPage';

const PENDING_ID = 'hist-1';
const UPCOMING_ID = 'hist-2';

test('shows the pending appointment details, notice, and back link', () => {
  render(<AppointmentDetailsPage appointmentId={PENDING_ID} />);

  expect(
    screen.getByRole('heading', { level: 1, name: 'Appointment Details' })
  ).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to History' })).toHaveAttribute(
    'href',
    '/patient/appointments'
  );

  const card = screen.getByRole('region', { name: 'Root Canal Treatment' });
  expect(card).toHaveTextContent('Appointment #000006');
  expect(card).toHaveTextContent('Pending');
  expect(card).toHaveTextContent('Don Carlos Dental Clinic');
  expect(card).toHaveTextContent('Dr. Laura Reyes');
  expect(card).toHaveTextContent('July 25, 2026');
  expect(card).toHaveTextContent('9:00 AM');
  expect(card).toHaveTextContent('Awaiting Clinic Approval');
  expect(within(card).getByRole('button', { name: 'Cancel Request' })).toBeInTheDocument();
});

test('Keep Appointment closes the dialog and returns focus', () => {
  render(<AppointmentDetailsPage appointmentId={PENDING_ID} />);
  const cancelRequest = screen.getByRole('button', { name: 'Cancel Request' });
  cancelRequest.focus();
  fireEvent.click(cancelRequest);

  const dialog = screen.getByRole('alertdialog', { name: 'Cancel Appointment?' });
  expect(dialog).toHaveTextContent(
    'Are you sure you want to cancel your appointment with Dr. Laura Reyes?'
  );
  expect(within(dialog).getByRole('button', { name: 'Keep Appointment' })).toHaveFocus();

  fireEvent.click(within(dialog).getByRole('button', { name: 'Keep Appointment' }));
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(cancelRequest).toHaveFocus();
  expect(screen.getByText('Pending')).toBeInTheDocument();
});

test('Escape closes the dialog without cancelling', () => {
  render(<AppointmentDetailsPage appointmentId={PENDING_ID} />);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel Request' }));
  fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByText('Pending')).toBeInTheDocument();
});

test('Yes, Cancel marks the appointment cancelled and removes pending actions', () => {
  render(<AppointmentDetailsPage appointmentId={PENDING_ID} />);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel Request' }));
  fireEvent.click(screen.getByRole('button', { name: 'Yes, Cancel' }));

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByText('Cancelled')).toBeInTheDocument();
  expect(screen.queryByText('Awaiting Clinic Approval')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Cancel Request' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2, name: 'Root Canal Treatment' })).toHaveFocus();
});

test('upcoming appointments offer Reschedule and Cancel Appointment', () => {
  render(<AppointmentDetailsPage appointmentId={UPCOMING_ID} />);
  expect(screen.getByText('Upcoming')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Reschedule' })).toHaveAttribute(
    'href',
    '/patient/appointments/hist-2/reschedule'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Cancel Appointment' }));
  fireEvent.click(screen.getByRole('button', { name: 'Yes, Cancel' }));
  expect(screen.getByText('Cancelled')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Reschedule' })).not.toBeInTheDocument();
});

test('completed appointments offer Leave a Review only', () => {
  render(<AppointmentDetailsPage appointmentId="hist-3" />);
  expect(screen.getByText('Completed')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Reschedule' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Cancel/ })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Leave a Review' })).toHaveAttribute(
    'href',
    '/patient/reviews?appointment=hist-3'
  );
});

test('unknown appointment shows a not-found message', () => {
  render(<AppointmentDetailsPage appointmentId="missing" />);
  expect(screen.getByText('This appointment could not be found.')).toBeInTheDocument();
});
