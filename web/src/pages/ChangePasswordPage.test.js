import { fireEvent, screen } from '@testing-library/react';
import ChangePasswordPage from './ChangePasswordPage';
import { changePassword } from '../services/authService';
import { getNotifications } from '../services/notificationApi';
import { apiError, PATIENT_USER, renderWithProviders } from '../testUtils';
import { emptyNotifications } from '../testFixtures';

jest.mock('../services/authService', () => ({ changePassword: jest.fn(), fetchCurrentUser: jest.fn(), logout: jest.fn() }));
jest.mock('../services/notificationApi');

beforeEach(() => getNotifications.mockResolvedValue(emptyNotifications));

const fill = (current, next, confirm = next) => {
  fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: current } });
  fireEvent.change(screen.getByLabelText('New Password'), { target: { value: next } });
  fireEvent.change(screen.getByLabelText('Confirm New Password'), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
};

test('checks length and match locally before calling the API', () => {
  renderWithProviders(<ChangePasswordPage />, { user: PATIENT_USER });

  fill('old-pass', 'short');
  expect(screen.getByRole('alert')).toHaveTextContent('at least 8 characters');
  fill('old-pass', 'long-enough-1', 'different-1');
  expect(screen.getByRole('alert')).toHaveTextContent('do not match');
  expect(changePassword).not.toHaveBeenCalled();
});

test('changes the password and mentions other devices were signed out', async () => {
  changePassword.mockResolvedValue('Password changed successfully');
  renderWithProviders(<ChangePasswordPage />, { user: PATIENT_USER });

  fill('old-pass', 'brand-new-1');
  expect(await screen.findByText(/Other devices were signed out/)).toBeInTheDocument();
  expect(changePassword).toHaveBeenCalledWith({ currentPassword: 'old-pass', newPassword: 'brand-new-1' });
});

test('shows a wrong current password from the server', async () => {
  changePassword.mockRejectedValue(apiError(422, { errors: { current_password: ['Current password is incorrect.'] } }));
  renderWithProviders(<ChangePasswordPage />, { user: PATIENT_USER });

  fill('wrong', 'brand-new-1');
  expect(await screen.findByText('Current password is incorrect.')).toBeInTheDocument();
});
