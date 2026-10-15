import { fireEvent, screen, waitFor } from '@testing-library/react';
import EditProfilePage from './EditProfilePage';
import { getProfile, updateProfile } from '../services/patientApi';
import { getNotifications, updateNotificationPreferences } from '../services/notificationApi';
import { apiError, PATIENT_USER, renderWithProviders } from '../testUtils';
import { emptyNotifications } from '../testFixtures';

jest.mock('../services/patientApi');
jest.mock('../services/notificationApi');

const PROFILE = {
  name: 'Juan Dela Cruz',
  email: 'juan@example.com',
  phone: '09171234567',
  address: 'Valencia City',
  birthDate: '1995-03-15',
  gender: 'Male',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emailNotifications: true,
};

beforeEach(() => {
  getNotifications.mockResolvedValue(emptyNotifications);
  getProfile.mockResolvedValue(PROFILE);
});

test('saves personal details and the email preference', async () => {
  updateProfile.mockResolvedValue({});
  updateNotificationPreferences.mockResolvedValue({});
  renderWithProviders(<EditProfilePage />, { user: PATIENT_USER });

  const phone = await screen.findByLabelText('Phone Number');
  fireEvent.change(phone, { target: { value: '09179999999' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Notifications' }));
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

  expect(await screen.findByText('Profile Updated!')).toBeInTheDocument();
  expect(updateProfile).toHaveBeenCalledWith(expect.objectContaining({ phone: '09179999999', name: 'Juan Dela Cruz' }));
  expect(updateNotificationPreferences).toHaveBeenCalledWith({ email: false });
});

test('opens the tab from ?tab= and shows backend validation errors', async () => {
  updateProfile.mockRejectedValue(apiError(422, { errors: { emergency_contact_phone: ['The emergency contact phone may not be greater than 20 characters.'] } }));
  renderWithProviders(<EditProfilePage />, { user: PATIENT_USER, route: '/patient/profile/edit?tab=emergency' });

  const field = await screen.findByLabelText('Contact Phone');
  fireEvent.change(field, { target: { value: '1'.repeat(25) } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

  expect(await screen.findByText(/may not be greater than 20 characters/)).toBeInTheDocument();
  await waitFor(() => expect(field).toHaveAttribute('aria-invalid', 'true'));
});
