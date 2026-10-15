import { PATIENT_DASHBOARD_HREF } from './patientNavigation';

// Sign-in options on the login page, one per signed-in role in the project
// requirements. `variant` selects the button style in LoginForm.css.
// `backendRole` is the matching `users.role` value in the Laravel API.
// `homeHref` is where a signed-in user lands; null until that role's web
// portal exists.
export const SIGN_IN_ROLES = [
  {
    id: 'patient',
    label: 'Patient',
    icon: null,
    variant: 'patient',
    backendRole: 'patient',
    homeHref: PATIENT_DASHBOARD_HREF,
  },
  {
    id: 'clinic-admin',
    label: 'Clinic Admin',
    icon: 'building',
    variant: 'clinic-admin',
    backendRole: 'clinic_admin',
    homeHref: null,
  },
  {
    id: 'dentist',
    label: 'Dentist',
    icon: 'stethoscope',
    variant: 'dentist',
    backendRole: 'dentist',
    homeHref: null,
  },
  {
    id: 'clinic-staff',
    label: 'Clinic Staff',
    icon: 'userCheck',
    variant: 'clinic-staff',
    backendRole: 'staff',
    homeHref: null,
  },
  {
    id: 'system-admin',
    label: 'System Admin',
    icon: 'shield',
    variant: 'system-admin',
    backendRole: 'system_admin',
    homeHref: null,
  },
];

// Roles that can self-register. Dentists and clinic staff are invited by a
// clinic administrator, per the Figma register page. The backend accepts
// only these two roles on POST /register.
export const REGISTER_ROLES = [
  {
    id: 'patient',
    label: 'Patient',
    icon: 'user',
    backendRole: 'patient',
    homeHref: PATIENT_DASHBOARD_HREF,
  },
  {
    id: 'clinic-admin',
    label: 'Clinic Admin',
    icon: 'briefcaseMedical',
    backendRole: 'clinic_admin',
    homeHref: null,
  },
];

// Placeholder hrefs until these pages exist.
export const FORGOT_PASSWORD_HREF = '#forgot-password';
export const TERMS_HREF = '#terms';
export const PRIVACY_HREF = '#privacy';
