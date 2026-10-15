import { screen, within } from '@testing-library/react';
import PatientDashboardPage from './PatientDashboardPage';
import { PATIENT_NAV_ITEMS } from '../config/patientNavigation';
import { getPatientDashboard } from '../services/patientApi';
import { getNotifications } from '../services/notificationApi';
import { apiError, PATIENT_USER, renderWithProviders } from '../testUtils';
import { appointment, notification } from '../testFixtures';

jest.mock('../services/patientApi');
jest.mock('../services/notificationApi');

const COUNTS = { upcoming: 2, pending: 1, completed: 3, awaiting_review: 1, saved_clinics: 4, reviews_given: 2 };

beforeEach(() => {
  getNotifications.mockResolvedValue({ notifications: [notification()], unreadCount: 1, pageCount: 1 });
});

const renderPage = () => renderWithProviders(<PatientDashboardPage />, { user: PATIENT_USER });

test('shows the sidebar, welcome summary and stats from the API', async () => {
  getPatientDashboard.mockResolvedValue({
    name: 'Juan Dela Cruz',
    upcoming: [appointment(), appointment({ id: 13, status: 'confirmed' })],
    counts: COUNTS,
    unreadNotifications: 1,
  });
  renderPage();

  const nav = screen.getByRole('navigation', { name: 'Patient' });
  PATIENT_NAV_ITEMS.forEach(({ label }) => expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument());
  expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');

  expect(await screen.findByRole('heading', { level: 2, name: 'Juan Dela Cruz' })).toBeInTheDocument();
  expect(screen.getByText(/You have/).closest('p')).toHaveTextContent('You have 1 confirmed appointment and 1 pending approval.');
  expect(screen.getByText('4')).toBeInTheDocument(); // saved clinics
  expect(screen.getAllByRole('link', { name: 'View Dental Cleaning' })).toHaveLength(2);
  expect(await screen.findByText('Appointment confirmed')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Notifications, 1 unread' })).toBeInTheDocument();
});

test('shows an empty state with a booking link when nothing is upcoming', async () => {
  getPatientDashboard.mockResolvedValue({ name: 'Juan', upcoming: [], counts: { ...COUNTS, upcoming: 0, pending: 0 }, unreadNotifications: 0 });
  renderPage();

  expect(await screen.findByText('No upcoming appointments')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Book an Appointment' })).toHaveAttribute('href', '/patient/book');
});

test('shows an error with a retry button when the API fails', async () => {
  getPatientDashboard.mockRejectedValue(apiError(500, { message: 'Something went wrong. Please try again later.' }));
  renderPage();

  expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
});
