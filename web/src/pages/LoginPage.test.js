import { fireEvent, render, screen } from '@testing-library/react';
import LoginPage from './LoginPage';
import { SIGN_IN_ROLES } from '../config/auth';

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

test('submitting shows a not-connected notice for the chosen role', () => {
  render(<LoginPage />);
  fireEvent.change(screen.getByLabelText('Email Address'), {
    target: { value: 'juan@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: 'secret' },
  });

  const dentistButton = screen.getByRole('button', { name: 'Sign In as Dentist' });
  fireEvent.click(dentistButton);
  fireEvent.submit(dentistButton.closest('form'));

  expect(screen.getByRole('status')).toHaveTextContent(
    'Dentist sign-in is not connected yet'
  );
  expect(screen.getByRole('status')).not.toHaveTextContent('secret');
});

test('shows a Back to Home link and the brand above the form', () => {
  render(<LoginPage />);
  expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute(
    'href',
    '/'
  );
  expect(screen.getByText('BukidnonDental')).toBeInTheDocument();
});
