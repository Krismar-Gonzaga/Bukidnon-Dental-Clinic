// Profile form choices. PROVISIONAL until the backend defines the allowed values.
export const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say'];
export const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Separated'];
export const BLOOD_TYPE_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Profile sections, in Figma order. editLabel is the shorter tab label on Edit Profile.
export const PROFILE_TABS = [
  { id: 'overview', label: 'Overview', editLabel: 'Personal', icon: 'user' },
  { id: 'medical', label: 'Medical History', editLabel: 'Medical History', icon: 'clipboardList' },
  { id: 'allergies', label: 'Allergies & Medications', editLabel: 'Allergies & Meds', icon: 'shield' },
  { id: 'emergency', label: 'Emergency Contact', editLabel: 'Emergency Contact', icon: 'phone' },
];

// Allergy severity labels and chip tones, from the Figma sample.
export const ALLERGY_SEVERITIES = {
  severe: { label: 'Severe', tone: 'danger' },
  moderate: { label: 'Moderate', tone: 'warning' },
  mild: { label: 'Mild', tone: 'success' },
};

// Dental anxiety is shown on a 5-step bar (Figma).
export const ANXIETY_SCALE_MAX = 5;

// PROVISIONAL consent settings from the Figma Emergency Contact tab, in order.
export const CONSENT_OPTIONS = [
  { id: 'smsReminders', label: 'SMS appointment reminders' },
  { id: 'emailFollowUp', label: 'Email follow-up after procedures' },
  { id: 'shareMedicalHistory', label: 'Share medical history with attending dentist' },
  {
    id: 'emergencyContactConsent',
    label: 'Allow clinic to contact emergency contact for major procedures',
  },
  { id: 'promotions', label: 'Promotional offers and dental health tips' },
];

// PROVISIONAL copy from the Figma success screens.
export const PROFILE_UPDATED_TITLE = 'Profile Updated!';
export const PROFILE_UPDATED_MESSAGE = 'Your profile information has been successfully saved.';
export const PASSWORD_CHANGED_TITLE = 'Password Changed!';
export const PASSWORD_CHANGED_MESSAGE = 'Your password has been updated successfully.';

// Matches the backend rule for POST /change-password (Password::min(8)).
export const PASSWORD_MIN_LENGTH = 8;
