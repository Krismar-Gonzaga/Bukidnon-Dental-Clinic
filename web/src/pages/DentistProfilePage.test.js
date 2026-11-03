import { screen } from '@testing-library/react';
import DentistProfilePage, { workingHours } from './DentistProfilePage';
import { getDentist } from '../services/publicApi';
import { toDentistCard } from '../services/adapters';
import { apiError, renderWithProviders } from '../testUtils';

jest.mock('../services/publicApi');

const DENTIST = toDentistCard({
  id: 5,
  name: 'Dr. Maria Braganza',
  specialization: 'Orthodontist',
  bio: 'Specializes in braces.',
  qualifications: 'UST College of Dentistry',
  years_experience: 12,
  rating: 4.9,
  review_count: 87,
  is_available: true,
  schedules: [1, 2, 3, 4, 5].map((day) => ({ branch_id: 1, day_of_week: day, starts_at: '09:00', ends_at: '17:00' })),
  clinics: [{ id: 7, name: 'Braganza Dental Clinic', city: 'Valencia City', address: 'Sayre Highway, Valencia City, Bukidnon' }],
});

test('shows the profile, credentials, hours and clinic; guests sign in to book that dentist', async () => {
  getDentist.mockResolvedValue(DENTIST);
  renderWithProviders(<DentistProfilePage dentistId="5" />);

  expect(await screen.findByRole('heading', { level: 1, name: 'Dr. Maria Braganza' })).toBeInTheDocument();
  expect(screen.getByText('Accepting Patients')).toBeInTheDocument();
  expect(screen.getByText('Orthodontist · Braganza Dental Clinic')).toBeInTheDocument();
  expect(screen.getByText(/4\.9 \(87 reviews\)/)).toBeInTheDocument();
  expect(screen.getByText('UST College of Dentistry')).toBeInTheDocument();
  expect(screen.getByText('12 years')).toBeInTheDocument();
  expect(screen.getByText('Mon–Fri')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View Braganza Dental Clinic' })).toHaveAttribute('href', '/clinics/7');
  expect(screen.getByRole('link', { name: 'Book Appointment' })).toHaveAttribute('href', '/login?next=%2Fpatient%2Fbook%3Fclinic%3D7%26dentist%3D5');
});

test('patients book directly; a dentist with no clinic has no booking button', async () => {
  getDentist.mockResolvedValue(DENTIST);
  const { unmount } = renderWithProviders(<DentistProfilePage dentistId="5" />, { user: { id: 1, name: 'Juan', role: 'patient', memberships: [] } });
  expect(await screen.findByRole('link', { name: 'Book Appointment' })).toHaveAttribute('href', '/patient/book?clinic=7&dentist=5');
  unmount();

  getDentist.mockResolvedValue({ ...DENTIST, clinics: [] });
  renderWithProviders(<DentistProfilePage dentistId="6" />);
  await screen.findByRole('heading', { level: 1, name: 'Dr. Maria Braganza' });
  expect(screen.queryByRole('link', { name: 'Book Appointment' })).not.toBeInTheDocument();
});

test('an unlisted dentist shows the error with a way back', async () => {
  getDentist.mockRejectedValue(apiError(404, { message: 'Not found.' }));
  renderWithProviders(<DentistProfilePage dentistId="9" />);
  expect(await screen.findByRole('link', { name: 'Back to Dentists' })).toHaveAttribute('href', '/dentists');
});

test('working hours merge matching days and show closed days', () => {
  expect(workingHours([{ day_of_week: 1, starts_at: '09:00', ends_at: '12:00' }, { day_of_week: 1, starts_at: '13:00', ends_at: '17:00' }, { day_of_week: 2, starts_at: '09:00', ends_at: '17:00' }])).toEqual([
    { days: 'Mon–Tue', text: '9:00 AM – 5:00 PM' },
    { days: 'Wed–Sun', text: 'Closed' },
  ]);
});
