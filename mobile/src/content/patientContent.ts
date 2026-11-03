// Labels and PROVISIONAL copy for the patient screens: the same text as the website
// (web/src/config/profile.js, booking.js, appointments.js).
export const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
export const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Separated'];
export const BLOOD_TYPE_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export const ALLERGY_TYPES = [
  { value: 'drug', label: 'Drug' },
  { value: 'food', label: 'Food' },
  { value: 'material', label: 'Material' },
  { value: 'other', label: 'Other' },
];

export const ALLERGY_SEVERITIES = [
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
];

export const ANXIETY_LEVELS = ['Minimal', 'Mild', 'Moderate', 'High', 'Severe'];

// The patient's own words, with an optional note. Nothing here is a clinical judgement.
export const VITAL_FIELDS = [
  { id: 'blood_pressure', label: 'Blood Pressure', placeholder: '130/85 mmHg' },
  { id: 'blood_sugar', label: 'Blood Sugar (FBS)', placeholder: '6.8 mmol/L' },
  { id: 'heart_condition', label: 'Heart Condition', placeholder: 'None reported' },
  { id: 'pregnancy', label: 'Pregnancy', placeholder: 'N/A' },
  { id: 'bleeding_disorder', label: 'Bleeding Disorder', placeholder: 'None reported' },
  { id: 'recent_surgery', label: 'Recent Surgery', placeholder: 'None in past 6 months' },
];

// "SMS" from the design is an email setting: the platform sends email and in-app
// reminders, not SMS.
export const CONSENT_OPTIONS = [
  { id: 'emailReminders', label: 'Email appointment reminders' },
  { id: 'email_follow_up', label: 'Email follow-up after procedures' },
  { id: 'share_medical_history', label: 'Share medical history with attending dentist' },
  { id: 'emergency_contact_consent', label: 'Allow clinic to contact emergency contact for major procedures' },
  { id: 'promotions', label: 'Promotional offers and dental health tips' },
];

export const CONDITIONS_NOTICE =
  'Patients with hypertension or diabetes may require special precautions during dental procedures. Always inform your dentist about these conditions.';

export const CLINIC_RECORDED_NOTE =
  'Recorded by your clinic during visits. To correct something, tell your dentist at your next appointment.';

export const BOOKING_STEPS = [
  { id: 'clinic', label: 'Clinic', title: 'Select a Clinic', nextLabel: 'Next: Select Dentist' },
  { id: 'dentist', label: 'Dentist', title: 'Select a Dentist', nextLabel: 'Next: Select Service' },
  { id: 'service', label: 'Service', title: 'Select a Service', nextLabel: 'Next: Schedule' },
  { id: 'schedule', label: 'Schedule', title: 'Choose Date & Time', nextLabel: 'Review Booking' },
  { id: 'confirm', label: 'Confirm', title: 'Review Your Booking', nextLabel: 'Confirm Appointment' },
];

export const BOOKING_ARRIVAL_NOTICE =
  'Please arrive 10 minutes before your scheduled time. You will receive a reminder notification 24 hours before your appointment.';
export const BOOKING_SUBMITTED_MESSAGE =
  "Your request has been submitted. The clinic will review and confirm your appointment — you'll receive a notification once it's approved.";
export const BOOKING_APPROVAL_NOTICE =
  'The clinic or dentist must approve your request before it is confirmed. Check your appointment history for status updates.';
export const BOOKING_QUEUED_MESSAGE =
  "Your connection dropped, so the request is saved and will be sent automatically. It isn't booked until the clinic confirms it, and the time may no longer be free.";

export const PENDING_APPROVAL_TITLE = 'Awaiting Clinic Approval';
export const PENDING_APPROVAL_TEXT =
  'Your appointment request has been submitted. The clinic admin, dentist, or staff will review and confirm your schedule.';

export const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
