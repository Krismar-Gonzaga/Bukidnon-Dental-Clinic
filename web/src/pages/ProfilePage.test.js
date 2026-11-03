import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import ProfilePage from './ProfilePage';
import { getMedicalHistory, getPatientDashboard, getProfile, getSharedRecords, updateConsents } from '../services/patientApi';
import { getNotifications, updateNotificationPreferences } from '../services/notificationApi';
import { PATIENT_USER, renderWithProviders } from '../testUtils';
import { emptyNotifications } from '../testFixtures';
import { getMedicalAlerts, getProfileChips, joinName, splitName } from '../utils/profile';

jest.mock('../services/patientApi');
jest.mock('../services/notificationApi');

const HEALTH = {
  conditions: ['Hypertension'],
  procedures: [{ name: 'Tooth Extraction', detail: 'Lower right molar (#47)', date: 'March 2024', note: 'No complications' }],
  vitals: { blood_pressure: { value: '130/85 mmHg', note: 'Elevated' }, heart_condition: { value: 'None reported' } },
  allergies: [{ name: 'Penicillin', type: 'drug', severity: 'severe', reaction: 'Hives' }],
  medications: [{ name: 'Amlodipine', dosage: '5mg', purpose: 'Hypertension', note: 'May cause gingival enlargement' }],
  anxiety: { level: 3, sedation: 'Local anesthesia only', notes: 'Sensitive to needles' },
};

const PROFILE = {
  name: 'Juan Dela Cruz',
  email: 'juan@example.com',
  phone: '09171234567',
  address: 'Sayre Highway',
  birthDate: '1995-03-15',
  gender: 'Male',
  civilStatus: 'Single',
  bloodType: 'O+',
  city: 'Valencia City',
  province: 'Bukidnon',
  zipCode: '8709',
  emergencyContactName: 'Maria Dela Cruz',
  emergencyContactPhone: '09170000000',
  emergencyContactRelationship: 'Mother',
  emergencyContactAddress: 'Purok 5, Valencia City',
  photoVersion: null,
  health: HEALTH,
  consents: { share_medical_history: true, promotions: false },
  emailNotifications: true,
};

beforeEach(() => {
  getNotifications.mockResolvedValue(emptyNotifications);
  getProfile.mockResolvedValue(PROFILE);
  getPatientDashboard.mockResolvedValue({
    name: 'Juan',
    upcoming: [],
    counts: { total: 6, upcoming: 1, pending: 0, completed: 3, saved_clinics: 2, reviews_given: 2 },
  });
  getMedicalHistory.mockResolvedValue([
    { clinic: 'Valencia Smiles', allergies: 'Latex', medications: '', conditions: 'Asthma', recordedAt: 'Oct 1, 2026' },
  ]);
  getSharedRecords.mockResolvedValue([
    { id: '1', clinic: 'Valencia Smiles', dentist: 'Dr. Maria Santos', type: 'treatment', procedures: 'Scaling', careInstructions: 'Rinse', date: 'Oct 1, 2026' },
  ]);
});

const open = async () => {
  renderWithProviders(<ProfilePage />, { user: PATIENT_USER });
  await screen.findByRole('heading', { level: 2, name: 'Juan Dela Cruz' });
};

test('the header sums up the patient and warns about what matters to a dentist', async () => {
  await open();
  const summary = screen.getByRole('list', { name: 'Health summary' });
  expect(within(summary).getByText('O+')).toBeInTheDocument();
  expect(within(summary).getByText('Hypertension')).toBeInTheDocument();
  expect(within(summary).getByText('Penicillin Allergy')).toBeInTheDocument();
  expect(screen.getByRole('note', { name: 'Important medical alerts' })).toHaveTextContent(
    'Allergic to Penicillin · Taking Amlodipine (5mg) for hypertension · Hypertension — inform your dentist before any procedure.'
  );
});

test('overview shows personal details, contact details and activity from the API', async () => {
  await open();
  expect(screen.getByText('March 15, 1995')).toBeInTheDocument();
  expect(screen.getByText('Single')).toBeInTheDocument();
  expect(screen.getByText('8709')).toBeInTheDocument();
  expect(await screen.findByText('Total Appointments')).toBeInTheDocument();
  expect(screen.getByText('6')).toBeInTheDocument();
});

test('medical history shows the patient’s entries next to what clinics recorded', async () => {
  await open();
  fireEvent.click(screen.getByRole('tab', { name: 'Medical History' }));

  const panel = screen.getByRole('tabpanel');
  expect(within(panel).getByText('Tooth Extraction')).toBeInTheDocument();
  expect(within(panel).getByText('130/85 mmHg')).toBeInTheDocument();
  expect(within(panel).getByText('Elevated')).toBeInTheDocument();
  expect(await within(panel).findByText('Conditions: Asthma')).toBeInTheDocument();
  expect(await within(panel).findByText(/Scaling/)).toBeInTheDocument();
});

test('allergies tab shows severity, medications and the anxiety level', async () => {
  await open();
  fireEvent.click(screen.getByRole('tab', { name: 'Allergies & Medications' }));

  const panel = screen.getByRole('tabpanel');
  expect(within(panel).getByText('Severe')).toBeInTheDocument();
  expect(within(panel).getByText('Reaction: Hives')).toBeInTheDocument();
  expect(within(panel).getByText('May cause gingival enlargement')).toBeInTheDocument();
  expect(within(panel).getByText('Moderate')).toBeInTheDocument();
  expect(within(panel).getByRole('img', { name: 'Level 3 of 5' })).toBeInTheDocument();
});

test('consent switches save straight away; email reminders use the notification setting', async () => {
  updateConsents.mockResolvedValue({});
  updateNotificationPreferences.mockResolvedValue({});
  await open();
  fireEvent.click(screen.getByRole('tab', { name: 'Emergency Contact' }));

  expect(screen.getByRole('switch', { name: /Share medical history/ })).toBeChecked();
  expect(screen.queryByText(/SMS/)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('switch', { name: /Promotional offers/ }));
  await waitFor(() => expect(updateConsents).toHaveBeenCalledWith({ promotions: true }));

  await waitFor(() => expect(screen.getByRole('switch', { name: /Email appointment reminders/ })).toBeEnabled());
  fireEvent.click(screen.getByRole('switch', { name: /Email appointment reminders/ }));
  await waitFor(() => expect(updateNotificationPreferences).toHaveBeenCalledWith({ email: false }));
});

test('an empty profile shows no alerts or invented health details', async () => {
  getProfile.mockResolvedValue({
    ...PROFILE,
    bloodType: '',
    health: { conditions: [], procedures: [], vitals: {}, allergies: [], medications: [], anxiety: {} },
  });
  await open();
  expect(screen.queryByRole('note', { name: 'Important medical alerts' })).not.toBeInTheDocument();
  expect(screen.queryByRole('list', { name: 'Health summary' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: 'Allergies & Medications' }));
  expect(screen.getByText('No allergies added.')).toBeInTheDocument();
});

test('helpers', () => {
  expect(splitName('Maria Clara Santos')).toEqual({ firstName: 'Maria', lastName: 'Clara Santos' });
  expect(joinName(splitName('Maria Clara Santos'))).toBe('Maria Clara Santos');
  expect(joinName({ firstName: 'Cher', lastName: '' })).toBe('Cher');
  expect(getMedicalAlerts({ health: { allergies: [], medications: [], conditions: [] } })).toBe('');
  expect(getProfileChips({ bloodType: '', health: { allergies: [], conditions: [] } })).toEqual([]);
});
