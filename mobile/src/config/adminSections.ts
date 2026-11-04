// System administrator sections, the same as the web admin sidebar
// (web/src/config/adminNavigation.js). The server checks the system_admin
// role on every call.
export type AdminRoute =
  | 'AdminDashboard'
  | 'AdminClinics'
  | 'AdminClinicDetail'
  | 'AdminUsers'
  | 'AdminApplications'
  | 'AdminApplicationDetail'
  | 'AdminSubscriptions'
  | 'AdminSubscriptionDetail'
  | 'AdminReports'
  | 'AdminReviews'
  | 'AdminAnnouncements'
  | 'AdminAnnouncementForm'
  | 'AdminAuditLog'
  | 'AdminSettings'
  | 'AdminNotifications'
  | 'AdminAccount';

export type AdminSection = { route: AdminRoute; label: string; icon: string; tab?: string };

export const ADMIN_SECTIONS: AdminSection[] = [
  { route: 'AdminDashboard', label: 'Dashboard', icon: 'grid', tab: 'Home' },
  { route: 'AdminClinics', label: 'Clinic Management', icon: 'business', tab: 'Clinics' },
  { route: 'AdminApplications', label: 'Clinic Verification', icon: 'shield-checkmark', tab: 'Verify' },
  { route: 'AdminSubscriptions', label: 'Subscriptions', icon: 'card', tab: 'Plans' },
  { route: 'AdminUsers', label: 'User Management', icon: 'people' },
  { route: 'AdminReports', label: 'Reports & Analytics', icon: 'bar-chart' },
  { route: 'AdminReviews', label: 'Review Moderation', icon: 'star' },
  { route: 'AdminAnnouncements', label: 'System Notifications', icon: 'megaphone' },
  { route: 'AdminAuditLog', label: 'Audit Logs', icon: 'document-text' },
  { route: 'AdminSettings', label: 'System Settings', icon: 'settings' },
];

/** Bottom tabs: the first four sections, then "More" (the drawer). */
export const ADMIN_TABS = ADMIN_SECTIONS.slice(0, 4);
