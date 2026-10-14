// Sign-in options on the login page, one per signed-in role in the project
// requirements. `variant` selects the button style in LoginForm.css.
// Ids are frontend-only; map them to backend role values during integration.
export const SIGN_IN_ROLES = [
  { id: 'patient', label: 'Patient', icon: null, variant: 'patient' },
  {
    id: 'clinic-admin',
    label: 'Clinic Admin',
    icon: 'building',
    variant: 'clinic-admin',
  },
  { id: 'dentist', label: 'Dentist', icon: 'stethoscope', variant: 'dentist' },
  {
    id: 'clinic-staff',
    label: 'Clinic Staff',
    icon: 'userCheck',
    variant: 'clinic-staff',
  },
  {
    id: 'system-admin',
    label: 'System Admin',
    icon: 'shield',
    variant: 'system-admin',
  },
];

// Roles that can self-register. Dentists and clinic staff are invited by a
// clinic administrator, per the Figma register page.
export const REGISTER_ROLES = [
  { id: 'patient', label: 'Patient', icon: 'user' },
  { id: 'clinic-admin', label: 'Clinic Admin', icon: 'briefcaseMedical' },
];

// Placeholder hrefs until these pages exist.
export const FORGOT_PASSWORD_HREF = '#forgot-password';
export const TERMS_HREF = '#terms';
export const PRIVACY_HREF = '#privacy';
