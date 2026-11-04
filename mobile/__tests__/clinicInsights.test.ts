/**
 * Clinic admin dashboard logic on the phone: notes, comparison, calendar grid
 * and the grouped drawer (same rules as the web dashboard).
 */
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));

const { businessMinutesNow, fetchAppointmentCalendar, fetchClinicInsights, greetingFor, monthCells, moveMonth, revenueChange, todayNote } = require('../src/services/clinicInsights');
const { drawerGroups } = require('../src/config/clinicSections');
const api = require('../src/services/http').default;

test('today and revenue notes compare with the day and month before', () => {
  expect(todayNote(12, 10)).toBe('+2 from yesterday');
  expect(todayNote(8, 10)).toBe('-2 from yesterday');
  expect(todayNote(5, 5)).toBe('Same as yesterday');
  expect(revenueChange(58420, 52160)).toEqual({ up: true, text: '12% vs last month' });
  expect(revenueChange(40000, 50000)).toEqual({ up: false, text: '20% vs last month' });
  expect(revenueChange(100, 0)).toBeNull();
});

test('greeting follows Philippine time, whatever the device zone', () => {
  expect(greetingFor(8 * 60)).toBe('Good morning,');
  expect(greetingFor(13 * 60)).toBe('Good afternoon,');
  expect(greetingFor(19 * 60)).toBe('Good evening,');
  expect(businessMinutesNow(new Date('2026-11-02T00:30:00Z'))).toBe(8 * 60 + 30);
  expect(businessMinutesNow(new Date('2026-11-02T20:00:00Z'))).toBe(4 * 60);
});

test('the calendar grid starts on Monday and months roll over', () => {
  const cells = monthCells('2026-11'); // 1 November 2026 is a Sunday
  expect(cells.slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-11-01']);
  expect(cells[cells.length - 1]).toBe('2026-11-30');
  expect(moveMonth('2026-12', 1)).toBe('2027-01');
  expect(moveMonth('2026-01', -1)).toBe('2025-12');
});

test('insights and calendar come from the clinic-scoped endpoints', async () => {
  const get = jest.spyOn(api, 'get').mockResolvedValue({ data: { data: { ok: true } } });
  await fetchClinicInsights(7);
  expect(get).toHaveBeenCalledWith('/manage/clinics/7/dashboard/insights');
  await fetchAppointmentCalendar(7, '2026-11');
  expect(get).toHaveBeenCalledWith('/manage/clinics/7/appointments/calendar', { params: { month: '2026-11' } });
  get.mockRestore();
});

test('drawer groups only list what the member may open', () => {
  const member = (permissions: string[]) => ({ clinic_id: 1, clinic_name: 'Demo', role: 'staff', permissions });
  const admin = drawerGroups(member(['clinic.view', 'clinic.profile.manage', 'clinic.services.manage', 'clinic.branches.manage', 'clinic.dentists.manage', 'clinic.staff.manage', 'appointments.view_all', 'patients.view', 'inventory.view', 'reports.view', 'feedback.view']));
  expect(admin.map((g: { label: string }) => g.label)).toEqual(['Clinic', 'Team', 'Operations', 'Business', 'System']);
  expect(admin[0].sections.map((s: { label: string }) => s.label)).toEqual(['Clinic Profile']);
  // The design's System group; Settings and Subscription need their own permissions.
  const system = admin[4].sections.map((s: { label: string }) => s.label);
  expect(system).toEqual(['Notifications']);

  const receptionist = drawerGroups(member(['clinic.view', 'appointments.view_all', 'patients.view']));
  expect(receptionist.map((g: { label: string }) => g.label)).toEqual(['Operations', 'System']);
});
