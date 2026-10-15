import { FORGOT_PASSWORD_HREF as FORGOT_HREF, PRIVACY_HREF as PRIVACY, TERMS_HREF as TERMS } from './navigation';

// Sign-in options on the login page, one per signed-in role in the project
// requirements. `variant` selects the button style in LoginForm.css.
// `backendRole` is the matching `users.role` value in the Laravel API.
// After sign-in each role lands on its own portal (see auth/homeRoutes.js).
export const SIGN_IN_ROLES = [
  { id: 'patient', label: 'Patient', icon: null, variant: 'patient', backendRole: 'patient' },
  { id: 'clinic-admin', label: 'Clinic Admin', icon: 'building', variant: 'clinic-admin', backendRole: 'clinic_admin' },
  { id: 'dentist', label: 'Dentist', icon: 'stethoscope', variant: 'dentist', backendRole: 'dentist' },
  { id: 'clinic-staff', label: 'Clinic Staff', icon: 'userCheck', variant: 'clinic-staff', backendRole: 'staff' },
  { id: 'system-admin', label: 'System Admin', icon: 'shield', variant: 'system-admin', backendRole: 'system_admin' },
];

// Roles that can self-register. Dentists and clinic staff are invited by a
// clinic administrator, per the Figma register page. The backend accepts
// only these two roles on POST /register.
export const REGISTER_ROLES = [
  { id: 'patient', label: 'Patient', icon: 'user', backendRole: 'patient' },
  { id: 'clinic-admin', label: 'Clinic Admin', icon: 'briefcaseMedical', backendRole: 'clinic_admin' },
];

export const FORGOT_PASSWORD_HREF = FORGOT_HREF;
export const TERMS_HREF = TERMS;
export const PRIVACY_HREF = PRIVACY;
