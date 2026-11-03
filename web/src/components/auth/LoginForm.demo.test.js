import { fireEvent, screen, waitFor } from '@testing-library/react';
import LoginPage from '../../pages/LoginPage';
import { login } from '../../services/authService';
import { renderWithProviders } from '../../testUtils';

jest.mock('../../services/authService', () => ({ login: jest.fn(), logout: jest.fn(), fetchCurrentUser: jest.fn() }));
// The real list is empty outside development builds; supply it here.
jest.mock('../../config/demoAccounts', () => ({
  DEMO_ACCOUNTS: [
    { label: 'Patient', email: 'demo.patient@example.test', password: 'DemoPass2026' },
    { label: 'Clinic Admin', email: 'demo.clinic-admin@example.test', password: 'DemoPass2026' },
  ],
}));

test('auto fill puts a demo account in the form, then Sign In signs in', async () => {
  login.mockResolvedValue({ id: 2, name: 'Demo Clinic Administrator', role: 'clinic_admin', memberships: [] });
  renderWithProviders(<LoginPage />, { route: '/login', path: '/login' });

  fireEvent.click(screen.getByRole('button', { name: 'Auto fill the Clinic Admin demo account' }));
  expect(screen.getByLabelText('Email Address')).toHaveValue('demo.clinic-admin@example.test');
  expect(screen.getByLabelText('Password')).toHaveValue('DemoPass2026');
  const signIn = screen.getByRole('button', { name: 'Sign In' });
  expect(screen.getByText(/Filled in the Clinic Admin demo account. Press Sign In./)).toBeInTheDocument();

  fireEvent.click(signIn);
  fireEvent.submit(signIn.closest('form'));
  await waitFor(() => expect(login).toHaveBeenCalledWith({ email: 'demo.clinic-admin@example.test', password: 'DemoPass2026' }));
  expect(await screen.findByText('Navigated away')).toBeInTheDocument();
});
