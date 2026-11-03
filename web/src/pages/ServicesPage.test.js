import { fireEvent, screen, within } from '@testing-library/react';
import ServicesPage from './ServicesPage';
import { getServiceCatalog } from '../services/publicApi';
import { renderWithProviders } from '../testUtils';

jest.mock('../services/publicApi');

beforeEach(() => {
  getServiceCatalog.mockResolvedValue([
    { id: '1', name: 'Dental Cleaning', category: 'Preventive', priceLabel: '₱500 – ₱1,500', durationLabel: '30–45 min', description: 'Prophylaxis', clinicCount: 3 },
    { id: '2', name: 'Implants', category: 'Restorative', priceLabel: 'Price on request', durationLabel: '', description: 'Implant placement', clinicCount: 0 },
  ]);
});

test('shows published price ranges and filters by category from the data', async () => {
  renderWithProviders(<ServicesPage />);

  expect(await screen.findByText('₱500 – ₱1,500')).toBeInTheDocument();
  expect(within(screen.getByRole('main')).getByRole('link', { name: 'Book This Service' })).toHaveAttribute('href', '/clinics?service=Dental%20Cleaning');
  // A service no clinic offers yet has no action.
  expect(within(screen.getByRole('main')).getAllByRole('link', { name: 'Book This Service' })).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', { name: 'Restorative' }));
  expect(screen.queryByText('₱500 – ₱1,500')).not.toBeInTheDocument();
  expect(screen.getByText('Price on request')).toBeInTheDocument();
});
