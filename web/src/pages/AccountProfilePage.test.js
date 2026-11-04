import { fireEvent, screen } from '@testing-library/react';
import AccountProfilePage from './AccountProfilePage';
import AdminLayout from '../layouts/AdminLayout';
import { updateAccount } from '../services/authService';
import { getNotifications } from '../services/notificationApi';
import { apiError, clinicUser, renderWithProviders } from '../testUtils';

jest.mock('../services/authService', () => ({ fetchCurrentUser: jest.fn(), logout: jest.fn(), updateAccount: jest.fn() }));
jest.mock('../services/notificationApi');

const ADMIN = { id: 3, name: 'Sam Admin', email: 'sam@example.com', role: 'system_admin', memberships: [] };

beforeEach(() => {
  getNotifications.mockResolvedValue({ notifications: [], unreadCount: 0, pageCount: 1 });
});

const renderPage = (user = ADMIN) =>
  renderWithProviders(
    <AccountProfilePage layout={AdminLayout} activeHref="/admin/profile" passwordHref="/admin/password" />,
    { user }
  );

test('saves name and email and links to Change password', async () => {
  updateAccount.mockResolvedValue('Profile updated successfully');
  renderPage();

  expect(screen.getByRole('heading', { level: 1, name: 'My Profile' })).toBeInTheDocument();
  expect(screen.getByText('System Admin', { selector: 'dd' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Change password' })).toHaveAttribute('href', '/admin/password');

  fireEvent.change(screen.getByLabelText(/Full name/), { target: { value: 'Samantha Admin' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
  expect(updateAccount).toHaveBeenCalledWith({ name: 'Samantha Admin', email: 'sam@example.com' });
});

test('shows the server validation error on the field', async () => {
  updateAccount.mockRejectedValue(
    apiError(422, { message: 'The email has already been taken.', errors: { email: ['The email has already been taken.'] } })
  );
  renderPage();

  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(await screen.findAllByText('The email has already been taken.')).not.toHaveLength(0);
  expect(screen.getByLabelText(/Email/)).toHaveAttribute('aria-invalid', 'true');
});

test('lists the clinics a member belongs to', () => {
  renderPage(clinicUser(['clinic.view'], 'dentist'));
  expect(screen.getByText(/Valencia Smiles — Dentist/)).toBeInTheDocument();
});
