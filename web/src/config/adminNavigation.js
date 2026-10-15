// System administrator portal.
export const ADMIN_DASHBOARD_HREF = '/admin';
export const ADMIN_APPLICATIONS_HREF = '/admin/applications';
export const ADMIN_CLINICS_HREF = '/admin/clinics';
export const ADMIN_USERS_HREF = '/admin/users';
export const ADMIN_REVIEWS_HREF = '/admin/reviews';
export const ADMIN_AUDIT_HREF = '/admin/audit-logs';
export const ADMIN_NOTIFICATIONS_HREF = '/admin/notifications';

export const getAdminApplicationHref = (id) => `${ADMIN_APPLICATIONS_HREF}/${encodeURIComponent(id)}`;

export const ADMIN_NAV_ITEMS = [
  { label: 'Dashboard', href: ADMIN_DASHBOARD_HREF, icon: 'layoutGrid' },
  { label: 'Clinic Verification', href: ADMIN_APPLICATIONS_HREF, icon: 'shieldCheck' },
  { label: 'Clinics', href: ADMIN_CLINICS_HREF, icon: 'building' },
  { label: 'Users', href: ADMIN_USERS_HREF, icon: 'users' },
  { label: 'Review Moderation', href: ADMIN_REVIEWS_HREF, icon: 'star' },
  { label: 'Audit Log', href: ADMIN_AUDIT_HREF, icon: 'history' },
  { label: 'Notifications', href: ADMIN_NOTIFICATIONS_HREF, icon: 'bell' },
  { label: 'Change Password', href: '/admin/password', icon: 'lock' },
];

export const USER_ROLE_LABELS = {
  patient: 'Patient',
  clinic_admin: 'Clinic Admin',
  dentist: 'Dentist',
  staff: 'Clinic Staff',
  system_admin: 'System Admin',
};
