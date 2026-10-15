import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import LoginPage from './LoginPage';
import { SIGN_IN_ROLES } from '../config/auth';
import { login, logout } from '../services/authService';
import { navigateTo } from '../utils/navigation';

jest.mock('../services/authService', () => ({
  login: jest.fn(),
  logout: jest.fn(),
}));
jest.mock('../utils/navigation', () => ({ navigateTo: jest.fn() }));

test('renders the sign-in form with required fields', () => {
  render(<LoginPage />);
  expect(
    screen.getByRole('heading', { level: 1, name: 'Welcome Back' })
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Email Address')).toBeRequired();
  expect(screen.getByLabelText('Email Address')).toHaveAttribute('type', 'email');
  expect(screen.getByLabelText('Password')).toBeRequired();
  expect(screen.getByRole('link', { name: 'Forgot password?' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Register here' })).toBeInTheDocument();
});

test('renders one sign-in button per role', () => {
  render(<LoginPage />);
  SIGN_IN_ROLES.forEach(({ label }) => {
    expect(
      screen.getByRole('button', { name: `Sign In as ${label}` })
    ).toHaveAttribute('type', 'submit');
  });
});

test('toggles password visibility', () => {
  render(<LoginPage />);
  const password = screen.getByLabelText('Password');
  expect(password).toHaveAttribute('type', 'password');

  fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
  expect(password).toHaveAttribute('type', 'text');

  fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
  expect(password).toHaveAttribute('type', 'password');
});

const signInAs = (roleLabel) => {
  fireEvent.change(screen.getByLabelText('Email Address'), {
    target: { value: 'juan@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'secret' },
  });
  const button = screen.getByRole('button', { name: `Sign In as ${roleLabel}` });
  fireEvent.click(button);
  fireEvent.submit(button.closest('form'));
};

test('signs a patient in and opens the patient dashboard', async () => {
  login.mockResolvedValue({ role: 'patient' });
  render(<LoginPage />);
  signInAs('Patient');

  await waitFor(() =>
    expect(navigateTo).toHaveBeenCalledWith('/patient/dashboard')
  );
  expect(login).toHaveBeenCalledWith({
    email: 'juan@example.com',
    password: 'secret',
  });
  expect(logout).not.toHaveBeenCalled();
});

test('signs out again when the account role does not match the button', async () => {
  login.mockResolvedValue({ role: 'patient' });
  logout.mockResolvedValue();
  render(<LoginPage />);
  signInAs('Dentist');

  expect(
    await screen.findByText(/This account is not a Dentist account/)
  ).toBeInTheDocument();
  expect(logout).toHaveBeenCalled();
  expect(navigateTo).not.toHaveBeenCalled();
});

test('shows a notice for roles without a web portal yet', async () => {
  login.mockResolvedValue({ role: 'staff' });
  render(<LoginPage />);
  signInAs('Clinic Staff');

  expect(
    await screen.findByText(
      'Signed in as Clinic Staff. The Clinic Staff portal is not available on the web yet.'
    )
  ).toBeInTheDocument();
  expect(navigateTo).not.toHaveBeenCalled();
});

test('shows the server error and never echoes the password', async () => {
  login.mockRejectedValue({
    response: { status: 401, data: { message: 'Invalid login credentials' } },
  });
  render(<LoginPage />);
  signInAs('Patient');

  expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument();
  expect(screen.getByRole('status')).not.toHaveTextContent('secret');
  expect(navigateTo).not.toHaveBeenCalled();
});

test('shows a Back to Home link and the brand above the form', () => {
  render(<LoginPage />);
  expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute(
    'href',
    '/'
  );
  expect(screen.getByText('BukidnonDental')).toBeInTheDocument();
});
