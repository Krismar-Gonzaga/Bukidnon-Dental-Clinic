// Clinic portal sections, the same as the web sidebar (web/src/config/
// clinicNavigation.js). Each lists the permission(s) that unlock it; the API
// enforces the same permissions (backend/config/permissions.php).
import { can, Membership } from '../services/clinicPortal';

export type ClinicRoute =
  | 'ClinicDashboard'
  | 'ClinicAppointments'
  | 'ClinicSchedule'
  | 'ClinicRecords'
  | 'ClinicPatients'
  | 'ClinicInventory'
  | 'ClinicServices'
  | 'ClinicDentists'
  | 'ClinicBranches'
  | 'ClinicStaff'
  | 'ClinicReviews'
  | 'ClinicReports'
  | 'ClinicSettings'
  | 'ClinicNotifications'
  | 'ClinicAccount';

export type ClinicSection = { route: ClinicRoute; label: string; icon: string; anyOf: string[]; tab?: string };

export const CLINIC_SECTIONS: ClinicSection[] = [
  { route: 'ClinicDashboard', label: 'Dashboard', icon: 'grid', anyOf: ['clinic.view'], tab: 'Home' },
  { route: 'ClinicAppointments', label: 'Appointments', icon: 'calendar', anyOf: ['appointments.view_all', 'appointments.view_assigned'] },
  { route: 'ClinicPatients', label: 'Patients', icon: 'people', anyOf: ['patients.view'] },
  { route: 'ClinicInventory', label: 'Inventory', icon: 'cube', anyOf: ['inventory.view'] },
  { route: 'ClinicServices', label: 'Services & Prices', icon: 'pricetags', anyOf: ['clinic.services.manage'] },
  { route: 'ClinicDentists', label: 'Dentists', icon: 'medkit', anyOf: ['clinic.dentists.manage', 'clinic.schedules.manage'] },
  { route: 'ClinicBranches', label: 'Branches & Hours', icon: 'business', anyOf: ['clinic.branches.manage', 'clinic.schedules.manage'] },
  { route: 'ClinicStaff', label: 'Staff', icon: 'id-card', anyOf: ['clinic.staff.manage'] },
  { route: 'ClinicReviews', label: 'Reviews', icon: 'star', anyOf: ['feedback.view'] },
  { route: 'ClinicReports', label: 'Reports', icon: 'bar-chart', anyOf: ['reports.view'] },
];

/** The drawer's Clinic Profile link. */
export const CLINIC_SETTINGS_SECTION: ClinicSection = {
  route: 'ClinicSettings',
  label: 'Clinic Profile',
  icon: 'business',
  anyOf: ['clinic.profile.manage'],
};

/**
 * The clinic admin design's sidebar groups for the drawer. The order of
 * CLINIC_SECTIONS stays as it is because it also decides the bottom tabs.
 */
export const DRAWER_GROUPS: { label: string; routes: ClinicRoute[] }[] = [
  { label: 'Clinic', routes: ['ClinicSettings', 'ClinicServices', 'ClinicBranches'] },
  { label: 'Team', routes: ['ClinicDentists', 'ClinicStaff'] },
  { label: 'Operations', routes: ['ClinicAppointments', 'ClinicPatients', 'ClinicInventory'] },
  { label: 'Business', routes: ['ClinicReports', 'ClinicReviews'] },
];

/** Drawer contents: the dashboard, then each group's sections the member can open. */
export const drawerGroups = (membership: Membership | undefined) => {
  const sections = [...visibleSections(membership), ...(can(membership, ...CLINIC_SETTINGS_SECTION.anyOf) ? [CLINIC_SETTINGS_SECTION] : [])];
  return DRAWER_GROUPS.map(({ label, routes }) => ({
    label,
    sections: routes.map((route) => sections.find((s) => s.route === route)).filter((s): s is ClinicSection => Boolean(s)),
  })).filter((group) => group.sections.length > 0);
};

/**
 * Dentists get their own sidebar (dentist dashboard design, as on the web):
 * Overview, Schedule (calendar), Patients, Records. The bottom tabs are the
 * first four, matching the design's mobile navigation.
 */
export const DENTIST_SECTIONS: ClinicSection[] = [
  { route: 'ClinicDashboard', label: 'Overview', icon: 'grid', anyOf: ['clinic.view'] },
  { route: 'ClinicSchedule', label: 'Schedule', icon: 'calendar', anyOf: ['appointments.view_all', 'appointments.view_assigned'] },
  { route: 'ClinicPatients', label: 'Patients', icon: 'people', anyOf: ['patients.view'] },
  { route: 'ClinicRecords', label: 'Records', icon: 'document-text', anyOf: ['records.view'] },
  { route: 'ClinicInventory', label: 'Inventory', icon: 'cube', anyOf: ['inventory.view'] },
];

export const visibleSections = (membership: Membership | undefined) =>
  (membership?.role === 'dentist' ? DENTIST_SECTIONS : CLINIC_SECTIONS).filter((s) => can(membership, ...s.anyOf));

/** Bottom tabs: the first four sections the member can open, then "More" (the drawer). */
export const TAB_LIMIT = 4;
