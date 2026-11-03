import { fireEvent, screen } from '@testing-library/react';
import LoginPage from './LoginPage';
import { login, logout } from '../services/authService';
import { apiError, renderWithProviders } from '../testUtils';

jest.mock('../services/authService', () => ({
  login: jest.fn(),
  logout: jest.fn(),
  fetchCurrentUser: jest.fn(),
}));

const renderLogin = (route = '/login') => renderWithProviders(<LoginPage />, { route, path: '/login' });

const signIn = () => {
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'juan@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
  const button = screen.getByRole('button', { name: 'Sign In' });
  fireEvent.click(button);
  fireEvent.submit(button.closest('form'));
};

test('renders the sign-in form with required fields and a working forgot-password link', () => {
  renderLogin();
  expect(screen.getByRole('heading', { level: 1, name: 'Welcome Back' })).toBeInTheDocument();
  expect(screen.getByLabelText('Email Address')).toBeRequired();
  expect(screen.getByLabelText('Password')).toBeRequired();
  expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password');
  // One Sign In button for every account type.
  expect(screen.getByRole('button', { name: 'Sign In' })).toHaveAttribute('type', 'submit');
  expect(screen.queryByRole('button', { name: /Sign In as/ })).not.toBeInTheDocument();
});

test('toggles password visibility', () => {
  renderLogin();
  const password = screen.getByLabelText('Password');
  fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
  expect(password).toHaveAttribute('type', 'text');
});

test('signs a patient in and leaves the login page', async () => {
  login.mockResolvedValue({ id: 1, name: 'Juan', role: 'patient', memberships: [] });
  renderLogin();
  signIn();

  expect(await screen.findByText('Navigated away')).toBeInTheDocument();
  expect(login).toHaveBeenCalledWith({ email: 'juan@example.com', password: 'secret' });
  expect(logout).not.toHaveBeenCalled();
});

test('returns to a same-site ?next= path but ignores external ones', async () => {
  login.mockResolvedValue({ id: 1, name: 'Juan', role: 'patient', memberships: [] });
  renderLogin('/login?next=//evil.example.com');
  signIn();
  // An open redirect would leave the app; instead the patient dashboard route is used.
  expect(await screen.findByText('Navigated away')).toBeInTheDocument();
});

test('any account type signs in with the same button', async () => {
  login.mockResolvedValue({ id: 2, name: 'Ana', role: 'clinic_admin', memberships: [{ clinic_id: 7, clinic_name: 'Valencia Smiles', role: 'clinic_admin', permissions: [] }] });
  renderLogin();
  signIn();

  expect(await screen.findByText('Navigated away')).toBeInTheDocument();
  expect(logout).not.toHaveBeenCalled();
});

test('shows the server error and never echoes the password', async () => {
  login.mockRejectedValue(apiError(401, { message: 'Invalid login credentials' }));
  renderLogin();
  signIn();

  expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument();
  expect(screen.getByRole('status')).not.toHaveTextContent('secret');
});

test('explains rate limiting', async () => {
  login.mockRejectedValue(apiError(429, { message: 'Too many requests. Please wait and try again.' }));
  renderLogin();
  signIn();
  expect(await screen.findByText('Too many requests. Please wait and try again.')).toBeInTheDocument();
});
