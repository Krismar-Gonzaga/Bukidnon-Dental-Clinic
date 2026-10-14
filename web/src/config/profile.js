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

export const PROFILE_NOT_CONNECTED_NOTICE =
  'Saving your profile is not connected yet. Your changes were not saved.';
