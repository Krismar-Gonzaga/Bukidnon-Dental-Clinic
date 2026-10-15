// Clinic portal (clinic admins, dentists, receptionists, inventory staff).
// Each section lists the backend permission(s) that unlock it; the API
// enforces the same permissions (see backend/config/permissions.php).
export const CLINIC_PORTAL_HREF = '/clinic';
export const CLINIC_APPLY_HREF = '/clinic/apply';

export const getClinicHref = (clinicId, section = 'dashboard') =>
  `${CLINIC_PORTAL_HREF}/${encodeURIComponent(clinicId)}/${section}`;

export const CLINIC_SECTIONS = [
  { section: 'dashboard', label: 'Dashboard', icon: 'layoutGrid', anyOf: ['clinic.view'] },
  { section: 'appointments', label: 'Appointments', icon: 'calendarBlank', anyOf: ['appointments.view_all', 'appointments.view_assigned'] },
  { section: 'patients', label: 'Patients', icon: 'users', anyOf: ['patients.view'] },
  { section: 'inventory', label: 'Inventory', icon: 'clipboardList', anyOf: ['inventory.view'] },
  { section: 'services', label: 'Services & Prices', icon: 'tooth', anyOf: ['clinic.services.manage'] },
  { section: 'dentists', label: 'Dentists & Schedules', icon: 'stethoscope', anyOf: ['clinic.dentists.manage', 'clinic.schedules.manage'] },
  { section: 'branches', label: 'Branches & Hours', icon: 'building', anyOf: ['clinic.branches.manage', 'clinic.schedules.manage'] },
  { section: 'staff', label: 'Staff', icon: 'userCheck', anyOf: ['clinic.staff.manage'] },
  { section: 'reviews', label: 'Reviews', icon: 'star', anyOf: ['feedback.view'] },
  { section: 'reports', label: 'Reports', icon: 'sliders', anyOf: ['reports.view'] },
  { section: 'settings', label: 'Clinic Profile', icon: 'pencil', anyOf: ['clinic.profile.manage'] },
  { section: 'notifications', label: 'Notifications', icon: 'bell', anyOf: ['clinic.view'] },
  { section: 'password', label: 'Change Password', icon: 'lock', anyOf: ['clinic.view'] },
];

export const canAny = (permissions = [], anyOf = []) => anyOf.some((p) => permissions.includes(p));

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
