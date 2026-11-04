import { fireEvent, screen } from '@testing-library/react';
import ClinicLocatorPage from './ClinicLocatorPage';
import { getClinicMap } from '../services/publicApi';
import { getNotifications } from '../services/notificationApi';
import { PATIENT_USER, renderWithProviders } from '../testUtils';
import { clinicSummary, emptyNotifications } from '../testFixtures';

jest.mock('../services/publicApi');
jest.mock('../services/notificationApi');

beforeEach(() => {
  getNotifications.mockResolvedValue(emptyNotifications);
  getClinicMap.mockResolvedValue([
    clinicSummary(),
    clinicSummary({ id: 8, name: 'Malaybalay Dental', city: 'Malaybalay City', latitude: null, longitude: null }),
  ]);
});

afterEach(() => {
  delete navigator.geolocation;
});

test('lists clinics, pins the ones with coordinates and links to directions', async () => {
  renderWithProviders(<ClinicLocatorPage />, { user: PATIENT_USER });

  expect(await screen.findByRole('button', { name: /Malaybalay Dental/ })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Show Valencia Smiles on map' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Show Malaybalay Dental on map' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Directions/ })).toHaveAttribute('href', expect.stringContaining('destination=7.906'));

  fireEvent.change(screen.getByPlaceholderText('Search clinics...'), { target: { value: 'malay' } });
  expect(screen.queryByRole('button', { name: /^Valencia Smiles/ })).not.toBeInTheDocument();
});

test('asks for location only on click and handles a denied permission', async () => {
  navigator.geolocation = {
    getCurrentPosition: jest.fn((success, failure) => failure({ code: 1, PERMISSION_DENIED: 1 })),
  };
  renderWithProviders(<ClinicLocatorPage />, { user: PATIENT_USER });

  const button = await screen.findByRole('button', { name: 'Use My Location' });
  expect(navigator.geolocation.getCurrentPosition).not.toHaveBeenCalled();
  fireEvent.click(button);

  expect(await screen.findByRole('alert')).toHaveTextContent('Location permission was denied');
  expect(screen.getByRole('link', { name: /Directions/ })).toBeInTheDocument();
});

test('adds the current position as the directions origin when allowed', async () => {
  navigator.geolocation = {
    getCurrentPosition: jest.fn((success) => success({ coords: { latitude: 8.15, longitude: 125.12 } })),
  };
  renderWithProviders(<ClinicLocatorPage />, { user: PATIENT_USER });

  fireEvent.click(await screen.findByRole('button', { name: 'Use My Location' }));
  expect(await screen.findByRole('link', { name: /Directions/ })).toHaveAttribute('href', expect.stringContaining('origin=8.15%2C125.12'));
});
