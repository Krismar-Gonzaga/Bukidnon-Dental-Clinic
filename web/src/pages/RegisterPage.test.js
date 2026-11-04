import { fireEvent, screen } from '@testing-library/react';
import RegisterPage from './RegisterPage';
import { REGISTER_ROLES } from '../config/auth';
import { register } from '../services/authService';
import { apiError, renderWithProviders } from '../testUtils';

jest.mock('../services/authService', () => ({ register: jest.fn(), fetchCurrentUser: jest.fn(), logout: jest.fn() }));

const render = (ui) => renderWithProviders(ui, { route: '/register', path: '/register' });

const fillForm = ({ password = 'secret-1', confirmPassword = 'secret-1' } = {}) => {
  fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Juan Dela Cruz' } });
  fireEvent.change(screen.getByLabelText('Email Address'), { target: { value: 'juan@example.com' } });
  fireEvent.change(screen.getByLabelText('Mobile Number'), { target: { value: '+63 900 000 0000' } });
  fireEvent.change(screen.getByLabelText('Address'), { target: { value: 'Sayre Highway, Malaybalay City' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: confirmPassword } });
};

const submit = () => {
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.submit(screen.getByRole('button', { name: 'Create Account' }));
};

test('renders the form with role choice and required fields', () => {
  render(<RegisterPage />);
  expect(screen.getByRole('heading', { level: 1, name: 'Create Account' })).toBeInTheDocument();
  REGISTER_ROLES.forEach(({ label }) => {
    expect(screen.getByRole('radio', { name: label })).toBeInTheDocument();
  });
  expect(screen.getByRole('radio', { name: 'Patient' })).toBeChecked();
  ['Full Name', 'Email Address', 'Mobile Number', 'Address', 'Password', 'Confirm Password'].forEach((label) =>
    expect(screen.getByLabelText(label)).toBeRequired()
  );
  expect(screen.getByText(/cannot self-register/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
});

test('keeps Create Account disabled until the terms are accepted', () => {
  render(<RegisterPage />);
  const button = screen.getByRole('button', { name: 'Create Account' });
  expect(button).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox'));
  expect(button).toBeEnabled();
});

test('shows an error when the passwords do not match, without calling the API', () => {
  render(<RegisterPage />);
  fillForm({ confirmPassword: 'different' });
  submit();

  expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
  expect(screen.getByLabelText('Confirm Password')).toHaveAttribute('aria-invalid', 'true');
  expect(register).not.toHaveBeenCalled();
});

test('registers a patient and leaves the page', async () => {
  register.mockResolvedValue({ id: 1, name: 'Juan', role: 'patient', memberships: [] });
  render(<RegisterPage />);
  fillForm();
  submit();

  expect(await screen.findByText('Navigated away')).toBeInTheDocument();
  expect(register).toHaveBeenCalledWith({
    name: 'Juan Dela Cruz',
    email: 'juan@example.com',
    phone: '+63 900 000 0000',
    address: 'Sayre Highway, Malaybalay City',
    password: 'secret-1',
    role: 'patient',
  });
});

test('sends the clinic admin role', async () => {
  register.mockResolvedValue({ id: 2, name: 'Ana', role: 'clinic_admin', memberships: [] });
  render(<RegisterPage />);
  fireEvent.click(screen.getByRole('radio', { name: 'Clinic Admin' }));
  fillForm();
  submit();

  expect(await screen.findByText('Navigated away')).toBeInTheDocument();
  expect(register).toHaveBeenCalledWith(expect.objectContaining({ role: 'clinic_admin' }));
});

test('shows backend validation errors on the matching fields', async () => {
  register.mockRejectedValue(apiError(422, { errors: { email: ['The email has already been taken.'] } }));
  render(<RegisterPage />);
  fillForm();
  submit();

  expect(await screen.findByText('The email has already been taken.')).toBeInTheDocument();
  expect(screen.getByLabelText('Email Address')).toHaveAttribute('aria-invalid', 'true');
  expect(screen.getByRole('status')).toHaveTextContent('Please correct the highlighted fields.');
});
