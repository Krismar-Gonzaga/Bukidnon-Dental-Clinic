// MOCK appointment history from the Figma sample, newest first. Not real
// patient data; replace with the patient appointments API response later.
// status: pending | upcoming | completed | cancelled
// reference: display number shown as "Appointment #000006"
export const MOCK_APPOINTMENT_HISTORY = [
  {
    id: 'hist-1',
    reference: '000006',
    service: 'Root Canal Treatment',
    dentist: 'Dr. Laura Reyes',
    clinic: 'Don Carlos Dental Clinic',
    status: 'pending',
    date: 'July 25, 2026',
    time: '9:00 AM',
  },
  {
    id: 'hist-2',
    reference: '000005',
    service: 'Braces Consultation',
    dentist: 'Dr. Maria Braganza',
    clinic: 'Braganza Dental Clinic',
    status: 'upcoming',
    date: 'July 22, 2026',
    time: '10:00 AM',
  },
  {
    id: 'hist-3',
    reference: '000004',
    service: 'Dental Cleaning',
    dentist: 'Dr. Jose Santos',
    clinic: 'Valencia Smile Center',
    status: 'completed',
    date: 'July 10, 2026',
    time: '2:00 PM',
  },
  {
    id: 'hist-4',
    reference: '000003',
    service: 'Teeth Whitening',
    dentist: 'Dr. Ana Cruz',
    clinic: 'Malaybalay Dental Arts',
    status: 'completed',
    date: 'June 28, 2026',
    time: '11:00 AM',
  },
  {
    id: 'hist-5',
    reference: '000002',
    service: 'Tooth Extraction',
    dentist: 'Dr. Ramon Villanueva',
    clinic: 'Maramag Dental Hub',
    status: 'cancelled',
    date: 'June 15, 2026',
    time: '9:00 AM',
  },
  {
    id: 'hist-6',
    reference: '000001',
    service: 'Dental Cleaning',
    dentist: 'Dr. Maria Braganza',
    clinic: 'Braganza Dental Clinic',
    status: 'completed',
    date: 'May 30, 2026',
    time: '3:00 PM',
  },
];

export const findMockAppointment = (id) =>
  MOCK_APPOINTMENT_HISTORY.find((appointment) => appointment.id === id);
