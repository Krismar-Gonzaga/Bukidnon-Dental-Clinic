import { toAppointment, toClinicProfile, toClinicSummary, toNotification } from './services/adapters';

// API-shaped sample data run through the real adapters, so page tests also
// cover the API → UI mapping. Not real people or clinics.

export const apiAppointment = (overrides = {}) => ({
  id: 12,
  status: 'pending',
  starts_at: '2026-11-03T09:00:00+08:00',
  ends_at: '2026-11-03T09:30:00+08:00',
  appointment_date: '2026-11-03',
  appointment_time: '09:00',
  reason: 'Cleaning',
  notes: null,
  cancellation_reason: null,
  requested_starts_at: null,
  clinic: { id: 7, name: 'Valencia Smiles', address: 'Purok 1, Valencia City, Bukidnon', contact_number: '09170000000' },
  branch: { id: 3, name: 'Main Branch', address: 'Purok 1, Valencia City' },
  dentist: { id: 5, name: 'Dr. Maria Santos' },
  service: { id: 9, name: 'Dental Cleaning', price: '800.00', currency: 'PHP', duration_minutes: 30 },
  has_review: false,
  status_history: [{ from: null, to: 'pending', reason: null, at: '2026-11-01T10:00:00+08:00' }],
  ...overrides,
});

export const appointment = (overrides) => toAppointment(apiAppointment(overrides));

export const apiClinic = (overrides = {}) => ({
  id: 7,
  name: 'Valencia Smiles',
  description: 'Family dental care.',
  address: 'Purok 1',
  full_address: 'Purok 1, Valencia City, Bukidnon',
  city: 'Valencia City',
  province: 'Bukidnon',
  contact_number: '09170000000',
  email: 'hello@valenciasmiles.example',
  rating: '4.5',
  review_count: 2,
  is_verified: true,
  latitude: 7.906,
  longitude: 125.094,
  specializations: [{ id: 1, name: 'General Dentistry' }],
  branches: [
    {
      id: 3,
      name: 'Main Branch',
      address: 'Purok 1',
      city: 'Valencia City',
      is_main: true,
      operating_hours: [1, 2, 3, 4, 5, 6].map((day) => ({ day_of_week: day, opens_at: '08:00', closes_at: '17:00' })),
    },
  ],
  services: [{ id: 9, name: 'Dental Cleaning', description: 'Prophylaxis', price: '800.00', currency: 'PHP', duration_minutes: 30, is_available: true }],
  dentists: [{ id: 5, name: 'Dr. Maria Santos', specialization: 'General Dentistry', years_experience: 8, is_active: true }],
  reviews: [{ id: 1, rating: 5, comment: 'Very gentle.', patient_name: 'Juan D.', is_verified_visit: true, status: 'approved', date: '2026-10-01' }],
  rating_breakdown: { 5: 1 },
  ...overrides,
});

export const clinicProfile = (overrides) => toClinicProfile(apiClinic(overrides));
export const clinicSummary = (overrides) => toClinicSummary(apiClinic(overrides));

export const notification = (overrides = {}) =>
  toNotification({
    id: 'n-1',
    kind: 'appointment',
    title: 'Appointment confirmed',
    message: 'Your appointment at Valencia Smiles is confirmed.',
    resource: { type: 'appointment', id: 12 },
    read_at: null,
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    ...overrides,
  });

export const emptyNotifications = { notifications: [], unreadCount: 0, pageCount: 1 };
