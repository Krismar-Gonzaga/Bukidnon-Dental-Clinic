import { screen, within } from '@testing-library/react';
import App from './App';
import { getCities, getClinicMap, getHome, getSpecializations } from './services/publicApi';
import { getPatientDashboard } from './services/patientApi';
import { getNotifications } from './services/notificationApi';
import { PATIENT_USER, renderWithProviders } from './testUtils';

jest.mock('./services/publicApi');
jest.mock('./services/patientApi');
jest.mock('./services/notificationApi');

const HOME = {
  featuredClinics: [
    { id: '1', name: 'Malaybalay Dental Care', location: 'Sayre Highway, Malaybalay City', rating: 4.9, reviewCount: null, tags: ['General Dentistry'], imageSrc: null },
  ],
  reviews: [{ id: '9', name: 'Maria L.', detail: 'Patient, Malaybalay Dental Care', rating: 5, quote: 'Booking took two minutes.' }],
  serviceRates: [{ name: 'Dental Cleaning', startingPrice: 800, clinicCount: 2 }],
  specializations: [],
  stats: {},
};

beforeEach(() => {
  getHome.mockResolvedValue(HOME);
  getClinicMap.mockResolvedValue([
    { id: '1', name: 'Malaybalay Dental Care', location: 'Malaybalay City', latitude: 8.1575, longitude: 125.1278 },
    { id: '2', name: 'No Coordinates Clinic', location: 'Valencia City', latitude: null, longitude: null },
  ]);
  getCities.mockResolvedValue(['Malaybalay City', 'Valencia City']);
  getSpecializations.mockResolvedValue([{ id: 1, name: 'Orthodontics' }]);
  getNotifications.mockResolvedValue({ notifications: [], unreadCount: 0, pageCount: 1 });
  getPatientDashboard.mockResolvedValue({ name: 'Juan', upcoming: [], counts: { upcoming: 0, pending: 0, completed: 0, saved_clinics: 0, reviews_given: 0 }, unreadNotifications: 0 });
});

const renderApp = (route = '/', user = null) => renderWithProviders(<App />, { route, user });

test('renders the guest home page with live featured clinics, prices and reviews', async () => {
  renderApp();
  expect(screen.getByRole('heading', { level: 1, name: /find trusted dental clinics across bukidnon/i })).toBeInTheDocument();
  expect(within(screen.getByRole('banner')).getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');

  expect(await screen.findByRole('heading', { level: 3, name: 'Malaybalay Dental Care' })).toBeInTheDocument();
  const featured = screen.getByRole('heading', { level: 2, name: /featured clinics/i }).closest('section');
  expect(within(featured).getByRole('link', { name: /book appointment/i })).toHaveAttribute('href', '/login?next=%2Fpatient%2Fbook%3Fclinic%3D1');
  expect(screen.getByText('Starts at ₱800')).toBeInTheDocument();
  expect(screen.getByText('Booking took two minutes.')).toBeInTheDocument();
});

test('search panel lists real cities and specializations', async () => {
  renderApp();
  expect(await screen.findByRole('option', { name: 'Valencia City' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Orthodontics' })).toBeInTheDocument();
});

test('map pins only clinics that have coordinates', async () => {
  renderApp();
  const section = (await screen.findByRole('heading', { level: 2, name: /find clinics near you/i })).closest('section');
  expect(await within(section).findByRole('link', { name: 'Malaybalay Dental Care' })).toBeInTheDocument();
  expect(within(section).queryByRole('link', { name: 'No Coordinates Clinic' })).not.toBeInTheDocument();
});

test('signed-out visitors are sent to login from the patient portal', () => {
  renderApp('/patient/dashboard');
  expect(screen.getByRole('heading', { level: 1, name: 'Welcome Back' })).toBeInTheDocument();
});

test('a patient cannot open the admin portal', async () => {
  renderApp('/admin/users', PATIENT_USER);
  // Redirected to their own dashboard instead.
  expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
});

test('unknown paths show a not-found page', () => {
  renderApp('/no-such-page');
  expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
});
