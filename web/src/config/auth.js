import { FORGOT_PASSWORD_HREF as FORGOT_HREF, PRIVACY_HREF as PRIVACY, TERMS_HREF as TERMS } from './navigation';

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
