// Main site navigation.
export const MAIN_NAV_ITEMS = [
  { label: 'Home', href: '/' },
  { label: 'Find Clinics', href: '/clinics' },
  { label: 'Dentists', href: '/dentists' },
  { label: 'Services', href: '/services' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
];

// Account pages.
export const LOGIN_HREF = '/login';
export const REGISTER_HREF = '/register';
export const FORGOT_PASSWORD_HREF = '/forgot-password';
export const RESET_PASSWORD_HREF = '/reset-password';
export const PRIVACY_HREF = '/privacy';
export const TERMS_HREF = '/terms';

// Public clinic pages.
export const FIND_CLINICS_HREF = '/clinics';
export const SERVICES_HREF = '/services';
export const getPublicClinicHref = (clinicId) => `${FIND_CLINICS_HREF}/${encodeURIComponent(clinicId)}`;

/** Login page that returns to `next` (a same-site path) after signing in. */
export const getLoginHref = (next) => (next ? `${LOGIN_HREF}?next=${encodeURIComponent(next)}` : LOGIN_HREF);
