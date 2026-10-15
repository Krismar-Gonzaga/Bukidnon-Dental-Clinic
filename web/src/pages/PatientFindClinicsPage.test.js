import { screen, within } from '@testing-library/react';
import PatientFindClinicsPage from './PatientFindClinicsPage';
import { getCities, getSpecializations, searchClinics } from '../services/publicApi';
import { PATIENT_USER, renderWithProviders } from '../testUtils';
import { clinicSummary } from '../testFixtures';

jest.mock('../services/publicApi');

test('cards open the patient booking flow and clinic page; header shows My Account', async () => {
  getCities.mockResolvedValue([]);
  getSpecializations.mockResolvedValue([]);
  searchClinics.mockResolvedValue({ clinics: [clinicSummary()], total: 1, pageCount: 1, currentPage: 1 });
  renderWithProviders(<PatientFindClinicsPage />, { user: PATIENT_USER });

  const card = await screen.findByRole('article', { name: 'Valencia Smiles' });
  expect(within(card).getByRole('link', { name: 'Book Appointment' })).toHaveAttribute('href', '/patient/book?clinic=7');
  expect(within(card).getByRole('link', { name: 'View Details' })).toHaveAttribute('href', '/patient/clinics/7');
  expect(screen.getByRole('link', { name: /My Account/ })).toHaveAttribute('href', '/patient/dashboard');
});
