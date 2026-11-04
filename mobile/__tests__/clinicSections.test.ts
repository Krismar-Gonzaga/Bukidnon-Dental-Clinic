/**
 * Clinic portal sidebar sections and appointment steps, filtered by the
 * permissions in backend/config/permissions.php (same rules as the web).
 */
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));

const { visibleSections } = require('../src/config/clinicSections');
const { actionsFor, formatDateTime, toClinicIso } = require('../src/services/clinicPortal');

const PERMISSIONS: Record<string, string[]> = {
  clinic_admin: [
    'clinic.view', 'clinic.profile.manage', 'clinic.branches.manage', 'clinic.services.manage', 'clinic.dentists.manage',
    'clinic.schedules.manage', 'clinic.staff.manage', 'appointments.view_all', 'appointments.manage', 'patients.view',
    'inventory.view', 'inventory.manage', 'feedback.view', 'reports.view', 'subscription.manage', 'clinic.settings.manage',
  ],
  dentist: ['clinic.view', 'appointments.view_assigned', 'appointments.review_assigned', 'appointments.progress', 'patients.view', 'records.view', 'records.write', 'documents.issue'],
  staff: ['clinic.view', 'appointments.view_all', 'appointments.manage', 'patients.view', 'patients.manage'],
  inventory_staff: ['clinic.view', 'inventory.view', 'inventory.manage'],
};

const member = (role: string) => ({ clinic_id: 1, clinic_name: 'Demo', role, permissions: PERMISSIONS[role] });
const labels = (role: string) => visibleSections(member(role)).map((s: { label: string }) => s.label);

test('clinic admins see every web sidebar section', () => {
  expect(labels('clinic_admin')).toEqual([
    'Dashboard', 'Appointments', 'Patients', 'Inventory', 'Services & Prices', 'Dentists',
    'Branches & Hours', 'Staff', 'Reviews', 'Reports', 'Notifications', 'Subscription', 'Settings',
  ]);
});

test('other roles only see what their permissions unlock', () => {
  // Dentists get the dentist design's menu (bottom tabs: the first four).
  expect(labels('dentist')).toEqual([
    'Dashboard', 'Appointments', 'My Patients', 'Dental Chart', 'Clinical Notes', 'Treatment Records', 'Prescriptions',
    'Dental Certificates', 'Imaging & Files', 'Follow-up', 'Notifications', 'My Schedule', 'My Profile',
  ]);
  expect(labels('staff')).toEqual(['Dashboard', 'Appointments', 'Patients', 'Check-in / Queue', 'Dentist Schedule', 'Notifications', 'My Profile']);
  expect(labels('inventory_staff')).toEqual(['Dashboard', 'Inventory', 'Notifications']);
});

test('a staff member given other modules keeps those sections, without inventory by default', () => {
  const withReports = { ...member('staff'), permissions: [...PERMISSIONS.staff, 'reports.view'] };
  const sectionLabels = visibleSections(withReports).map((s: { label: string }) => s.label);
  expect(sectionLabels).toContain('Reports');
  expect(labels('staff')).not.toContain('Inventory');
});

test('appointment steps follow the status and the member permissions', () => {
  const steps = (role: string, status: string) => actionsFor(member(role), status).map((a: { action: string }) => a.action);
  expect(steps('staff', 'pending')).toEqual(['confirm', 'reject', 'reschedule', 'reassign']);
  expect(steps('dentist', 'pending')).toEqual([]);
  expect(steps('dentist', 'checked_in')).toEqual(['start', 'no-show']);
  expect(steps('dentist', 'in_progress')).toEqual(['complete']);
  expect(steps('staff', 'completed')).toEqual([]);
});

test('formats clinic times in Philippine time regardless of the device zone', () => {
  expect(formatDateTime('2026-11-03T01:30:00Z')).toBe('Nov 3, 2026, 9:30 AM');
  expect(toClinicIso('2026-11-03', '09:30')).toBe('2026-11-03T09:30:00+08:00');
});
