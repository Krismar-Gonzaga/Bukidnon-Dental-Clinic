// Appointment statuses shown to patients, in Figma filter order.
export const APPOINTMENT_STATUSES = [
  { id: 'pending', label: 'Pending' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

export const ALL_APPOINTMENTS_FILTER = { id: 'all', label: 'All' };

export const APPOINTMENT_FILTERS = [ALL_APPOINTMENTS_FILTER, ...APPOINTMENT_STATUSES];

export const getAppointmentStatusLabel = (statusId) =>
  APPOINTMENT_STATUSES.find(({ id }) => id === statusId)?.label ?? statusId;

// PROVISIONAL patient-facing copy from the Figma appointment details screens.
export const PENDING_APPROVAL_TITLE = 'Awaiting Clinic Approval';
export const PENDING_APPROVAL_TEXT =
  'Your appointment request has been submitted. The clinic admin, dentist, or staff will review and confirm your schedule.';

export const getCancelAppointmentMessage = (dentist) =>
  `Are you sure you want to cancel your appointment with ${dentist}? This action cannot be undone.`;

// Patients may cancel only before the visit; pending requests say "Request".
export const CANCELLABLE_STATUSES = ['pending', 'upcoming'];
export const RESCHEDULABLE_STATUSES = ['upcoming'];

// PROVISIONAL copy from the Figma reschedule screens.
export const RESCHEDULED_TITLE = 'Appointment Rescheduled!';
export const RESCHEDULED_MESSAGE =
  'Your appointment has been updated. A new confirmation has been sent to your email.';
