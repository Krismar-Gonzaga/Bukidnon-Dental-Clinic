/**
 * System admin logic on the phone: password re-confirmation (423 → prompt →
 * retry), change summaries and the dashboard activity sentences.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { extra: {} } } }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }), useFocusEffect: jest.fn() }));

const { useSensitiveAction, CANCELLED_MESSAGE, actionError } = require('../src/components/admin/AdminSecurity');
const {
  activityText,
  auditMetrics,
  auditTrend,
  describeUserChange,
  documentUrl,
  exportApplicationsCsv,
  exportAuditCsv,
  MOBILE_EXPORT_ROWS,
  needsPasswordConfirmation,
  verificationMetrics,
} = require('../src/services/admin');
const api = require('../src/services/http').default;

const locked = () => Object.assign(new Error('Locked'), { response: { status: 423, data: { code: 'password_confirmation_required' } } });

/** Renders the hook and returns its latest value. */
function renderSensitive() {
  const current: { value: any } = { value: null };
  const Probe = () => {
    current.value = useSensitiveAction();
    return null;
  };
  ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<Probe />);
  });
  return current;
}

test('a 423 asks for the password, then runs the action again', async () => {
  const sensitive = renderSensitive();
  const call = jest.fn().mockRejectedValueOnce(locked()).mockResolvedValueOnce('done');

  let result: Promise<string>;
  await ReactTestRenderer.act(async () => {
    result = sensitive.value.run(call);
  });
  expect(sensitive.value.asking).toBe(true);
  expect(call).toHaveBeenCalledTimes(1);

  await ReactTestRenderer.act(async () => {
    sensitive.value.settle(true);
  });
  await expect(result!).resolves.toBe('done');
  expect(call).toHaveBeenCalledTimes(2);
  expect(sensitive.value.asking).toBe(false);
});

test('cancelling the password check rejects without retrying', async () => {
  const sensitive = renderSensitive();
  const call = jest.fn().mockRejectedValue(locked());

  let result: Promise<unknown>;
  await ReactTestRenderer.act(async () => {
    result = sensitive.value.run(call).catch((e: unknown) => e);
  });
  await ReactTestRenderer.act(async () => {
    sensitive.value.settle(false);
  });
  const error = await result!;
  expect(actionError(error, 'fallback')).toBe(CANCELLED_MESSAGE);
  expect(call).toHaveBeenCalledTimes(1);
});

test('other errors pass straight through', async () => {
  const sensitive = renderSensitive();
  const failure = Object.assign(new Error('Nope'), { response: { status: 422, data: { message: 'Reason is required.' } } });
  await expect(sensitive.value.run(() => Promise.reject(failure))).rejects.toBe(failure);
  expect(needsPasswordConfirmation(failure)).toBe(false);
  expect(needsPasswordConfirmation(locked())).toBe(true);
});

test('account changes are summarised before they are saved', () => {
  const user = { id: 4, name: 'Juan', email: 'j@example.com', role: 'patient', status: 'active', clinic_memberships: 0, created_at: null, suspended_at: null };
  expect(describeUserChange(user, { role: 'system_admin', status: 'active' })).toEqual([
    'Change account type from Patient to System Admin.',
    'They will be able to approve clinics, suspend accounts and read the audit log.',
  ]);
  expect(describeUserChange(user, { role: 'patient', status: 'suspended' })).toEqual(['Suspend the account and sign them out on every device.']);
});

test('activity entries read as sentences', () => {
  expect(
    activityText({ id: 1, action: 'clinic.suspended', actor: 'Sam Admin', subject_type: 'Clinic', subject_id: 2, subject_label: 'Valencia Smiles', created_at: '' }),
  ).toBe('Valencia Smiles suspended by Sam Admin.');
});

test('verification cards show the live figures', () => {
  const cards = verificationMetrics({
    pending: 4, under_review: 2, submitted_this_week: 3, submitted_last_week: 1, missing_info: 0, overdue: 1, needs_attention: 1, returned: 0,
    verified_today: 0, returned_today: 0, average_decision_hours: 4.2, decisions_last_30_days: 5, oldest_open_id: 7, attention_days: 3,
    required_documents: ['business_permit'],
  });
  expect(cards.map((c: any) => [c.label, c.value, c.note])).toEqual([
    ['Total pending', '04', '+3 submitted this week'],
    ['In review', '02', 'Avg. decision: 4.2 hrs'],
    ['Critical action', '01', 'Waiting 3+ days or missing documents'],
    ['Verified today', '00', '5 decisions in 30 days'],
  ]);
  expect(cards[2].tone).toBe('danger');
});

test('audit cards compare with the previous window and show integrity', () => {
  const summary = {
    total_events: 120, previous_total: 100, failed_logins: 3, blocked_logins: 1, failed_login_ips: 2, critical_actions: 6,
    integrity: { unsealed: 2, last_report: { status: 'failed', checked: 10, sealed_through_id: 10, pending: 0, problems: [], checked_at: '' } },
  };
  const cards = auditMetrics(summary, '24h');
  expect(cards[0].note).toBe('+20% from the previous 24 hours');
  expect(cards[1].note).toBe('1 blocked · from 2 IPs');
  expect(cards[3]).toMatchObject({ value: 'Problems', tone: 'danger', note: '2 awaiting seal' });
  expect(auditTrend({ ...summary, previous_total: null }, '24 hours')).toBe('All recorded events');
});

test('exports are fetched as text, limited for sharing, and a text 423 still asks for the password', async () => {
  const get = jest.spyOn(api, 'get').mockResolvedValueOnce({ data: '﻿ID,Time\n1,x' });
  await expect(exportAuditCsv({ range: '24h' })).resolves.toBe('ID,Time\n1,x');
  expect(get).toHaveBeenCalledWith('/admin/audit-logs/export', { params: { range: '24h', limit: MOBILE_EXPORT_ROWS }, responseType: 'text' });

  get.mockRejectedValueOnce(Object.assign(new Error('Locked'), { response: { status: 423, data: '{"code":"password_confirmation_required"}' } }));
  const error = await exportApplicationsCsv({}).catch((e: unknown) => e);
  expect(needsPasswordConfirmation(error)).toBe(true);
  get.mockRestore();
});

test('document links are signed by the server and opened from the API origin', async () => {
  const get = jest.spyOn(api, 'get').mockResolvedValue({ data: { data: { url: '/api/documents/3/download?download=1&signature=abc' } } });
  await expect(documentUrl(5, 3, true)).resolves.toBe('http://127.0.0.1:8000/api/documents/3/download?download=1&signature=abc');
  expect(get).toHaveBeenCalledWith('/admin/clinic-applications/5/documents/3/link', { params: { download: 1 } });
  get.mockRestore();
});
