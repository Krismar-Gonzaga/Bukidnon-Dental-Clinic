import { fireEvent, screen, waitFor } from '@testing-library/react';
import EditProfilePage from './EditProfilePage';
import { checkPhoto } from '../components/patient/ProfileAvatar';
import { getProfile, updateHealth, updateProfile, uploadProfilePhoto } from '../services/patientApi';
import { getNotifications } from '../services/notificationApi';
import { apiError, PATIENT_USER, renderWithProviders } from '../testUtils';
import { emptyNotifications } from '../testFixtures';

jest.mock('../services/patientApi');
jest.mock('../services/notificationApi');

const PROFILE = {
  name: 'Juan Dela Cruz',
  email: 'juan@example.com',
  phone: '09171234567',
  address: 'Sayre Highway',
  birthDate: '1995-03-15',
  gender: 'Male',
  civilStatus: '',
  bloodType: '',
  city: 'Valencia City',
  province: 'Bukidnon',
  zipCode: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelationship: '',
  emergencyContactAddress: '',
  photoVersion: null,
  health: { conditions: ['Asthma'], procedures: [], vitals: {}, allergies: [], medications: [], anxiety: {} },
  consents: {},
  emailNotifications: true,
};

const save = () => fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

beforeEach(() => {
  getNotifications.mockResolvedValue(emptyNotifications);
  getProfile.mockResolvedValue(PROFILE);
  updateProfile.mockResolvedValue({});
  updateHealth.mockResolvedValue({});
});

test('saves personal details under one name, split into first and last on screen', async () => {
  renderWithProviders(<EditProfilePage />, { user: PATIENT_USER });

  expect(await screen.findByLabelText('First Name')).toHaveValue('Juan');
  expect(screen.getByLabelText('Last Name')).toHaveValue('Dela Cruz');

  fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Santos Reyes' } });
  fireEvent.change(screen.getByLabelText('Blood Type'), { target: { value: 'O+' } });
  fireEvent.change(screen.getByLabelText('Civil Status'), { target: { value: 'Married' } });
  save();

  expect(await screen.findByText('Profile Updated!')).toBeInTheDocument();
  expect(updateProfile).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Juan Santos Reyes', bloodType: 'O+', civilStatus: 'Married' })
  );
});

test('adds an allergy and medication; rows left blank are not saved', async () => {
  renderWithProviders(<EditProfilePage />, { user: PATIENT_USER, route: '/patient/profile/edit?tab=allergies' });

  fireEvent.click(await screen.findByRole('button', { name: 'Add allergy' }));
  fireEvent.change(screen.getByLabelText('Allergy'), { target: { value: 'Latex' } });
  fireEvent.change(screen.getByLabelText('Severity'), { target: { value: 'moderate' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add medication' }));
  save();

  await screen.findByText('Profile Updated!');
  expect(updateHealth).toHaveBeenCalledWith(
    expect.objectContaining({
      conditions: ['Asthma'],
      allergies: [expect.objectContaining({ name: 'Latex', type: 'drug', severity: 'moderate' })],
      medications: [],
    })
  );
});

test('a removed condition is removed from what is saved', async () => {
  renderWithProviders(<EditProfilePage />, { user: PATIENT_USER, route: '/patient/profile/edit?tab=medical' });

  fireEvent.click(await screen.findByRole('button', { name: 'Remove Medical Conditions 1' }));
  save();

  await screen.findByText('Profile Updated!');
  expect(updateHealth).toHaveBeenCalledWith(expect.objectContaining({ conditions: [] }));
});

test('opens the tab from ?tab= and shows backend validation errors, keeping the form', async () => {
  updateProfile.mockRejectedValue(apiError(422, { errors: { emergency_contact_phone: ['The emergency contact phone is too long.'] } }));
  renderWithProviders(<EditProfilePage />, { user: PATIENT_USER, route: '/patient/profile/edit?tab=emergency' });

  const field = await screen.findByLabelText('Contact Phone');
  fireEvent.change(field, { target: { value: '1'.repeat(25) } });
  save();

  expect(await screen.findByText('The emergency contact phone is too long.')).toBeInTheDocument();
  expect(field).toHaveValue('1'.repeat(25));
  expect(updateHealth).not.toHaveBeenCalled();
});

test('a photo must be a small image before it is sent', async () => {
  uploadProfilePhoto.mockResolvedValue({});
  expect(checkPhoto({ type: 'image/svg+xml', size: 100 })).toMatch(/JPG, PNG or WebP/);
  expect(checkPhoto({ type: 'image/png', size: 3 * 1024 * 1024 })).toMatch(/smaller than 2 MB/);
  expect(checkPhoto({ type: 'image/png', size: 100 })).toBe('');

  renderWithProviders(<EditProfilePage />, { user: PATIENT_USER });
  const input = await screen.findByLabelText('Upload new photo', { selector: 'input' });

  fireEvent.change(input, { target: { files: [new File(['x'], 'page.svg', { type: 'image/svg+xml' })] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('Choose a JPG, PNG or WebP image.');
  expect(uploadProfilePhoto).not.toHaveBeenCalled();

  const photo = new File(['x'], 'me.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [photo] } });
  await waitFor(() => expect(uploadProfilePhoto).toHaveBeenCalled());
  expect(uploadProfilePhoto.mock.calls[0][0]).toBe(photo);
});
