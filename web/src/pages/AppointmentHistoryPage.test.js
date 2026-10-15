import { fireEvent, screen } from '@testing-library/react';
import AppointmentHistoryPage from './AppointmentHistoryPage';
import { getAppointments } from '../services/patientApi';
import { getNotifications } from '../services/notificationApi';
import { PATIENT_USER, renderWithProviders } from '../testUtils';
import { appointment, emptyNotifications } from '../testFixtures';

jest.mock('../services/patientApi');
jest.mock('../services/notificationApi');

beforeEach(() => {
  getNotifications.mockResolvedValue(emptyNotifications);
  getAppointments.mockResolvedValue([
    appointment(),
    appointment({ id: 13, status: 'confirmed', service: { id: 9, name: 'Braces Consultation' } }),
    appointment({ id: 14, status: 'completed', service: { id: 9, name: 'Tooth Extraction' } }),
    appointment({ id: 15, status: 'rejected', service: { id: 9, name: 'Whitening' } }),
  ]);
});

test('lists appointments with patient-facing statuses and filters them', async () => {
  renderWithProviders(<AppointmentHistoryPage />, { user: PATIENT_USER });

  expect(await screen.findByRole('heading', { name: 'Dental Cleaning' })).toBeInTheDocument();
  expect(screen.getAllByRole('article')).toHaveLength(4);

  fireEvent.click(screen.getByRole('button', { name: 'Upcoming' }));
  expect(screen.getAllByRole('article')).toHaveLength(1);
  expect(screen.getByRole('link', { name: 'Reschedule Braces Consultation' })).toHaveAttribute('href', '/patient/appointments/13/reschedule');

  // A rejected request shows under Cancelled.
  fireEvent.click(screen.getByRole('button', { name: 'Cancelled' }));
  expect(screen.getByRole('heading', { name: 'Whitening' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
  expect(screen.getByRole('link', { name: /Review Tooth Extraction/ })).toHaveAttribute('href', '/patient/reviews?appointment=14');
});

test('shows the empty message for a filter with no appointments', async () => {
  getAppointments.mockResolvedValue([]);
  renderWithProviders(<AppointmentHistoryPage />, { user: PATIENT_USER });

  expect(await screen.findByText('No appointments in this category.')).toBeInTheDocument();
});
