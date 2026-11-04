import { fireEvent, screen } from '@testing-library/react';
import SavedClinicsPage from './SavedClinicsPage';
import { getSavedClinics, unsaveClinic } from '../services/patientApi';
import { getNotifications } from '../services/notificationApi';
import { PATIENT_USER, renderWithProviders } from '../testUtils';
import { clinicSummary, emptyNotifications } from '../testFixtures';

jest.mock('../services/patientApi');
jest.mock('../services/notificationApi');

beforeEach(() => getNotifications.mockResolvedValue(emptyNotifications));

test('lists saved clinics with booking links and removes one', async () => {
  getSavedClinics.mockResolvedValueOnce([clinicSummary()]).mockResolvedValue([]);
  unsaveClinic.mockResolvedValue();
  renderWithProviders(<SavedClinicsPage />, { user: PATIENT_USER });

  expect(await screen.findByRole('heading', { name: 'Valencia Smiles' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Book' })).toHaveAttribute('href', '/patient/book?clinic=7');

  fireEvent.click(screen.getByRole('button', { name: 'Remove Valencia Smiles from saved clinics' }));
  expect(await screen.findByText(/You have no saved clinics yet/)).toBeInTheDocument();
  expect(unsaveClinic).toHaveBeenCalledWith('7');
});
