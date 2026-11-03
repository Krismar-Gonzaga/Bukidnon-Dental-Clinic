import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import AdminApplicationDetailPage from './AdminApplicationDetailPage';
import AdminAuditLogPage from './AdminAuditLogPage';
import AdminClinicsPage from './AdminClinicsPage';
import AdminDashboardPage from './AdminDashboardPage';
import AdminSettingsPage from './AdminSettingsPage';
import AdminUsersPage from './AdminUsersPage';
import * as api from '../../services/adminApi';
import { getNotifications } from '../../services/notificationApi';
import { apiError, renderWithProviders } from '../../testUtils';
import { emptyNotifications } from '../../testFixtures';

jest.mock('../../services/adminApi');
jest.mock('../../services/notificationApi');

const ADMIN_USER = { id: 1, name: 'Platform Admin', email: 'admin@example.com', role: 'system_admin', memberships: [] };

const HEALTH = {
  status: 'healthy',
  environment: 'local',
  checked_at: '2026-10-30T09:00:00+08:00',
  checks: [
    { key: 'database', label: 'Database', status: 'ok', detail: 'Responding in 12 ms' },
    { key: 'queue', label: 'Background jobs (emails, reminders)', status: 'warn', detail: '0 waiting, 2 failed' },
  ],
};

const APPLICATION = {
  id: 5,
  status: 'under_review',
  clinic_name: 'Quezon Family Dental',
  address: 'Poblacion',
  city: 'Quezon',
  province: 'Bukidnon',
  contact_number: '0917',
  email: 'hello@quezondental.example',
  representative_name: 'Dr. Ana Reyes',
  applicant: { id: 9, name: 'Ana Reyes', email: 'ana@example.com' },
  documents: [{ id: 1, document_type: 'business_permit', original_name: 'permit.pdf', size: 2400000, uploaded_at: '2026-10-10T10:00:00+08:00' }],
  missing_documents: [],
  submitted_at: '2026-10-10T10:00:00+08:00',
  history: [
    { id: 30, action: 'clinic_application.submitted', actor: 'Ana Reyes', at: '2026-10-10T10:00:00+08:00' },
    { id: 31, action: 'clinic_application.review_started', actor: 'Platform Admin', at: '2026-10-11T09:00:00+08:00' },
  ],
};

const detailRoute = { user: ADMIN_USER, route: '/admin/applications/5', path: '/admin/applications/:applicationId' };
const passwordRequired = () => apiError(423, { message: 'Confirm your password to continue.', code: 'password_confirmation_required' });

beforeEach(() => {
  getNotifications.mockResolvedValue(emptyNotifications);
  api.getSystemHealth.mockResolvedValue(HEALTH);
  api.needsPasswordConfirmation.mockImplementation((error) => error?.response?.status === 423);
});

test('verification detail: documents open and download, snapshot and review history', async () => {
  api.getApplication.mockResolvedValue(APPLICATION);
  api.openApplicationDocument.mockResolvedValue();
  renderWithProviders(<AdminApplicationDetailPage />, detailRoute);

  expect(await screen.findByRole('heading', { name: 'Quezon Family Dental' })).toBeInTheDocument();
  expect(screen.getByText('1 File Uploaded')).toBeInTheDocument();
  expect(screen.getByText('permit.pdf • 2.3 MB')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^View Mayor's/ }));
  expect(api.openApplicationDocument).toHaveBeenCalledWith('admin', 5, 1, { download: false });
  fireEvent.click(screen.getByRole('button', { name: /^Download Mayor's/ }));
  expect(api.openApplicationDocument).toHaveBeenCalledWith('admin', 5, 1, { download: true });

  expect(screen.getByText('hello@quezondental.example')).toBeInTheDocument();
  const history = screen.getByRole('heading', { name: 'Review History' }).closest('section');
  expect(within(history).getByText('Manual review started')).toBeInTheDocument();
  expect(within(history).getByText('Submission received')).toBeInTheDocument();
});

test('approving asks for confirmation, then for the password when the server requires it', async () => {
  api.getApplication.mockResolvedValue(APPLICATION);
  api.approveApplication.mockRejectedValueOnce(passwordRequired()).mockResolvedValueOnce({});
  api.confirmAdminPassword.mockRejectedValueOnce(apiError(422, { message: 'The password is incorrect.', errors: { password: ['The password is incorrect.'] } })).mockResolvedValueOnce({});
  renderWithProviders(<AdminApplicationDetailPage />, detailRoute);

  fireEvent.click(await screen.findByRole('button', { name: 'Approve Clinic' }));
  const confirm = screen.getByRole('dialog', { name: 'Approve Quezon Family Dental?' });
  expect(api.approveApplication).not.toHaveBeenCalled();
  fireEvent.click(within(confirm).getByRole('button', { name: 'Approve clinic' }));

  const password = await screen.findByRole('dialog', { name: 'Confirm your password' });
  fireEvent.change(within(password).getByLabelText(/Password/), { target: { value: 'wrong' } });
  fireEvent.click(within(password).getByRole('button', { name: 'Confirm' }));
  expect(await within(password).findByText('The password is incorrect.')).toBeInTheDocument();
  expect(within(password).getByLabelText(/Password/)).toHaveValue('');

  fireEvent.change(within(password).getByLabelText(/Password/), { target: { value: 'Correct-Horse-42' } });
  fireEvent.click(within(password).getByRole('button', { name: 'Confirm' }));

  await waitFor(() => expect(api.approveApplication).toHaveBeenCalledTimes(2));
  expect(api.confirmAdminPassword).toHaveBeenLastCalledWith('Correct-Horse-42');
  expect(api.approveApplication).toHaveBeenLastCalledWith(5, undefined);
});

test('cancelling the password check changes nothing and says so', async () => {
  api.getApplication.mockResolvedValue(APPLICATION);
  api.rejectApplication.mockRejectedValue(passwordRequired());
  renderWithProviders(<AdminApplicationDetailPage />, detailRoute);

  fireEvent.click(await screen.findByRole('button', { name: 'Request More Info' }));
  const dialog = screen.getByRole('dialog', { name: 'Request more information' });
  const send = within(dialog).getByRole('button', { name: 'Send request' });
  expect(send).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText(/What the applicant needs to fix/), { target: { value: 'DOH license expired' } });
  fireEvent.click(send);

  const password = await screen.findByRole('dialog', { name: 'Confirm your password' });
  fireEvent.click(within(password).getByRole('button', { name: 'Cancel' }));
  expect(await within(dialog).findByText('Not done: your password was not confirmed.')).toBeInTheDocument();
  expect(api.rejectApplication).toHaveBeenCalledTimes(1);
});

test('approval is blocked while required documents are missing', async () => {
  api.getApplication.mockResolvedValue({ ...APPLICATION, missing_documents: ['doh_license'] });
  renderWithProviders(<AdminApplicationDetailPage />, detailRoute);

  expect(await screen.findByText(/Missing: DOH license to operate/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Approve Clinic' })).toBeDisabled();
});

test('an approved application shows the approval confirmation', async () => {
  api.getApplication.mockResolvedValue({ ...APPLICATION, status: 'approved', reviewed_at: '2026-10-12T10:00:00+08:00' });
  renderWithProviders(<AdminApplicationDetailPage />, detailRoute);

  expect(await screen.findByRole('heading', { name: 'Clinic approval confirmed' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Approve Clinic' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View in Verification' })).toHaveAttribute('href', '/admin/clinics?search=Quezon%20Family%20Dental');
});

test('internal notes are saved to the review history', async () => {
  api.getApplication.mockResolvedValue(APPLICATION);
  api.addApplicationNote.mockResolvedValue({
    data: [...APPLICATION.history, { id: 40, action: 'clinic_application.note_added', actor: 'Platform Admin', note: 'Permit checked with LGU', at: '2026-10-12T08:00:00+08:00' }],
  });
  renderWithProviders(<AdminApplicationDetailPage />, detailRoute);

  const save = await screen.findByRole('button', { name: 'Save Note' });
  expect(save).toBeDisabled();
  fireEvent.change(screen.getByLabelText('New note'), { target: { value: '  Permit checked with LGU ' } });
  fireEvent.click(save);

  expect(await screen.findByText('Permit checked with LGU')).toBeInTheDocument();
  expect(api.addApplicationNote).toHaveBeenCalledWith(5, 'Permit checked with LGU');
  expect(screen.getByLabelText('New note')).toHaveValue('');
});

test('dashboard: figures, registration queue, activity and security overview', async () => {
  api.getAdminDashboard.mockResolvedValue({
    clinics: { total: 24, listed: 18, suspended: 1, new_this_month: 3 },
    applications: { pending: 3, under_review: 2, approved: 10, rejected: 1 },
    queue: [{ id: 5, clinic_name: 'Quezon Family Dental', city: 'Quezon', province: 'Bukidnon', status: 'pending', submitted_at: '2026-10-10T10:00:00+08:00' }],
    users: { patient: 40 },
    open_review_reports: 2,
    security: { failed_logins_24h: 12, blocked_logins_24h: 0, failed_password_confirmations_24h: 1, suspended_users: 3 },
    activity_by_day: [{ date: '2026-10-29', total: 4 }, { date: '2026-10-30', total: 9 }],
    recent_activity: [{ id: 1, action: 'clinic.suspended', actor: 'Platform Admin', subject_type: 'Clinic', subject_id: 2, subject_label: 'Valencia Smiles', created_at: '2026-10-30T08:00:00+08:00' }],
  });
  renderWithProviders(<AdminDashboardPage />, { user: ADMIN_USER, route: '/admin', path: '/admin' });

  expect(await screen.findByText('+3 this month')).toBeInTheDocument();
  expect(screen.getByText('High')).toBeInTheDocument(); // 5 waiting
  expect(screen.getByRole('link', { name: 'Review Quezon Family Dental' })).toHaveAttribute('href', '/admin/applications/5');
  expect(screen.getByText('Valencia Smiles')).toBeInTheDocument();
  expect(screen.getByText(/suspended by Platform Admin/)).toBeInTheDocument();
  expect(screen.getByText('13 events')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Detailed Audit' })).toHaveAttribute('href', '/admin/audit-logs?action=auth.login_failed');
  expect(screen.getByRole('link', { name: 'Review Accounts' })).toHaveAttribute('href', '/admin/users?status=suspended');
  expect(await screen.findByText('System Status: Healthy')).toBeInTheDocument();
  expect(screen.getByText('12 ms')).toBeInTheDocument();
});

test('settings shows every health check', async () => {
  renderWithProviders(<AdminSettingsPage />, { user: ADMIN_USER, route: '/admin/settings', path: '/admin/settings' });

  expect(await screen.findByText('Responding in 12 ms')).toBeInTheDocument();
  expect(screen.getByText('0 waiting, 2 failed')).toBeInTheDocument();
  expect(screen.getByText('Attention')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Change Password' })).toHaveAttribute('href', '/admin/password');
});

test('suspending a user needs a reason and a confirmation; admins cannot manage themselves', async () => {
  api.getUsers.mockResolvedValue({
    items: [
      { id: 1, name: 'Platform Admin', email: 'admin@example.com', role: 'system_admin', status: 'active', clinic_memberships: 0, created_at: '2026-01-01T00:00:00+08:00' },
      { id: 4, name: 'Juan Dela Cruz', email: 'juan@example.com', role: 'patient', status: 'active', clinic_memberships: 0, created_at: '2026-02-01T00:00:00+08:00' },
    ],
    meta: { last_page: 1 },
  });
  api.updateUser.mockResolvedValue({});
  renderWithProviders(<AdminUsersPage />, { user: ADMIN_USER });

  expect(await screen.findByText('Juan Dela Cruz')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Manage' })).toHaveLength(1);

  fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
  const dialog = screen.getByRole('dialog', { name: 'Manage Juan Dela Cruz' });
  fireEvent.change(within(dialog).getByLabelText('Status'), { target: { value: 'suspended' } });
  fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'Abusive messages' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

  expect(within(dialog).getByText(/Suspend the account and sign them out on every device/)).toBeInTheDocument();
  expect(api.updateUser).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm change' }));

  await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith(4, { status: 'suspended', reason: 'Abusive messages' }));
});

const APP_SUMMARY = {
  pending: 24,
  under_review: 8,
  submitted_this_week: 5,
  submitted_last_week: 3,
  needs_attention: 3,
  verified_today: 15,
  average_decision_hours: 4.2,
  decisions_last_30_days: 20,
  oldest_open_id: 7,
  attention_days: 3,
  required_documents: ['business_permit', 'doh_license', 'prc_id', 'bir_registration'],
};

const REGISTRATIONS = [
  { ...APPLICATION, id: 7, reference: 'REG-00007', document_status: 'missing_info', priority: 'high', missing_documents: ['prc_id'] },
  { ...APPLICATION, id: 8, clinic_name: 'Valencia Smiles', reference: 'REG-00008', status: 'approved', document_status: 'verified', priority: null },
];

const onePage = (items) => ({ items, meta: { current_page: 1, last_page: 1, per_page: 10, total: items.length } });

test('verification: live figures, document status, priority and the needs-attention list', async () => {
  api.getApplicationSummary.mockResolvedValue(APP_SUMMARY);
  api.getApplications.mockResolvedValue(onePage(REGISTRATIONS));
  renderWithProviders(<AdminClinicsPage />, { user: ADMIN_USER, route: '/admin/clinics' });

  expect(await screen.findByRole('heading', { level: 1, name: 'Clinic Verification' })).toBeInTheDocument();
  expect(await screen.findByText('+5 submitted this week (3 last week)')).toBeInTheDocument();
  expect(screen.getByText('Avg. decision time: 4.2 hrs')).toBeInTheDocument();

  const row = (await screen.findByText('REG-00007')).closest('tr');
  expect(within(row).getByText('Missing Info')).toBeInTheDocument();
  expect(within(row).getByText('High')).toBeInTheDocument();
  expect(within(row).getByRole('link', { name: 'Resolve issues for Quezon Family Dental' })).toHaveAttribute('href', '/admin/applications/7');
  expect(within(screen.getByText('REG-00008').closest('tr')).getByText('Verified')).toBeInTheDocument();
  expect(screen.getByText('Showing 1–2 of 2 registrations')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Review Oldest Registration/ })).toHaveAttribute('href', '/admin/applications/7');

  fireEvent.click(screen.getByRole('button', { name: /Needs Attention/, pressed: false }));
  await waitFor(() => expect(api.getApplications).toHaveBeenLastCalledWith(expect.objectContaining({ view: 'attention', page: 1, per_page: 10 })));
});

test('verification: exporting asks for the password, and clinics are suspended from the verified list', async () => {
  api.getApplicationSummary.mockResolvedValue(APP_SUMMARY);
  api.getApplications.mockResolvedValue(onePage(REGISTRATIONS));
  api.exportApplicationsCsv.mockRejectedValueOnce(passwordRequired()).mockResolvedValueOnce();
  api.confirmAdminPassword.mockResolvedValue({});
  api.getAdminClinics.mockResolvedValue(
    onePage([{ id: 10, name: 'Valencia Smiles', city: 'Valencia', status: 'approved', is_published: true, members_count: 4, branches_count: 2 }])
  );
  api.suspendClinic.mockResolvedValue({});
  renderWithProviders(<AdminClinicsPage />, { user: ADMIN_USER, route: '/admin/clinics' });

  fireEvent.click(await screen.findByRole('button', { name: 'Export CSV' }));
  const password = await screen.findByRole('dialog', { name: 'Confirm your password' });
  fireEvent.change(within(password).getByLabelText(/Password/), { target: { value: 'Correct-Horse-42' } });
  fireEvent.click(within(password).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.exportApplicationsCsv).toHaveBeenCalledTimes(2));

  fireEvent.click(screen.getByRole('button', { name: 'Verified Clinics' }));
  expect(await screen.findByText('CLIN-00010')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Suspend Valencia Smiles' }));
  const dialog = screen.getByRole('dialog', { name: 'Suspend Valencia Smiles?' });
  expect(within(dialog).getByRole('button', { name: 'Suspend clinic' })).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'Expired permit' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Suspend clinic' }));
  await waitFor(() => expect(api.suspendClinic).toHaveBeenCalledWith(10, 'Expired permit'));
});

const AUDIT_SUMMARY = {
  total_events: 120,
  previous_total: 100,
  failed_logins: 24,
  blocked_logins: 2,
  failed_login_ips: 4,
  critical_actions: 6,
  integrity: { unsealed: 3, last_report: { status: 'verified', checked: 117, pending: 0, problems: [], checked_at: '2026-10-30T09:00:00+08:00' } },
};

const AUDIT_ROWS = [
  {
    id: 51,
    action: 'auth.login_failed',
    label: 'Failed sign-in attempt',
    category: 'security',
    outcome: 'failed',
    user_id: null,
    user_name: null,
    user_role: null,
    subject_label: null,
    detail: 'Email: admin@example.com',
    metadata: { email: 'admin@example.com' },
    ip_address: '102.33.21.1',
    user_agent: 'Firefox',
    sealed: true,
    created_at: '2026-10-30T13:55:01+08:00',
  },
  {
    id: 50,
    action: 'clinic_application.approved',
    label: 'Approved clinic registration',
    category: 'verification',
    outcome: 'success',
    user_id: 1,
    user_name: 'Platform Admin',
    user_role: 'system_admin',
    subject_label: 'SmileCraft Dental',
    detail: null,
    metadata: null,
    ip_address: '192.168.1.104',
    user_agent: 'Chrome',
    sealed: false,
    created_at: '2026-10-30T14:22:15+08:00',
  },
];

test('audit log: figures, readable events, filters and event details', async () => {
  api.getAuditSummary.mockResolvedValue(AUDIT_SUMMARY);
  api.getAuditLogs.mockResolvedValue(onePage(AUDIT_ROWS));
  renderWithProviders(<AdminAuditLogPage />, { user: ADMIN_USER, route: '/admin/audit-logs?action=auth.login_failed' });

  expect(await screen.findByText('+20% from previous 24 hours')).toBeInTheDocument();
  expect(screen.getByText('2 blocked · from 4 IPs')).toBeInTheDocument();
  expect(screen.getByText('Verified')).toBeInTheDocument();
  expect(api.getAuditLogs).toHaveBeenCalledWith(expect.objectContaining({ range: '24h', action: 'auth.login_failed' }));

  const failed = (await screen.findByText('Failed sign-in attempt')).closest('tr');
  expect(within(failed).getByText('Not signed in')).toBeInTheDocument();
  expect(within(failed).getByText('Failed')).toBeInTheDocument();
  expect(within(failed).getByText('13:55:01')).toBeInTheDocument();
  expect(within(screen.getByText('Approved clinic registration').closest('tr')).getByText('SmileCraft Dental')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Action Type'), { target: { value: 'security' } });
  fireEvent.change(screen.getByLabelText('User Role'), { target: { value: 'none' } });
  await waitFor(() => expect(api.getAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'security', role: 'none', page: 1 })));
  fireEvent.click(screen.getByRole('button', { name: 'Remove action filter' }));
  await waitFor(() => expect(api.getAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ action: undefined })));

  fireEvent.click(screen.getByRole('button', { name: 'Details of event 50' }));
  const details = screen.getByRole('dialog', { name: 'Event details' });
  expect(within(details).getByText('Waiting to be sealed (within 5 minutes)')).toBeInTheDocument();
});

test('audit log: integrity check reports problems; export needs the password', async () => {
  api.getAuditSummary.mockResolvedValue(AUDIT_SUMMARY);
  api.getAuditLogs.mockResolvedValue(onePage(AUDIT_ROWS));
  api.checkAuditIntegrity.mockResolvedValue({
    status: 'failed',
    checked: 117,
    pending: 1,
    checked_at: '2026-10-30T09:05:00+08:00',
    problems: [{ id: 12, type: 'modified', message: 'This entry was changed after it was sealed.' }],
  });
  api.exportAuditCsv.mockRejectedValue(passwordRequired());
  renderWithProviders(<AdminAuditLogPage />, { user: ADMIN_USER, route: '/admin/audit-logs' });

  fireEvent.click(await screen.findByRole('button', { name: /Run Integrity Check/ }));
  const report = await screen.findByRole('dialog', { name: 'Integrity report' });
  expect(within(report).getByText('The audit log has been altered outside the application.')).toBeInTheDocument();
  expect(within(report).getByText('This entry was changed after it was sealed.')).toBeInTheDocument();
  fireEvent.click(within(report).getByRole('button', { name: 'Done' }));

  fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
  const password = await screen.findByRole('dialog', { name: 'Confirm your password' });
  fireEvent.click(within(password).getByRole('button', { name: 'Cancel' }));
  expect(await screen.findByText('Not done: your password was not confirmed.')).toBeInTheDocument();
  expect(api.exportAuditCsv).toHaveBeenCalledTimes(1);
});
