// System administrator portal.
export const ADMIN_DASHBOARD_HREF = '/admin';
export const ADMIN_APPLICATIONS_HREF = '/admin/applications';
export const ADMIN_CLINICS_HREF = '/admin/clinics';
export const ADMIN_USERS_HREF = '/admin/users';
export const ADMIN_REVIEWS_HREF = '/admin/reviews';
export const ADMIN_AUDIT_HREF = '/admin/audit-logs';
export const ADMIN_NOTIFICATIONS_HREF = '/admin/notifications';
export const ADMIN_PROFILE_HREF = '/admin/profile';
export const ADMIN_PASSWORD_HREF = '/admin/password';
export const ADMIN_SETTINGS_HREF = '/admin/settings';

export const getAdminApplicationHref = (id) => `${ADMIN_APPLICATIONS_HREF}/${encodeURIComponent(id)}`;

// Sidebar (admin portal design). Notifications, My Profile and Change
// Password are reached from the top bar. Users and Review Moderation are not
// in the design but keep their existing pages.
export const ADMIN_NAV_ITEMS = [
  { label: 'Dashboard', href: ADMIN_DASHBOARD_HREF, icon: 'layoutGrid' },
  { label: 'Registration Queue', href: ADMIN_APPLICATIONS_HREF, icon: 'userCheck' },
  { label: 'Verification', href: ADMIN_CLINICS_HREF, icon: 'shieldCheck' },
  { label: 'Users', href: ADMIN_USERS_HREF, icon: 'users' },
  { label: 'Review Moderation', href: ADMIN_REVIEWS_HREF, icon: 'star' },
  { label: 'Audit Logs', href: ADMIN_AUDIT_HREF, icon: 'history' },
  { label: 'Settings', href: ADMIN_SETTINGS_HREF, icon: 'settings' },
];

export const APPLICATION_STATUS_LABELS = {
  pending: 'Pending',
  under_review: 'Reviewing',
  approved: 'Approved',
  rejected: 'Returned',
};

// Verification table: document status (from the API's document_status) and review priority.
export const DOCUMENT_STATUS = {
  verified: { label: 'Verified', tone: 'success' },
  under_review: { label: 'Under Review', tone: 'primary' },
  pending: { label: 'Pending', tone: 'neutral' },
  missing_info: { label: 'Missing Info', tone: 'danger' },
  returned: { label: 'More Info Requested', tone: 'warning' },
  suspended: { label: 'Suspended', tone: 'danger' },
};

export const PRIORITY_LABELS = { high: 'High', medium: 'Medium', standard: 'Standard' };

// Audit log filters. Categories match the API (App\Support\AuditPresenter).
export const AUDIT_RANGES = [
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom Dates' },
];

export const AUDIT_CATEGORIES = [
  { value: 'security', label: 'Security / Sign-in' },
  { value: 'verification', label: 'Clinic Verification' },
  { value: 'clinics', label: 'Clinic Management' },
  { value: 'accounts', label: 'Account Administration' },
  { value: 'records', label: 'Patient Records' },
  { value: 'appointments', label: 'Appointments' },
  { value: 'reviews', label: 'Reviews' },
  { value: 'audit', label: 'Audit Log' },
];

export const AUDIT_OUTCOMES = {
  success: { label: 'Success', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  blocked: { label: 'Blocked', tone: 'danger' },
};

export const USER_ROLE_LABELS = {
  patient: 'Patient',
  clinic_admin: 'Clinic Admin',
  dentist: 'Dentist',
  staff: 'Clinic Staff',
  system_admin: 'System Admin',
};
