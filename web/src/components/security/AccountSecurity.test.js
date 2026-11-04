import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { AccountSecurity } from './AccountSecurity';
import * as auth from '../../services/authService';
import { renderWithProviders } from '../../testUtils';

jest.mock('../../services/authService');

// Two-factor sign-in and signed-in devices, on the security page of every kind of account.

const patient = { id: 1, name: 'Ana Lim', role: 'patient', memberships: [] };
const sessions = [
  { id: 'web-abc', type: 'web', device: 'Chrome on Windows', ip_address: '10.0.0.1', last_active_at: new Date().toISOString(), current: true },
  { id: 'app-9', type: 'app', device: 'Pixel 8', ip_address: null, last_active_at: new Date().toISOString(), current: false },
];

const render = (user = patient) => renderWithProviders(<AccountSecurity />, { user });

beforeEach(() => {
  auth.getSessions.mockResolvedValue(sessions);
  auth.getTwoFactorStatus.mockResolvedValue({ enabled: true, recovery_codes_left: 8 });
  auth.fetchCurrentUser.mockResolvedValue(patient);
});

test('a patient can set up two-factor: QR code, code, then recovery codes shown once', async () => {
  auth.startTwoFactorSetup.mockResolvedValue({ secret: 'ABC123', otpauth_url: 'otpauth://totp/x', qr_svg: '<svg></svg>' });
  auth.confirmTwoFactor.mockResolvedValue({ recovery_codes: ['code-one', 'code-two'] });
  render();

  fireEvent.click(screen.getByRole('switch', { name: /Two-Factor Authentication/ }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText(/Confirm your password/), { target: { value: 'secret' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));

  expect(await within(dialog).findByRole('img', { name: /QR code/ })).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'));
  expect(within(dialog).getByText('ABC123')).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText(/6-digit code/), { target: { value: '123456' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Enable 2FA' }));

  expect(await within(dialog).findByText('code-one')).toBeInTheDocument();
  expect(auth.startTwoFactorSetup).toHaveBeenCalledWith('secret');
  expect(auth.confirmTwoFactor).toHaveBeenCalledWith('123456');
});

test('turning two-factor off asks for the password and a code', async () => {
  auth.disableTwoFactor.mockResolvedValue({});
  render({ ...patient, two_factor_enabled: true });

  expect(await screen.findByText('8 recovery codes left')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('switch', { name: /Two-Factor Authentication/ }));
  const dialog = await screen.findByRole('dialog');
  const turnOff = within(dialog).getByRole('button', { name: 'Turn Off' });
  expect(turnOff).toBeDisabled();

  fireEvent.change(within(dialog).getByLabelText(/Confirm your password/), { target: { value: 'secret' } });
  fireEvent.change(within(dialog).getByLabelText(/Code from your app/), { target: { value: '123456' } });
  fireEvent.click(turnOff);
  await waitFor(() => expect(auth.disableTwoFactor).toHaveBeenCalledWith('secret', '123456'));
});

test('devices: this one cannot be signed out here, another can after asking', async () => {
  auth.revokeSession.mockResolvedValue({});
  render();

  expect(await screen.findByText('Pixel 8')).toBeInTheDocument();
  expect(screen.getByText('This device')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Sign out of Chrome on Windows' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Sign out of Pixel 8' }));
  expect(auth.revokeSession).not.toHaveBeenCalled();
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Sign out' }));
  await waitFor(() => expect(auth.revokeSession).toHaveBeenCalledWith('app-9'));
});

test('signing out of all other devices asks for the password', async () => {
  auth.signOutOtherSessions.mockResolvedValue({});
  render();

  fireEvent.click(await screen.findByRole('button', { name: 'Sign out of all others' }));
  const dialog = await screen.findByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText(/Confirm your password/), { target: { value: 'secret' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Sign Out' }));
  await waitFor(() => expect(auth.signOutOtherSessions).toHaveBeenCalledWith('secret'));
});
