// System administrator portal.
export const ADMIN_DASHBOARD_HREF = '/admin';
export const ADMIN_CLINICS_HREF = '/admin/clinics';
export const ADMIN_USERS_HREF = '/admin/users';
export const ADMIN_APPLICATIONS_HREF = '/admin/applications';
export const ADMIN_SUBSCRIPTIONS_HREF = '/admin/subscriptions';
export const ADMIN_REPORTS_HREF = '/admin/reports';
export const ADMIN_REVIEWS_HREF = '/admin/reviews';
export const ADMIN_ANNOUNCEMENTS_HREF = '/admin/announcements';
export const ADMIN_ANNOUNCEMENT_NEW_HREF = '/admin/announcements/new';
export const ADMIN_AUDIT_HREF = '/admin/audit-logs';
export const ADMIN_SETTINGS_HREF = '/admin/settings';
export const ADMIN_PROFILE_HREF = '/admin/profile';
export const ADMIN_PASSWORD_HREF = '/admin/password';
export const ADMIN_NOTIFICATIONS_HREF = '/admin/notifications';

export const getAdminClinicHref = (id) => `${ADMIN_CLINICS_HREF}/${encodeURIComponent(id)}`;
export const getAdminApplicationHref = (id) => `${ADMIN_APPLICATIONS_HREF}/${encodeURIComponent(id)}`;
export const getAdminSubscriptionHref = (clinicId) => `${ADMIN_SUBSCRIPTIONS_HREF}/${encodeURIComponent(clinicId)}`;
export const getAdminAnnouncementEditHref = (id) => `${ADMIN_ANNOUNCEMENTS_HREF}/${encodeURIComponent(id)}/edit`;

// Sidebar, in the order of the system admin design. Review Moderation is not in
// the design: it stays because reported reviews have nowhere else to go.
export const ADMIN_NAV_ITEMS = [
  { label: 'Dashboard', href: ADMIN_DASHBOARD_HREF, icon: 'layoutGrid' },
  { label: 'Clinic Management', href: ADMIN_CLINICS_HREF, icon: 'building' },
  { label: 'User Management', href: ADMIN_USERS_HREF, icon: 'users' },
  { label: 'Clinic Verification', href: ADMIN_APPLICATIONS_HREF, icon: 'shield' },
  { label: 'Subscriptions', href: ADMIN_SUBSCRIPTIONS_HREF, icon: 'creditCard' },
  { label: 'Reports & Analytics', href: ADMIN_REPORTS_HREF, icon: 'barChart' },
  { label: 'Review Moderation', href: ADMIN_REVIEWS_HREF, icon: 'star' },
  { label: 'System Notifications', href: ADMIN_ANNOUNCEMENTS_HREF, icon: 'bell' },
  { label: 'Audit Logs', href: ADMIN_AUDIT_HREF, icon: 'clipboardList' },
  { label: 'System Settings', href: ADMIN_SETTINGS_HREF, icon: 'settings' },
  { label: 'My Profile', href: ADMIN_PROFILE_HREF, icon: 'user' },
];

// tone: success | warning | danger | info | neutral (StatusTag).
export const CLINIC_STATUS = {
  approved: { label: 'Verified', tone: 'success' },
  suspended: { label: 'Suspended', tone: 'danger' },
  pending: { label: 'Pending', tone: 'warning' },
  under_review: { label: 'Under-Review', tone: 'warning' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

export const CLINIC_STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'approved', label: 'Verified' },
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under-Review' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
];

export const SUBSCRIPTION_STATUS = {
  active: { label: 'Active', tone: 'success' },
  pending_payment: { label: 'Pending-Payment', tone: 'warning' },
  grace: { label: 'In Grace Period', tone: 'warning' },
  expired: { label: 'Expired', tone: 'danger' },
  none: { label: 'No Payment Yet', tone: 'neutral' },
};

export const PAYMENT_STATUS = {
  pending: { label: 'Submitted', tone: 'warning' },
  verified: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

export const NO_PAYMENT_STATUS = { label: 'None', tone: 'neutral' };

// Labels of the verification documents in the system admin design.
export const VERIFICATION_DOCUMENT_LABELS = {
  business_permit: 'Business Permit',
  doh_license: 'DOH License to Operate',
  prc_id: 'PRC License',
  bir_registration: 'BIR Registration',
  other: 'Other Supporting Document',
};

export const ANNOUNCEMENT_AUDIENCES = [
  { value: 'all', label: 'All Users' },
  { value: 'patients', label: 'Patients' },
  { value: 'dentists', label: 'Dentists' },
  { value: 'staff', label: 'Clinic Staff' },
  { value: 'clinic_admins', label: 'Clinic Admins' },
];

export const ANNOUNCEMENT_STATUS = {
  published: { label: 'Published', tone: 'success' },
  draft: { label: 'Draft', tone: 'warning' },
  archived: { label: 'Archived', tone: 'neutral' },
};

// Audit log filter. Categories match the API (App\Support\AuditPresenter).
export const AUDIT_CATEGORIES = [
  { value: 'security', label: 'Security / Sign-in' },
  { value: 'verification', label: 'Clinic Verification' },
  { value: 'clinics', label: 'Clinic Management' },
  { value: 'accounts', label: 'User Management' },
  { value: 'subscription', label: 'Subscriptions' },
  { value: 'notifications', label: 'System Notifications' },
  { value: 'settings', label: 'System Settings' },
  { value: 'records', label: 'Patient Records' },
  { value: 'appointments', label: 'Appointments' },
  { value: 'reviews', label: 'Reviews' },
  { value: 'audit', label: 'Audit Log' },
];

export const AUDIT_OUTCOMES = {
  success: { label: 'success', tone: 'success' },
  pending: { label: 'pending', tone: 'warning' },
  failed: { label: 'failed', tone: 'danger' },
  blocked: { label: 'blocked', tone: 'danger' },
};

export const USER_ROLE_LABELS = {
  patient: 'Patient',
  clinic_admin: 'Clinic Admin',
  dentist: 'Dentist',
  staff: 'Clinic Staff',
  system_admin: 'System Admin',
};

// Pill color of each account type on User Management.
export const USER_ROLE_TONES = {
  patient: 'info',
  clinic_admin: 'warning',
  dentist: 'teal',
  staff: 'success',
  system_admin: 'primary',
};
