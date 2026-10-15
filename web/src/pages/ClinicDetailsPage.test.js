import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import ClinicDetailsPage from './ClinicDetailsPage';
import { getClinic } from '../services/publicApi';
import { getSavedClinics, saveClinic } from '../services/patientApi';
import { apiError, PATIENT_USER, renderWithProviders } from '../testUtils';
import { clinicProfile } from '../testFixtures';

jest.mock('../services/publicApi');
jest.mock('../services/patientApi');

beforeEach(() => getClinic.mockResolvedValue(clinicProfile()));

test('shows the public profile with hours, directions and a sign-in booking link for guests', async () => {
  renderWithProviders(<ClinicDetailsPage clinicId="7" />);

  expect(await screen.findByRole('heading', { level: 1, name: 'Valencia Smiles' })).toBeInTheDocument();
  expect(screen.getByText('Mon–Sat 8:00 AM–5:00 PM')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Get Directions/ })).toHaveAttribute('href', expect.stringContaining('destination=7.906%2C125.094'));
  expect(screen.getAllByRole('link', { name: 'Book Appointment' })[0]).toHaveAttribute('href', '/login?next=%2Fpatient%2Fbook%3Fclinic%3D7');
  expect(screen.queryByRole('button', { name: /Save Valencia Smiles/ })).not.toBeInTheDocument();
});

test('tabs show the clinic’s real services, dentists and reviews', async () => {
  renderWithProviders(<ClinicDetailsPage clinicId="7" />);
  await screen.findByRole('heading', { level: 1, name: 'Valencia Smiles' });

  fireEvent.click(screen.getByRole('tab', { name: 'Services' }));
  const panel = () => screen.getByRole('tabpanel');
  expect(within(panel()).getByRole('heading', { name: 'Dental Cleaning' })).toBeInTheDocument();
  expect(within(panel()).getByText('₱800')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: 'Dentists' }));
  expect(within(panel()).getByRole('heading', { name: 'Dr. Maria Santos' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: 'Reviews' }));
  expect(within(panel()).getByText('Very gentle.')).toBeInTheDocument();
  expect(within(panel()).getByText(/Juan D\. · Verified visit/)).toBeInTheDocument();
});

test('a patient can save the clinic', async () => {
  getSavedClinics.mockResolvedValue([]);
  saveClinic.mockResolvedValue();
  renderWithProviders(<ClinicDetailsPage clinicId="7" />, { user: PATIENT_USER });

  const save = await screen.findByRole('button', { name: 'Save Valencia Smiles' });
  await waitFor(() => expect(save).toBeEnabled());
  fireEvent.click(save);
  await waitFor(() => expect(saveClinic).toHaveBeenCalledWith('7'));
  expect(screen.getAllByRole('link', { name: 'Book Appointment' })[0]).toHaveAttribute('href', '/patient/book?clinic=7');
});

test('an unlisted clinic shows not found', async () => {
  getClinic.mockRejectedValue(apiError(404));
  renderWithProviders(<ClinicDetailsPage clinicId="99" />);
  expect(await screen.findByText('Not found')).toBeInTheDocument();
});
