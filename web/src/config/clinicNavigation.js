// Clinic portal (clinic admins, dentists, receptionists, inventory staff).
// Each section lists the backend permission(s) that unlock it; the API
// enforces the same permissions (see backend/config/permissions.php).
export const CLINIC_PORTAL_HREF = '/clinic';
export const CLINIC_APPLY_HREF = '/clinic/apply';
// Clinic owners who have not been approved yet (no clinic membership).
export const CLINIC_APPLICANT_PROFILE_HREF = '/clinic/apply/profile';
export const CLINIC_APPLICANT_PASSWORD_HREF = '/clinic/apply/password';

export const getClinicHref = (clinicId, section = 'dashboard') =>
  `${CLINIC_PORTAL_HREF}/${encodeURIComponent(clinicId)}/${section}`;

// Sidebar sections, in the groups of the clinic admin design. Services and
// Branches are tabs of Clinic Profile ('settings'), so they highlight it.
// Notifications and account Settings are in the top bar and the avatar menu.
export const CLINIC_SECTIONS = [
  { section: 'dashboard', label: 'Dashboard', icon: 'layoutGrid', anyOf: ['clinic.view'] },
  { section: 'settings', group: 'Clinic', label: 'Clinic Profile', icon: 'building', anyOf: ['clinic.profile.manage'], aliases: ['services', 'branches'] },
  { section: 'dentists', group: 'Team', label: 'Dentists', icon: 'stethoscope', anyOf: ['clinic.dentists.manage', 'clinic.schedules.manage'] },
  { section: 'staff', group: 'Team', label: 'Staff', icon: 'users', anyOf: ['clinic.staff.manage'] },
  { section: 'appointments', group: 'Operations', label: 'Appointments', icon: 'calendarBlank', anyOf: ['appointments.view_all', 'appointments.view_assigned'] },
  { section: 'patients', group: 'Operations', label: 'Patients', icon: 'user', anyOf: ['patients.view'] },
  { section: 'inventory', group: 'Operations', label: 'Inventory', icon: 'clipboardList', anyOf: ['inventory.view'] },
  { section: 'reports', group: 'Business', label: 'Reports', icon: 'barChart', anyOf: ['reports.view'] },
  { section: 'reviews', group: 'Business', label: 'Reviews', icon: 'star', anyOf: ['feedback.view'] },
];

// Dentists get their own sidebar (dentist dashboard design): the calendar
// replaces the appointment list (`aliases` keeps appointment pages
// highlighted under Schedule) and clinical records get their own page.
export const DENTIST_SECTIONS = [
  { section: 'dashboard', label: 'Overview', icon: 'layoutGrid', anyOf: ['clinic.view'] },
  { section: 'schedule', label: 'Schedule', icon: 'calendarBlank', anyOf: ['appointments.view_all', 'appointments.view_assigned'], aliases: ['appointments'] },
  { section: 'patients', label: 'Patients', icon: 'users', anyOf: ['patients.view'] },
  { section: 'records', label: 'Records', icon: 'clipboardList', anyOf: ['records.view'] },
  { section: 'inventory', label: 'Inventory', icon: 'briefcaseMedical', anyOf: ['inventory.view'] },
];

export const isDentistMember = (membership) => membership?.role === 'dentist';

export const getClinicSections = (membership) => (isDentistMember(membership) ? DENTIST_SECTIONS : CLINIC_SECTIONS);

export const canAny = (permissions = [], anyOf = []) => anyOf.some((p) => permissions.includes(p));

// Clinical record types (backend PatientRecord::TYPES).
export const RECORD_TYPES = [
  { value: 'examination', label: 'Examination' },
  { value: 'treatment', label: 'Treatment' },
  { value: 'consultation', label: 'Consultation' },
];

export const getRecordTypeLabel = (type) => RECORD_TYPES.find(({ value }) => value === type)?.label ?? type;

export const CLINIC_ROLE_LABELS = {
  clinic_admin: 'Clinic Administrator',
  dentist: 'Dentist',
  staff: 'Receptionist / Staff',
  inventory_staff: 'Inventory Staff',
};

// Appointment statuses as clinic staff see them (full backend lifecycle).
export const CLINIC_APPOINTMENT_STATUSES = [
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'reschedule_requested', label: 'Reschedule requested' },
  { id: 'checked_in', label: 'Checked in' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'no_show', label: 'No-show' },
];

export const getClinicStatusLabel = (status) =>
  CLINIC_APPOINTMENT_STATUSES.find(({ id }) => id === status)?.label ?? status;
