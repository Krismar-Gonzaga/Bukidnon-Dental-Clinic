import { screen, within } from '@testing-library/react';
import App from './App';
import { getCities, getClinicMap, getHome, getServiceCatalog, getSpecializations } from './services/publicApi';
import { getPatientDashboard } from './services/patientApi';
import { getNotifications } from './services/notificationApi';
import { PATIENT_USER, renderWithProviders } from './testUtils';

jest.mock('./services/publicApi');
jest.mock('./services/patientApi');
jest.mock('./services/notificationApi');
jest.mock('./services/clinicPortalApi');
jest.mock('./services/adminApi');

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
  getServiceCatalog.mockResolvedValue([{ id: '3', name: 'Dental Cleaning', category: 'Preventive', priceLabel: '₱800 – ₱1,500', durationLabel: '45 min', description: 'Prophylaxis', clinicCount: 2 }]);
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
  expect(await screen.findByText('₱800 – ₱1,500')).toBeInTheDocument();
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

test('the guest site header and footer show on public pages only, not on sign-in or in the patient portal', () => {
  const home = renderApp('/');
  expect(within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', { name: 'Home' })).toBeInTheDocument();
  expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  home.unmount();

  // Sign-in: only the login page (its own Back to Home link), no site header or footer.
  const login = renderApp('/login');
  expect(screen.getByRole('heading', { level: 1, name: 'Welcome Back' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();
  expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Back to Home/ })).toHaveAttribute('href', '/');
  login.unmount();
  renderApp('/patient/dashboard', PATIENT_USER);
  expect(screen.getByRole('navigation', { name: 'Patient' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();
  expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
});

test('clinic and admin portals use their own frame, not the patient site header and footer', async () => {
  const { clinicUser } = jest.requireActual('./testUtils');
  const clinicApi = require('./services/clinicPortalApi');
  clinicApi.getClinicDashboard.mockResolvedValue({ alerts: [] });

  const { unmount } = renderApp('/clinic/7/dashboard', clinicUser(['clinic.view'], 'dentist'));
  expect(screen.getByRole('navigation', { name: 'Clinic' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();
  expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  unmount();

  renderApp('/admin', { id: 3, name: 'Sam Admin', email: 'sam@example.com', role: 'system_admin', memberships: [] });
  expect(screen.getByRole('navigation', { name: 'Administration' })).toBeInTheDocument();
  expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument();
});
