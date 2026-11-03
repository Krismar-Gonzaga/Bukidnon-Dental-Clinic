// Matches the backend's allowed values (male | female | other).
export const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
export const CIVIL_STATUS_OPTIONS = ['Single', 'Married', 'Widowed', 'Separated'];
export const BLOOD_TYPE_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Profile sections, in Figma order. editLabel is the shorter tab label on Edit Profile.
export const PROFILE_TABS = [
  { id: 'overview', label: 'Overview', editLabel: 'Personal', icon: 'user' },
  { id: 'medical', label: 'Medical History', editLabel: 'Medical History', icon: 'clipboardList' },
  { id: 'allergies', label: 'Allergies & Medications', editLabel: 'Allergies & Meds', icon: 'shield' },
  { id: 'emergency', label: 'Emergency Contact', editLabel: 'Emergency Contact', icon: 'phone' },
];

export const ALLERGY_TYPES = [
  { value: 'drug', label: 'Drug' },
  { value: 'food', label: 'Food' },
  { value: 'material', label: 'Material' },
  { value: 'other', label: 'Other' },
];

// Allergy severity labels and chip tones, from the Figma sample.
export const ALLERGY_SEVERITIES = {
  severe: { label: 'Severe', tone: 'danger' },
  moderate: { label: 'Moderate', tone: 'warning' },
  mild: { label: 'Mild', tone: 'success' },
};

// Dental anxiety is shown on a 5-step bar (Figma).
export const ANXIETY_SCALE_MAX = 5;
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

// Consent switches from the Figma Emergency Contact tab, in order. "SMS" from the design
// is an email setting: the platform sends email and in-app reminders, not SMS.
export const CONSENT_OPTIONS = [
  { id: 'emailReminders', label: 'Email appointment reminders' },
  { id: 'email_follow_up', label: 'Email follow-up after procedures' },
  { id: 'share_medical_history', label: 'Share medical history with attending dentist' },
  { id: 'emergency_contact_consent', label: 'Allow clinic to contact emergency contact for major procedures' },
  { id: 'promotions', label: 'Promotional offers and dental health tips' },
];

export const CONDITIONS_NOTICE =
  'Patients with hypertension or diabetes may require special precautions during dental procedures. Always inform your dentist about these conditions.';

// PROVISIONAL copy from the Figma success screens.
export const PROFILE_UPDATED_TITLE = 'Profile Updated!';
export const PROFILE_UPDATED_MESSAGE = 'Your profile information has been successfully saved.';
export const PASSWORD_CHANGED_TITLE = 'Password Changed!';
export const PASSWORD_CHANGED_MESSAGE = 'Your password has been updated successfully.';

// Matches the backend rule for POST /change-password (Password::min(8)).
export const PASSWORD_MIN_LENGTH = 8;

// Matches the backend rule for POST /patient/profile/photo.
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
