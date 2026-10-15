import { fireEvent, screen } from '@testing-library/react';
import ProfilePage from './ProfilePage';
import { getMedicalHistory, getPatientDashboard, getProfile, getSharedRecords } from '../services/patientApi';
import { getNotifications } from '../services/notificationApi';
import { PATIENT_USER, renderWithProviders } from '../testUtils';
import { emptyNotifications } from '../testFixtures';

jest.mock('../services/patientApi');
jest.mock('../services/notificationApi');

const PROFILE = {
  name: 'Juan Dela Cruz',
  email: 'juan@example.com',
  phone: '09171234567',
  address: 'Sayre Highway, Valencia City',
  birthDate: '1995-03-15',
  gender: 'Male',
  emergencyContactName: 'Maria Dela Cruz',
  emergencyContactPhone: '09170000000',
  emailNotifications: true,
};

beforeEach(() => {
  getNotifications.mockResolvedValue(emptyNotifications);
  getProfile.mockResolvedValue(PROFILE);
  getPatientDashboard.mockResolvedValue({ name: 'Juan', upcoming: [], counts: { upcoming: 1, pending: 0, completed: 3, saved_clinics: 2, reviews_given: 1 } });
  getMedicalHistory.mockResolvedValue([
    { clinic: 'Valencia Smiles', allergies: 'Penicillin', medications: 'Amlodipine 5mg', conditions: 'Hypertension', recordedAt: 'October 1, 2026' },
  ]);
  getSharedRecords.mockResolvedValue([
    { id: '1', clinic: 'Valencia Smiles', dentist: 'Dr. Maria Santos', type: 'treatment', procedures: 'Scaling', careInstructions: 'Floss nightly.', date: 'October 1, 2026' },
  ]);
});

test('shows personal details, contact details and activity from the API', async () => {
  renderWithProviders(<ProfilePage />, { user: PATIENT_USER });

  expect(await screen.findByRole('heading', { level: 2, name: 'Juan Dela Cruz' })).toBeInTheDocument();
  expect(screen.getByText('March 15, 1995')).toBeInTheDocument();
  expect(screen.getByText('Sayre Highway, Valencia City')).toBeInTheDocument();
  expect(await screen.findByText('Reviews Submitted')).toBeInTheDocument();
});

test('medical tabs show what clinics recorded, read-only', async () => {
  renderWithProviders(<ProfilePage />, { user: PATIENT_USER });
  await screen.findByRole('heading', { level: 2, name: 'Juan Dela Cruz' });

  fireEvent.click(screen.getByRole('tab', { name: 'Allergies & Medications' }));
  expect(await screen.findByText('Penicillin')).toBeInTheDocument();
  expect(screen.getByText('Amlodipine 5mg')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /Edit Valencia Smiles/ })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: 'Medical History' }));
  expect(await screen.findByText('Hypertension')).toBeInTheDocument();
  expect(await screen.findByText('Floss nightly.')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('tab', { name: 'Emergency Contact' }));
  expect(screen.getByText('Maria Dela Cruz')).toBeInTheDocument();
});
