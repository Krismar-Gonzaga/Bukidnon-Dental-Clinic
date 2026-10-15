import { fireEvent, render, screen, within } from '@testing-library/react';
import ChangePasswordPage from './ChangePasswordPage';
import { getPasswordStrength } from '../utils/passwordStrength';

const fill = (label, value) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

const fillForm = ({ current = 'oldpass123', next, confirm = next }) => {
  fill('Current Password', current);
  fill('New Password', next);
  fill('Confirm New Password', confirm);
};

test('renders the form inside the patient layout with My Profile active', () => {
  render(<ChangePasswordPage />);
  expect(screen.getByRole('heading', { level: 1, name: 'Change Password' })).toBeInTheDocument();
  expect(screen.getByRole('form', { name: 'Change Password' })).toBeInTheDocument();
  const nav = screen.getByRole('navigation', { name: 'Patient' });
  expect(within(nav).getByRole('link', { name: 'My Profile' })).toHaveAttribute(
    'aria-current',
    'page'
  );
  expect(screen.getByRole('link', { name: 'Back to Profile' })).toHaveAttribute(
    'href',
    '/patient/profile'
  );
  ['Current Password', 'New Password', 'Confirm New Password'].forEach((label) => {
    expect(screen.getByLabelText(label)).toHaveAttribute('type', 'password');
  });
});

test('the eye button shows and hides a password', () => {
  render(<ChangePasswordPage />);
  const toggle = screen.getByRole('button', { name: 'Show new password' });
  fireEvent.click(toggle);
  expect(screen.getByLabelText('New Password')).toHaveAttribute('type', 'text');
  expect(screen.getByRole('button', { name: 'Hide new password' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});

test('the strength meter follows the new password', () => {
  render(<ChangePasswordPage />);
  fill('New Password', 'password1');
  expect(screen.getByLabelText('New Password')).toHaveAccessibleDescription(
    'Medium — add a symbol to strengthen'
  );
  fill('New Password', 'Password1!');
  expect(screen.getByLabelText('New Password')).toHaveAccessibleDescription('Strong');
});

test('getPasswordStrength scores one point per rule', () => {
  expect(getPasswordStrength('')).toMatchObject({ score: 0, level: 'weak' });
  expect(getPasswordStrength('abc')).toMatchObject({ score: 0, level: 'weak' });
  expect(getPasswordStrength('abcdefgh')).toMatchObject({ score: 1, label: 'Weak' });
  expect(getPasswordStrength('Abcdefg1')).toMatchObject({ score: 3, label: 'Good' });
  expect(getPasswordStrength('Abcdef1!')).toMatchObject({ score: 4, hint: '' });
});

test('rejects a short or mismatched new password', () => {
  render(<ChangePasswordPage />);
  fillForm({ next: 'short' });
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
  expect(screen.getByRole('alert')).toHaveTextContent('at least 8 characters');

  fillForm({ next: 'Password1!', confirm: 'Password2!' });
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
  expect(screen.getByRole('alert')).toHaveTextContent('New passwords do not match.');
});

test('a valid form shows the Password Changed screen', () => {
  render(<ChangePasswordPage />);
  fillForm({ next: 'Password1!' });
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

  expect(screen.getByRole('heading', { name: 'Password Changed!' })).toHaveFocus();
  expect(screen.getByText('Your password has been updated successfully.')).toBeInTheDocument();
  expect(screen.queryByLabelText('New Password')).not.toBeInTheDocument();
  screen.getAllByRole('link', { name: 'Back to Profile' }).forEach((link) => {
    expect(link).toHaveAttribute('href', '/patient/profile');
  });
});
