import { fireEvent, screen } from '@testing-library/react';
import AppointmentDetailsPage from './AppointmentDetailsPage';
import { cancelAppointment, getAppointment } from '../services/patientApi';
import { getNotifications } from '../services/notificationApi';
import { apiError, PATIENT_USER, renderWithProviders } from '../testUtils';
import { appointment, emptyNotifications } from '../testFixtures';

jest.mock('../services/patientApi');
jest.mock('../services/notificationApi');

beforeEach(() => getNotifications.mockResolvedValue(emptyNotifications));

const renderPage = () => renderWithProviders(<AppointmentDetailsPage appointmentId="12" />, { user: PATIENT_USER });

test('shows a pending request with its details and the approval notice', async () => {
  getAppointment.mockResolvedValue(appointment());
  renderPage();

  expect(await screen.findByRole('heading', { level: 2, name: 'Dental Cleaning' })).toBeInTheDocument();
  expect(screen.getByText('Appointment #000012')).toBeInTheDocument();
  expect(screen.getByText('Dr. Maria Santos')).toBeInTheDocument();
  expect(screen.getByText('November 3, 2026')).toBeInTheDocument();
  expect(screen.getByText('9:00 AM')).toBeInTheDocument();
  expect(screen.getByText('Awaiting Clinic Approval')).toBeInTheDocument();
});

test('cancelling asks for confirmation, calls the API and refreshes', async () => {
  getAppointment.mockResolvedValueOnce(appointment()).mockResolvedValue(appointment({ status: 'cancelled', cancellation_reason: 'Cancelled by patient' }));
  cancelAppointment.mockResolvedValue();
  renderPage();

  fireEvent.click(await screen.findByRole('button', { name: 'Cancel Request' }));
  fireEvent.click(screen.getByRole('button', { name: 'Yes, Cancel' }));

  expect(await screen.findByText('Appointment cancelled')).toBeInTheDocument();
  expect(cancelAppointment).toHaveBeenCalledWith('12');
  expect(screen.queryByRole('button', { name: 'Cancel Request' })).not.toBeInTheDocument();
});

test('shows the server reason when cancelling is too late', async () => {
  getAppointment.mockResolvedValue(appointment({ status: 'confirmed' }));
  cancelAppointment.mockRejectedValue(apiError(409, { message: 'Appointments can only be changed online up to 24 hours before the start. Please contact the clinic.' }));
  renderPage();

  fireEvent.click(await screen.findByRole('button', { name: 'Cancel Appointment' }));
  fireEvent.click(screen.getByRole('button', { name: 'Yes, Cancel' }));

  expect(await screen.findByText(/up to 24 hours before the start/)).toBeInTheDocument();
});

test('explains a pending reschedule request', async () => {
  getAppointment.mockResolvedValue(appointment({ status: 'reschedule_requested', requested_starts_at: '2026-11-05T10:00:00+08:00' }));
  renderPage();

  expect(await screen.findByText('Reschedule requested')).toBeInTheDocument();
  expect(screen.getByText(/November 5, 2026 at 10:00 AM/)).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Reschedule' })).not.toBeInTheDocument();
});

test('offers a review link only for a completed visit without a review', async () => {
  getAppointment.mockResolvedValue(appointment({ status: 'completed' }));
  renderPage();

  expect(await screen.findByRole('link', { name: 'Leave a Review' })).toHaveAttribute('href', '/patient/reviews?appointment=12');
});

test('shows not found for an appointment the patient cannot see', async () => {
  getAppointment.mockRejectedValue(apiError(404, { message: 'Resource not found.' }));
  renderPage();

  expect(await screen.findByText('Not found')).toBeInTheDocument();
});
