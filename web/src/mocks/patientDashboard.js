// MOCK patient dashboard data from the Figma sample content.
// Not real backend data; replace with the patient API responses later.
export const MOCK_PATIENT = {
  name: 'Juan Dela Cruz',
  role: 'Patient',
};

export const MOCK_DASHBOARD_STATS = [
  { id: 'upcoming', label: 'Upcoming', value: 1, icon: 'calendarBlank', tone: 'blue' },
  { id: 'completed', label: 'Completed', value: 3, icon: 'checkCircle', tone: 'green' },
  { id: 'saved', label: 'Saved Clinics', value: 3, icon: 'heart', tone: 'red' },
  { id: 'reviews', label: 'Reviews Given', value: 2, icon: 'star', tone: 'amber' },
];

// status: 'pending' (awaiting clinic approval) or 'confirmed'
export const MOCK_DASHBOARD_APPOINTMENTS = [
  {
    id: 'apt-1',
    service: 'Root Canal Treatment',
    dentist: 'Dr. Laura Reyes',
    clinic: 'Don Carlos Dental Clinic',
    status: 'pending',
    dateTime: 'July 25, 2026 at 9:00 AM',
  },
  {
    id: 'apt-2',
    service: 'Braces Consultation',
    dentist: 'Dr. Maria Braganza',
    clinic: 'Braganza Dental Clinic',
    status: 'confirmed',
    dateTime: 'July 22, 2026 at 10:00 AM',
  },
];

export const MOCK_DASHBOARD_NOTIFICATIONS = [
  { id: 'n-1', title: 'Appointment Reminder', time: '2 hours ago', unread: true },
  { id: 'n-2', title: 'Booking Confirmed', time: '1 day ago', unread: true },
  { id: 'n-3', title: 'New Review Request', time: '3 days ago', unread: false },
];
