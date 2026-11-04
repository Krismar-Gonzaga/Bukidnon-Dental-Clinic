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
  | 'ClinicAccount'
  | 'ClinicSubscription'
  | 'ClinicAdminSettings'
  | 'ClinicCheckIn'
  | 'ClinicDentistSchedule'
  | 'ClinicDentalChart'
  | 'ClinicClinicalNotes'
  | 'ClinicTreatmentRecords'
  | 'ClinicPrescriptions'
  | 'ClinicCertificates'
  | 'ClinicImaging'
  | 'ClinicFollowUps'
  | 'ClinicMySchedule';

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
  { route: 'ClinicNotifications', label: 'Notifications', icon: 'notifications', anyOf: ['clinic.view'] },
  { route: 'ClinicSubscription', label: 'Subscription', icon: 'card', anyOf: ['subscription.manage'] },
  { route: 'ClinicAdminSettings', label: 'Settings', icon: 'settings', anyOf: ['clinic.settings.manage', 'clinic.permissions.manage', 'clinic.audit.view'] },
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
  { label: 'System', routes: ['ClinicNotifications', 'ClinicSubscription', 'ClinicAdminSettings'] },
];

/** Drawer contents: the dashboard, then each group's sections the member can open. */
export const drawerGroups = (membership: Membership | undefined) => {
  const hasProfile = can(membership, ...CLINIC_SETTINGS_SECTION.anyOf);
  const sections = [...visibleSections(membership), ...(hasProfile ? [CLINIC_SETTINGS_SECTION] : [])];
  // Services and Branches are tabs of Clinic Profile; they get their own link only without it.
  const hidden: ClinicRoute[] = hasProfile ? ['ClinicServices', 'ClinicBranches'] : [];
  return DRAWER_GROUPS.map(({ label, routes }) => ({
    label,
    sections: routes
      .filter((route) => !hidden.includes(route))
      .map((route) => sections.find((s) => s.route === route))
      .filter((s): s is ClinicSection => Boolean(s)),
  })).filter((group) => group.sections.length > 0);
};

/**
 * Dentists get their own flat menu (dentist design, as on the web). The bottom tabs are the
 * first four sections, then More opens the rest.
 */
export const DENTIST_SECTIONS: ClinicSection[] = [
  { route: 'ClinicDashboard', label: 'Dashboard', icon: 'grid', anyOf: ['clinic.view'], tab: 'Home' },
  { route: 'ClinicAppointments', label: 'Appointments', icon: 'calendar', anyOf: ['appointments.view_all', 'appointments.view_assigned'], tab: 'Visits' },
  { route: 'ClinicPatients', label: 'My Patients', icon: 'people', anyOf: ['patients.view'], tab: 'Patients' },
  { route: 'ClinicDentalChart', label: 'Dental Chart', icon: 'pulse', anyOf: ['records.view'], tab: 'Chart' },
  { route: 'ClinicClinicalNotes', label: 'Clinical Notes', icon: 'clipboard', anyOf: ['records.view'] },
  { route: 'ClinicTreatmentRecords', label: 'Treatment Records', icon: 'document-text', anyOf: ['records.view'] },
  { route: 'ClinicPrescriptions', label: 'Prescriptions', icon: 'book', anyOf: ['records.view'] },
  { route: 'ClinicCertificates', label: 'Dental Certificates', icon: 'ribbon', anyOf: ['documents.issue'] },
  { route: 'ClinicImaging', label: 'Imaging & Files', icon: 'camera', anyOf: ['records.view'] },
  { route: 'ClinicFollowUps', label: 'Follow-up', icon: 'calendar-number', anyOf: ['records.view'] },
  { route: 'ClinicNotifications', label: 'Notifications', icon: 'notifications', anyOf: ['clinic.view'] },
  { route: 'ClinicMySchedule', label: 'My Schedule', icon: 'time', anyOf: ['appointments.view_assigned'] },
  { route: 'ClinicAccount', label: 'My Profile', icon: 'person-circle', anyOf: ['clinic.view'] },
];

/**
 * Clinic staff (front desk) get their own flat menu, as on the web. Positions that
 * also hold other modules (an office manager's reports, say) keep those after it.
 */
export const FRONT_DESK_SECTIONS: ClinicSection[] = [
  { route: 'ClinicDashboard', label: 'Dashboard', icon: 'grid', anyOf: ['clinic.view'], tab: 'Home' },
  { route: 'ClinicAppointments', label: 'Appointments', icon: 'calendar', anyOf: ['appointments.view_all', 'appointments.view_assigned'], tab: 'Visits' },
  { route: 'ClinicPatients', label: 'Patients', icon: 'people', anyOf: ['patients.view'] },
  { route: 'ClinicCheckIn', label: 'Check-in / Queue', icon: 'person', anyOf: ['appointments.manage'], tab: 'Check-in' },
  { route: 'ClinicDentistSchedule', label: 'Dentist Schedule', icon: 'time', anyOf: ['appointments.view_all'] },
  { route: 'ClinicNotifications', label: 'Notifications', icon: 'notifications', anyOf: ['clinic.view'] },
  { route: 'ClinicAccount', label: 'My Profile', icon: 'person-circle', anyOf: ['clinic.view'] },
];

const sectionsFor = (membership: Membership | undefined) => {
  if (membership?.role === 'dentist') return DENTIST_SECTIONS;
  if (membership?.role !== 'staff') return CLINIC_SECTIONS;
  const own = FRONT_DESK_SECTIONS.map((s) => s.route);
  return [...FRONT_DESK_SECTIONS, ...CLINIC_SECTIONS.filter((s) => !own.includes(s.route))];
};

export const visibleSections = (membership: Membership | undefined) => sectionsFor(membership).filter((s) => can(membership, ...s.anyOf));

/** Bottom tabs: the first four sections the member can open, then "More" (the drawer). */
export const TAB_LIMIT = 4;
