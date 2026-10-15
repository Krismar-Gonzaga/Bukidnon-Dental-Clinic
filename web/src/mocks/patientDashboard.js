// MOCK patient dashboard data from the Figma sample content.
// Not real backend data; replace with the patient API responses later.
import { PATIENT_DASHBOARD_HREF } from '../config/patientNavigation';
import { MOCK_NOTIFICATIONS } from './notifications';

export const MOCK_PATIENT = {
  name: 'Juan Dela Cruz',
  role: 'Patient',
};

// Signed-in account shown in the public site header ("My Account").
export const MOCK_PATIENT_ACCOUNT = { name: MOCK_PATIENT.name, href: PATIENT_DASHBOARD_HREF };

export const MOCK_DASHBOARD_STATS = [
  { id: 'upcoming', label: 'Upcoming', value: 1, icon: 'calendarBlank', tone: 'blue' },
  { id: 'completed', label: 'Completed', value: 3, icon: 'checkCircle', tone: 'green' },
  { id: 'saved', label: 'Saved Clinics', value: 3, icon: 'heart', tone: 'red' },
  { id: 'reviews', label: 'Reviews Given', value: 2, icon: 'star', tone: 'amber' },
];

// status: 'pending' (awaiting clinic approval) or 'confirmed'
// id: the matching appointment in mocks/appointmentHistory.js, so View and
// Reschedule open its pages.
export const MOCK_DASHBOARD_APPOINTMENTS = [
  {
    id: 'hist-1',
    service: 'Root Canal Treatment',
    dentist: 'Dr. Laura Reyes',
    clinic: 'Don Carlos Dental Clinic',
    status: 'pending',
    dateTime: 'July 25, 2026 at 9:00 AM',
  },
  {
    id: 'hist-2',
    service: 'Braces Consultation',
    dentist: 'Dr. Maria Braganza',
    clinic: 'Braganza Dental Clinic',
    status: 'confirmed',
    dateTime: 'July 22, 2026 at 10:00 AM',
  },
];

// The dashboard panel shows the three newest notifications.
export const MOCK_DASHBOARD_NOTIFICATIONS = MOCK_NOTIFICATIONS.slice(0, 3);
