/**
 * Dentist portal logic: the schedule's calendar
 * ranges and the clinical record request body.
 */
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }), useFocusEffect: jest.fn() }));
// The screens' frame and auth pull in the offline database; only the logic is tested here.
jest.mock('../src/context/AuthContext', () => ({ useAuth: () => ({}) }));
jest.mock('../src/components/clinic/ClinicChrome', () => ({ ClinicScreen: () => null, useOpenSection: () => jest.fn() }));

const { viewRange } = require('../src/screens/clinic/ClinicScheduleScreen');
const { blankRecord, recordBody } = require('../src/components/clinic/RecordSheet');

test('calendar ranges: Monday-first weeks and whole weeks around a month', () => {
  expect(viewRange('day', '2026-11-04')).toEqual({ from: '2026-11-04', to: '2026-11-04', days: ['2026-11-04'] });
  const week = viewRange('week', '2026-11-04'); // a Wednesday
  expect([week.from, week.to, week.days.length]).toEqual(['2026-11-02', '2026-11-08', 7]);
  const month = viewRange('month', '2026-11-17');
  expect([month.from, month.to]).toEqual(['2026-10-26', '2026-12-06']);
  expect(month.days.length % 7).toBe(0);
});

test('record body trims text, links a chosen visit and adds the reason only for corrections', () => {
  const form = { ...blankRecord, record_type: 'treatment', findings: '  Caries on 16 ', notes: '   ', appointment_id: 31, amendment_reason: ' Wrong tooth ' };
  expect(recordBody(form, false)).toEqual(
    expect.objectContaining({ record_type: 'treatment', findings: 'Caries on 16', notes: null, appointment_id: 31 }),
  );
  expect(recordBody(form, false)).not.toHaveProperty('amendment_reason');
  expect(recordBody({ ...form, appointment_id: 0 }, true)).toEqual(expect.objectContaining({ amendment_reason: 'Wrong tooth' }));
  expect(recordBody({ ...form, appointment_id: 0 }, true)).not.toHaveProperty('appointment_id');
});
