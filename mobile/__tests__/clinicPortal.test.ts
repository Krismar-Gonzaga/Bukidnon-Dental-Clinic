/**
 * Clinic portal helpers (src/services/clinicPortal.ts).
 */
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));

const { can, formatPeso, formatCount, monthChange } = require('../src/services/clinicPortal');

test('formats pesos and counts without relying on Intl', () => {
  expect(formatPeso(12000)).toBe('₱12,000');
  expect(formatPeso(1234567.6)).toBe('₱1,234,568');
  expect(formatPeso(0)).toBe('₱0');
  expect(formatCount(1248)).toBe('1,248');
});

test('describes the change from last month', () => {
  expect(monthChange(15, 10)).toEqual({ text: '+50% from last month', direction: 'up' });
  expect(monthChange(5, 10)).toEqual({ text: '-50% from last month', direction: 'down' });
  expect(monthChange(3, 0)).toEqual({ text: 'New activity this month', direction: 'flat' });
  expect(monthChange(0, 0)).toEqual({ text: 'No activity yet this month', direction: 'flat' });
});

test('permission checks use the membership from sign-in', () => {
  const admin = { clinic_id: 1, clinic_name: 'A', role: 'clinic_admin', permissions: ['clinic.staff.manage', 'reports.view'] };
  expect(can(admin, 'clinic.staff.manage')).toBe(true);
  expect(can(admin, 'records.view')).toBe(false);
  expect(can(undefined, 'clinic.staff.manage')).toBe(false);
});

test('stock status follows the web rule: critical at half the minimum or less', () => {
  const { stockStatus } = require('../src/services/clinicPortal');
  expect(stockStatus({ quantity_usable: 0, minimum_stock: 0 })).toBe('critical');
  expect(stockStatus({ quantity_usable: 5, minimum_stock: 10 })).toBe('critical');
  expect(stockStatus({ quantity_usable: 6, minimum_stock: 10 })).toBe('low');
  expect(stockStatus({ quantity_usable: 11, minimum_stock: 10 })).toBe('good');
});

test('the front desk reads a status the way the design shows it', () => {
  const { frontDeskStatus, hasCheckedIn } = require('../src/services/clinicPortal');
  expect(frontDeskStatus('in_progress')).toEqual({ label: 'Ongoing', tone: 'warning' });
  expect(frontDeskStatus('no_show').label).toBe('No-Show');
  expect(frontDeskStatus('something_new')).toEqual({ label: 'something_new', tone: 'neutral' });
  expect(hasCheckedIn('checked_in')).toBe(true);
  expect(hasCheckedIn('in_progress')).toBe(true);
  expect(hasCheckedIn('confirmed')).toBe(false);
});
