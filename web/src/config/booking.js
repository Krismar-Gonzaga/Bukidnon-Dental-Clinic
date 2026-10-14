// Steps of the patient booking flow, in Figma order.
export const BOOKING_STEPS = [
  { id: 'clinic', label: 'Clinic', title: 'Select a Clinic', nextLabel: 'Next: Select Dentist' },
  { id: 'dentist', label: 'Dentist', title: 'Select a Dentist', nextLabel: 'Next: Select Service' },
  { id: 'service', label: 'Service', title: 'Select a Service', nextLabel: 'Next: Schedule' },
  { id: 'schedule', label: 'Schedule', title: 'Choose Date & Time', nextLabel: 'Review Booking' },
  { id: 'confirm', label: 'Confirm', title: 'Review Your Booking', nextLabel: 'Confirm Appointment' },
];

// PROVISIONAL arrival note from the Figma sample; clinics may set their own later.
export const BOOKING_ARRIVAL_NOTICE =
  'Please arrive 10 minutes before your scheduled time. You will receive a reminder notification 24 hours before your appointment.';

// PROVISIONAL request-sent copy from the Figma sample.
export const BOOKING_SUBMITTED_MESSAGE =
  "Your request has been submitted. The clinic will review and confirm your appointment — you'll receive a notification once it's approved.";

export const BOOKING_APPROVAL_NOTICE =
  'The clinic or dentist must approve your request before it is confirmed. Check your appointment history for status updates.';
