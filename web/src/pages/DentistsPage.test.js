import { fireEvent, screen, waitFor } from '@testing-library/react';
import DentistsPage from './DentistsPage';
import { getDentists, getSpecializations } from '../services/publicApi';
import { toDentistCard } from '../services/adapters';
import { renderWithProviders } from '../testUtils';

jest.mock('../services/publicApi');

beforeEach(() => {
  getSpecializations.mockResolvedValue([{ id: 2, name: 'Orthodontics' }]);
  getDentists.mockResolvedValue({
    dentists: [toDentistCard({ id: 5, name: 'Dr. Maria Santos', specialization: 'Orthodontics', years_experience: 12, is_active: true, clinics: [{ id: 7, name: 'Valencia Smiles', city: 'Valencia City' }] })],
    pageCount: 1,
    total: 1,
  });
});

test('lists dentists from the API with their clinic and no invented ratings', async () => {
  renderWithProviders(<DentistsPage />);

  expect(await screen.findByRole('heading', { name: 'Dr. Maria Santos' })).toBeInTheDocument();
  expect(screen.getByText('Valencia Smiles')).toBeInTheDocument();
  expect(screen.getByText('12 years exp.')).toBeInTheDocument();
  expect(screen.queryByRole('img', { name: /Rated/ })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View Clinic' })).toHaveAttribute('href', '/clinics/7');
});

test('filters by specialization on the server', async () => {
  renderWithProviders(<DentistsPage />);
  await screen.findByRole('heading', { name: 'Dr. Maria Santos' });

  fireEvent.change(await screen.findByLabelText('Specialization'), { target: { value: 'Orthodontics' } });
  await waitFor(() => expect(getDentists).toHaveBeenLastCalledWith(expect.objectContaining({ specializationId: 2 })));
});
