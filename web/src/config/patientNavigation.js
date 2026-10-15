// Patient portal sidebar navigation, in Figma order.
export const PATIENT_DASHBOARD_HREF = '/patient/dashboard';
export const PATIENT_BOOK_HREF = '/patient/book';
export const PATIENT_HISTORY_HREF = '/patient/appointments';
export const PATIENT_NOTIFICATIONS_HREF = '/patient/notifications';
export const PATIENT_SAVED_CLINICS_HREF = '/patient/saved-clinics';
export const PATIENT_CLINIC_LOCATOR_HREF = '/patient/clinic-locator';
export const PATIENT_REVIEWS_HREF = '/patient/reviews';
export const PATIENT_FIND_CLINICS_HREF = '/patient/clinics';
export const PATIENT_PROFILE_HREF = '/patient/profile';
export const PATIENT_EDIT_PROFILE_HREF = '/patient/profile/edit';

export const getAppointmentDetailsHref = (appointmentId) =>
  `${PATIENT_HISTORY_HREF}/${encodeURIComponent(appointmentId)}`;

export const getPatientClinicHref = (clinicId) =>
  `${PATIENT_FIND_CLINICS_HREF}/${encodeURIComponent(clinicId)}`;

export const getBookClinicHref = (clinicId) =>
  `${PATIENT_BOOK_HREF}?clinic=${encodeURIComponent(clinicId)}`;

export const getReviewHref = (appointmentId) =>
  `${PATIENT_REVIEWS_HREF}?appointment=${encodeURIComponent(appointmentId)}`;

export const getRescheduleHref = (appointmentId) =>
  `${getAppointmentDetailsHref(appointmentId)}/reschedule`;

export const PATIENT_NAV_ITEMS = [
  { label: 'Dashboard', href: PATIENT_DASHBOARD_HREF, icon: 'layoutGrid' },
  { label: 'Book Appointment', href: PATIENT_BOOK_HREF, icon: 'calendarBlank' },
  { label: 'Appointment History', href: PATIENT_HISTORY_HREF, icon: 'history' },
  { label: 'Notifications', href: PATIENT_NOTIFICATIONS_HREF, icon: 'bell' },
  { label: 'Find Clinics', href: PATIENT_FIND_CLINICS_HREF, icon: 'building' },
  { label: 'Saved Clinics', href: PATIENT_SAVED_CLINICS_HREF, icon: 'heart' },
  { label: 'Clinic Locator', href: PATIENT_CLINIC_LOCATOR_HREF, icon: 'map' },
  { label: 'My Profile', href: PATIENT_PROFILE_HREF, icon: 'user' },
];

export const PATIENT_QUICK_ACTIONS = [
  { label: 'Find a Clinic', href: PATIENT_FIND_CLINICS_HREF, icon: 'building' },
  { label: 'Clinic Locator', href: PATIENT_CLINIC_LOCATOR_HREF, icon: 'map' },
  { label: 'My Saved Clinics', href: PATIENT_SAVED_CLINICS_HREF, icon: 'heart' },
  { label: 'Leave a Review', href: PATIENT_REVIEWS_HREF, icon: 'star' },
];
