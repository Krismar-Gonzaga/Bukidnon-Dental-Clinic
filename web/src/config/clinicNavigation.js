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
// 'clinic-settings' is the System > Settings page.
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
  { section: 'notifications', group: 'System', label: 'Notifications', icon: 'bell', anyOf: ['clinic.view'], showsUnread: true },
  { section: 'subscription', group: 'System', label: 'Subscription', icon: 'creditCard', anyOf: ['subscription.manage'] },
  { section: 'clinic-settings', group: 'System', label: 'Settings', icon: 'settings', anyOf: ['clinic.settings.manage', 'clinic.permissions.manage', 'clinic.audit.view'] },
];

// Dentists get their own flat sidebar (dentist design). `aliases` keeps the older schedule and
// records pages, which notifications may still link to, highlighted under their replacements.
export const DENTIST_SECTIONS = [
  { section: 'dashboard', label: 'Dashboard', icon: 'layoutGrid', anyOf: ['clinic.view'] },
  { section: 'appointments', label: 'Appointments', icon: 'calendarBlank', anyOf: ['appointments.view_all', 'appointments.view_assigned'] },
  { section: 'patients', label: 'My Patients', icon: 'users', anyOf: ['patients.view'] },
  { section: 'dental-chart', label: 'Dental Chart', icon: 'activity', anyOf: ['records.view'] },
  { section: 'clinical-notes', label: 'Clinical Notes', icon: 'clipboardList', anyOf: ['records.view'], aliases: ['records'] },
  { section: 'treatment-records', label: 'Treatment Records', icon: 'fileText', anyOf: ['records.view'] },
  { section: 'prescriptions', label: 'Prescriptions', icon: 'bookOpen', anyOf: ['records.view'] },
  { section: 'certificates', label: 'Dental Certificates', icon: 'award', anyOf: ['documents.issue'] },
  { section: 'imaging', label: 'Imaging & Files', icon: 'camera', anyOf: ['records.view'] },
  { section: 'follow-ups', label: 'Follow-up', icon: 'calendarPlus', anyOf: ['records.view'] },
  { section: 'notifications', label: 'Notifications', icon: 'bell', anyOf: ['clinic.view'], showsUnread: true },
  { section: 'my-schedule', label: 'My Schedule', icon: 'clock', anyOf: ['appointments.view_assigned'], aliases: ['schedule'] },
  { section: 'profile', label: 'My Profile', icon: 'user', anyOf: ['clinic.view'] },
];

// Clinic staff (front desk) get their own flat sidebar. Positions that also hold
// other modules (an office manager's reports, say) keep those sections after it.
export const FRONT_DESK_SECTIONS = [
  { section: 'dashboard', label: 'Dashboard', icon: 'layoutGrid', anyOf: ['clinic.view'] },
  { section: 'appointments', label: 'Appointments', icon: 'calendarBlank', anyOf: ['appointments.view_all', 'appointments.view_assigned'] },
  { section: 'patients', label: 'Patients', icon: 'users', anyOf: ['patients.view'] },
  { section: 'check-in', label: 'Check-in / Queue', icon: 'userCheck', anyOf: ['appointments.manage'] },
  { section: 'dentist-schedule', label: 'Dentist Schedule', icon: 'clock', anyOf: ['appointments.view_all'] },
  { section: 'notifications', label: 'Notifications', icon: 'bell', anyOf: ['clinic.view'], showsUnread: true },
  { section: 'profile', label: 'My Profile', icon: 'user', anyOf: ['clinic.view'] },
];

export const isDentistMember = (membership) => membership?.role === 'dentist';
export const isFrontDeskMember = (membership) => membership?.role === 'staff';

export const getClinicSections = (membership) => {
  if (isDentistMember(membership)) return DENTIST_SECTIONS;
  if (!isFrontDeskMember(membership)) return CLINIC_SECTIONS;
  const own = FRONT_DESK_SECTIONS.map(({ section }) => section);
  return [...FRONT_DESK_SECTIONS, ...CLINIC_SECTIONS.filter(({ section }) => !own.includes(section)).map(({ group, ...item }) => item)];
};

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
