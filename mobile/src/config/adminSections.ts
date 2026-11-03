// System administrator sections, the same as the web admin sidebar
// (web/src/config/adminNavigation.js). The server checks the system_admin
// role on every call.
export type AdminRoute =
  | 'AdminDashboard'
  | 'AdminApplications'
  | 'AdminApplicationDetail'
  | 'AdminClinics'
  | 'AdminUsers'
  | 'AdminReviews'
  | 'AdminAuditLog'
  | 'AdminSettings'
  | 'AdminNotifications'
  | 'AdminAccount';

export type AdminSection = { route: AdminRoute; label: string; icon: string; tab?: string };

export const ADMIN_SECTIONS: AdminSection[] = [
  { route: 'AdminDashboard', label: 'Dashboard', icon: 'grid', tab: 'Home' },
  { route: 'AdminApplications', label: 'Registration Queue', icon: 'person-add', tab: 'Queue' },
  { route: 'AdminClinics', label: 'Verification', icon: 'shield-checkmark', tab: 'Verify' },
  { route: 'AdminAuditLog', label: 'Audit Logs', icon: 'document-text', tab: 'Audit' },
  { route: 'AdminUsers', label: 'Users', icon: 'people' },
  { route: 'AdminReviews', label: 'Review Moderation', icon: 'star' },
  { route: 'AdminSettings', label: 'Settings', icon: 'settings' },
];

/** Bottom tabs: the first four sections, then "More" (the drawer). */
export const ADMIN_TABS = ADMIN_SECTIONS.slice(0, 4);
