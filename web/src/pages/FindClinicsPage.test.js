import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import FindClinicsPage from './FindClinicsPage';
import { getCities, getSpecializations, searchClinics } from '../services/publicApi';
import { apiError, renderWithProviders } from '../testUtils';
import { clinicSummary } from '../testFixtures';

jest.mock('../services/publicApi');

beforeEach(() => {
  getCities.mockResolvedValue(['Malaybalay City', 'Valencia City']);
  getSpecializations.mockResolvedValue([{ id: 1, name: 'Orthodontics' }]);
  searchClinics.mockResolvedValue({ clinics: [clinicSummary()], total: 1, pageCount: 1, currentPage: 1 });
});

test('shows server results with links to the public clinic page and sign-in booking', async () => {
  renderWithProviders(<FindClinicsPage />, { route: '/clinics' });

  expect(await screen.findByRole('heading', { level: 3, name: 'Valencia Smiles' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('1 clinic found');
  const card = screen.getByRole('article', { name: 'Valencia Smiles' });
  expect(within(card).getByRole('link', { name: 'View Details' })).toHaveAttribute('href', '/clinics/7');
  expect(within(card).getByRole('link', { name: 'Book Appointment' })).toHaveAttribute('href', '/login?next=%2Fpatient%2Fbook%3Fclinic%3D7');
});

test('sends filters to the server', async () => {
  renderWithProviders(<FindClinicsPage />, { route: '/clinics?service=Cleaning' });
  await screen.findByRole('heading', { level: 3, name: 'Valencia Smiles' });

  fireEvent.change(await screen.findByLabelText('Location'), { target: { value: 'Valencia City' } });
  fireEvent.change(screen.getByLabelText('Search Clinic'), { target: { value: 'smile' } });

  await waitFor(() =>
    expect(searchClinics).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: 'smile', city: 'Valencia City', service: 'Cleaning', page: 1 })
    )
  );
});

test('prefills filters from the home page search', async () => {
  renderWithProviders(<FindClinicsPage />, { route: '/clinics?search=smile&city=Valencia%20City' });
  await waitFor(() => expect(searchClinics).toHaveBeenCalledWith(expect.objectContaining({ query: 'smile', city: 'Valencia City' })));
});

test('shows empty and error states', async () => {
  searchClinics.mockResolvedValueOnce({ clinics: [], total: 0, pageCount: 1, currentPage: 1 });
  const { unmount } = renderWithProviders(<FindClinicsPage />);
  expect(await screen.findByText(/No clinics match your search/)).toBeInTheDocument();
  unmount();

  searchClinics.mockRejectedValue(apiError(500, { message: 'Something went wrong. Please try again later.' }));
  renderWithProviders(<FindClinicsPage />);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
});
