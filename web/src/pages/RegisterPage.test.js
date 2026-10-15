import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import RegisterPage from './RegisterPage';
import { REGISTER_ROLES } from '../config/auth';
import { register } from '../services/authService';
import { navigateTo } from '../utils/navigation';

jest.mock('../services/authService', () => ({ register: jest.fn() }));
jest.mock('../utils/navigation', () => ({ navigateTo: jest.fn() }));

const fillForm = ({ password = 'secret-1', confirmPassword = 'secret-1' } = {}) => {
  fireEvent.change(screen.getByLabelText('Full Name'), {
    target: { value: 'Juan Dela Cruz' },
  });
  fireEvent.change(screen.getByLabelText('Email Address'), {
    target: { value: 'juan@example.com' },
  });
  fireEvent.change(screen.getByLabelText('Mobile Number'), {
    target: { value: '+63 900 000 0000' },
  });
  fireEvent.change(screen.getByLabelText('Address'), {
    target: { value: 'Sayre Highway, Malaybalay City' },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: password },
  });
  fireEvent.change(screen.getByLabelText('Confirm Password'), {
    target: { value: confirmPassword },
  });
};

test('renders the form with role choice and required fields', () => {
  render(<RegisterPage />);
  expect(
    screen.getByRole('heading', { level: 1, name: 'Create Account' })
  ).toBeInTheDocument();
  REGISTER_ROLES.forEach(({ label }) => {
    expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
  });
  expect(screen.getByRole('radio', { name: 'Patient' })).toBeChecked();
  ['Full Name', 'Email Address', 'Mobile Number', 'Address', 'Password', 'Confirm Password'].forEach(
    (label) => expect(screen.getByLabelText(label)).toBeRequired()
  );
  expect(screen.getByText(/cannot self-register/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
    'href',
    '/login'
  );
});

test('switches the selected role', () => {
  render(<RegisterPage />);
  fireEvent.click(screen.getByRole('radio', { name: 'Clinic Admin' }));
  expect(screen.getByRole('radio', { name: 'Clinic Admin' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Patient' })).not.toBeChecked();
});

test('keeps Create Account disabled until the terms are accepted', () => {
  render(<RegisterPage />);
  const submit = screen.getByRole('button', { name: 'Create Account' });
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  expect(submit).toBeEnabled();
});

test('toggles visibility of each password field', () => {
  render(<RegisterPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Show confirm password' }));
  expect(screen.getByLabelText('Confirm Password')).toHaveAttribute('type', 'text');
  expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
});

test('shows an error when the passwords do not match', () => {
  render(<RegisterPage />);
  fillForm({ confirmPassword: 'different' });
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.submit(screen.getByRole('button', { name: 'Create Account' }));

  expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
  expect(screen.getByLabelText('Confirm Password')).toHaveAttribute(
    'aria-invalid',
    'true'
  );
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});

test('registers a patient and opens the patient dashboard', async () => {
  register.mockResolvedValue({ role: 'patient' });
  render(<RegisterPage />);
  fillForm();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.submit(screen.getByRole('button', { name: 'Create Account' }));

  await waitFor(() =>
    expect(navigateTo).toHaveBeenCalledWith('/patient/dashboard')
  );
  expect(register).toHaveBeenCalledWith({
    name: 'Juan Dela Cruz',
    email: 'juan@example.com',
    phone: '+63 900 000 0000',
    address: 'Sayre Highway, Malaybalay City',
    password: 'secret-1',
    role: 'patient',
  });
});

test('sends the clinic admin role and shows a notice instead of redirecting', async () => {
  register.mockResolvedValue({ role: 'clinic_admin' });
  render(<RegisterPage />);
  fireEvent.click(screen.getByRole('radio', { name: 'Clinic Admin' }));
  fillForm();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.submit(screen.getByRole('button', { name: 'Create Account' }));

  expect(
    await screen.findByText(
      'Account created. The Clinic Admin portal is not available on the web yet.'
    )
  ).toBeInTheDocument();
  expect(register).toHaveBeenCalledWith(
    expect.objectContaining({ role: 'clinic_admin' })
  );
  expect(navigateTo).not.toHaveBeenCalled();
});

test('shows backend validation errors on the matching fields', async () => {
  register.mockRejectedValue({
    response: {
      status: 422,
      data: {
        success: false,
        errors: { email: ['The email has already been taken.'] },
      },
    },
  });
  render(<RegisterPage />);
  fillForm();
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.submit(screen.getByRole('button', { name: 'Create Account' }));

  expect(
    await screen.findByText('The email has already been taken.')
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Email Address')).toHaveAttribute(
    'aria-invalid',
    'true'
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    'Please correct the highlighted fields.'
  );
});

test('shows a Back to Home link and the brand above the form', () => {
  render(<RegisterPage />);
  expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute(
    'href',
    '/'
  );
  expect(screen.getByText('BukidnonDental')).toBeInTheDocument();
});
