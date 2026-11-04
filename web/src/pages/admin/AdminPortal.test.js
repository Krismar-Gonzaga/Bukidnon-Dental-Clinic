import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import AdminAnnouncementFormPage from './AdminAnnouncementFormPage';
import AdminAnnouncementsPage from './AdminAnnouncementsPage';
import AdminApplicationDetailPage from './AdminApplicationDetailPage';
import AdminApplicationsPage from './AdminApplicationsPage';
import AdminAuditLogPage from './AdminAuditLogPage';
import AdminClinicDetailPage from './AdminClinicDetailPage';
import AdminClinicsPage from './AdminClinicsPage';
import AdminDashboardPage from './AdminDashboardPage';
import AdminProfilePage from './AdminProfilePage';
import AdminReportsPage from './AdminReportsPage';
import AdminSettingsPage from './AdminSettingsPage';
import AdminSubscriptionDetailPage from './AdminSubscriptionDetailPage';
import AdminSubscriptionsPage from './AdminSubscriptionsPage';
import AdminUsersPage from './AdminUsersPage';
import * as api from '../../services/adminApi';
import { getNotificationPreferences, getNotifications, updateNotificationPreferences } from '../../services/notificationApi';
import { changePassword } from '../../services/authService';
import { apiError, renderWithProviders } from '../../testUtils';
import { emptyNotifications } from '../../testFixtures';

jest.mock('../../services/adminApi');
jest.mock('../../services/notificationApi');
jest.mock('../../services/authService', () => ({
  ...jest.requireActual('../../services/authService'),
  changePassword: jest.fn(),
  updateAccount: jest.fn(),
}));

const ADMIN_USER = { id: 1, name: 'Rhea Delos Reyes', email: 'rhea@example.com', phone: '+63 912 000 0001', role: 'system_admin', memberships: [] };
const asAdmin = (route, path) => ({ user: ADMIN_USER, route, path: path ?? route });
const passwordRequired = () => apiError(423, { message: 'Confirm your password to continue.', code: 'password_confirmation_required' });
const dialog = () => screen.findByRole('dialog');
const page = (items, total = items.length) => ({ items, meta: { total, current_page: 1, last_page: 1, per_page: 25 } });

const APPLICATION = {
  id: 5,
  status: 'under_review',
  clinic_name: 'Kitaotao Family Dental',
  address: 'Poblacion',
  city: 'Kitaotao',
  province: 'Bukidnon',
  contact_number: '0917',
  email: 'hello@kitaotao.example',
  representative_name: 'Ramon Villanueva',
  applicant: { id: 9, name: 'Ramon Villanueva', email: 'ramon@example.com' },
  documents: [{ id: 1, document_type: 'business_permit', original_name: 'permit.pdf', size: 2400000, uploaded_at: '2026-10-10T10:00:00+08:00' }],
  missing_documents: [],
  documents_requested: false,
  submitted_at: '2026-08-05T10:00:00+08:00',
  history: [{ id: 30, action: 'clinic_application.submitted', actor: 'Ramon Villanueva', at: '2026-08-05T10:00:00+08:00' }],
};

const DASHBOARD = {
  clinics: { total: 7, listed: 3, verified: 4, suspended: 1, new_this_month: 1 },
  applications: { pending: 1, under_review: 1, approved: 4, rejected: 1 },
  queue: [
    { id: 11, clinic_name: 'Kitaotao Family Dental', status: 'pending', submitted_at: '2026-08-05T10:00:00+08:00' },
    { id: 12, clinic_name: 'Don Carlos Dental', status: 'under_review', submitted_at: '2026-11-02T10:00:00+08:00' },
  ],
  users: { patient: 2, dentist: 1, staff: 1, clinic_admin: 3, system_admin: 1 },
  open_review_reports: 0,
  security: { failed_logins_24h: 0, blocked_logins_24h: 0, failed_password_confirmations_24h: 0, suspended_users: 1 },
  activity_by_day: [],
  recent_activity: [],
  total_appointments: 1284,
  active_subscriptions: 3,
  active_announcements: 2,
  pending_payments: { total: 1, items: [{ id: 3, clinic_id: 2, clinic_name: 'Valencia Smile Center', submitted_at: '2026-07-14T16:30:00+08:00' }] },
  platform_growth: [
    { month: '2026-06', label: 'Jun', total: 150 },
    { month: '2026-07', label: 'Jul', total: 190 },
  ],
  recent_audit: [{ id: 1, label: 'Approved clinic registration', module: 'Clinic verification', outcome: 'success', user_name: 'Admin Rhea', subject_label: 'Braganza Dental', created_at: '2026-07-15T09:14:00+08:00' }],
};

const SETTINGS = {
  platform_name: 'BukidnonDental',
  support_email: 'help@example.com',
  maintenance_mode: false,
  allow_self_registration: true,
  session_timeout_minutes: 30,
  require_verification: true,
  required_documents: ['business_permit', 'doh_license', 'prc_id', 'bir_registration'],
  payment_grace_days: 7,
  document_types: ['business_permit', 'doh_license', 'prc_id', 'bir_registration'],
  plans: [{ key: 'starter', name: 'Starter', price: 1999, limits: '1 dentist, 1 branch' }],
};

const SUBSCRIPTION = {
  clinic_id: 2,
  clinic_name: 'Valencia Smile Center',
  plan_key: 'starter',
  plan: 'Starter',
  amount: 1999,
  due_at: '2025-03-15T00:00:00+08:00',
  status: 'pending_payment',
  payment_status: 'pending',
  payment_id: 3,
  payment: { id: 3, status: 'pending', amount: 1999, method: 'GCash', reference: 'REF1', submitted_by: 'Jose Santos', submitted_at: '2026-07-14T16:30:00+08:00' },
  history: [],
  plans: [
    { key: 'starter', name: 'Starter', price: 1999 },
    { key: 'enterprise', name: 'Enterprise', price: 9999 },
  ],
};

const REPORTS = {
  month: '2026-11',
  month_label: 'November 2026',
  previous_label: 'October 2026',
  overview: {
    clinic_growth: [{ month: '2026-11', label: 'Nov', total: 7 }],
    plans: [
      { key: 'starter', name: 'Starter', total: 2 },
      { key: 'enterprise', name: 'Enterprise', total: 1 },
    ],
  },
  clinics: [{ metric: 'New Registrations', current: 2, previous: 1, change: 1 }],
  users: [{ metric: 'New Dentists', current: 1, previous: 2, change: -1 }],
  subscriptions: [{ metric: 'Active Subscriptions', current: 4, previous: 3, change: 1 }],
};

beforeEach(() => {
  getNotifications.mockResolvedValue(emptyNotifications);
  api.needsPasswordConfirmation.mockImplementation((error) => error?.response?.status === 423);
});

test('dashboard shows the live platform figures, pending actions and audit activity', async () => {
  api.getAdminDashboard.mockResolvedValue(DASHBOARD);
  renderWithProviders(<AdminDashboardPage />, asAdmin('/admin'));

  expect(await screen.findByText('Welcome back,')).toBeInTheDocument();
  expect(screen.getByText('1,284')).toBeInTheDocument();
  expect(screen.getByText('Total Appointments')).toBeInTheDocument();
  expect(screen.getByText('4 verified')).toBeInTheDocument();
  expect(screen.getByText('2 clinic(s)')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Review Kitaotao Family Dental' })).toHaveAttribute('href', '/admin/applications/11');
  expect(screen.getByRole('link', { name: 'Verify payment from Valencia Smile Center' })).toHaveAttribute('href', '/admin/subscriptions/2');
  expect(screen.getByText('Approved clinic registration — Braganza Dental')).toBeInTheDocument();
  expect(screen.getByText('Clinic Admins')).toBeInTheDocument();
});

test('the sidebar has the sections of the design and marks the current one', async () => {
  api.getAdminDashboard.mockResolvedValue(DASHBOARD);
  renderWithProviders(<AdminDashboardPage />, asAdmin('/admin'));

  const nav = await screen.findByRole('navigation', { name: 'Administration' });
  ['Clinic Management', 'User Management', 'Clinic Verification', 'Subscriptions', 'Reports & Analytics', 'System Notifications', 'Audit Logs', 'System Settings', 'My Profile'].forEach((label) =>
    expect(within(nav).getByRole('link', { name: label })).toBeInTheDocument()
  );
  expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
});

test('clinic management lists clinics and registrations; approving asks first, then for the password', async () => {
  api.getClinicDirectory.mockResolvedValue(
    page([
      { kind: 'clinic', id: 1, name: 'Braganza Dental Clinic', city: 'Valencia City', status: 'approved', admin: 'Dr. Maria Braganza', plan: 'Professional', application_id: 8 },
      { kind: 'application', id: 5, name: 'Kitaotao Family Dental', city: 'Kitaotao', status: 'pending', admin: 'Ramon Villanueva', plan: 'Professional', application_id: 5, missing_documents: 0 },
    ])
  );
  api.approveApplication.mockRejectedValueOnce(passwordRequired()).mockResolvedValueOnce({});
  api.confirmAdminPassword.mockResolvedValue({});
  renderWithProviders(<AdminClinicsPage />, asAdmin('/admin/clinics'));

  expect(await screen.findByText('2 registered clinics')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Braganza Dental Clinic' })).toHaveAttribute('href', '/admin/clinics/1');
  expect(screen.getByRole('link', { name: 'Kitaotao Family Dental' })).toHaveAttribute('href', '/admin/applications/5');
  expect(screen.getByText('Valencia City · Admin: Dr. Maria Braganza · Plan: Professional')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Approve Braganza Dental Clinic' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Approve Kitaotao Family Dental' }));
  fireEvent.click(within(await dialog()).getByRole('button', { name: 'Confirm' }));
  fireEvent.change(await screen.findByLabelText(/^Password/), { target: { value: 'secret' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.approveApplication).toHaveBeenCalledTimes(2));

  fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'pending' } });
  await waitFor(() => expect(api.getClinicDirectory).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'pending' })));
});

test('clinic details: plan, activity without names, and suspending needs a reason', async () => {
  api.getAdminClinic.mockResolvedValue({
    id: 1,
    name: 'Braganza Dental Clinic',
    city: 'Valencia City',
    status: 'approved',
    admin: 'Dr. Maria Braganza',
    plan: 'Professional',
    since: '2024-01-15T00:00:00+08:00',
    renews_at: '2027-01-15T00:00:00+08:00',
    subscription_status: 'active',
    application_id: 8,
    activity: [{ id: 1, label: 'New appointment request', at: '2026-07-15T10:00:00+08:00' }],
  });
  api.suspendClinic.mockResolvedValue({});
  renderWithProviders(<AdminClinicDetailPage />, asAdmin('/admin/clinics/1', '/admin/clinics/:clinicId'));

  expect(await screen.findByRole('heading', { name: 'Braganza Dental Clinic' })).toBeInTheDocument();
  expect(screen.getByText('Jan 2024')).toBeInTheDocument();
  expect(screen.getByText('Jan 2027')).toBeInTheDocument();
  expect(screen.getByText('New appointment request — Jul 15, 2026')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View Verification' })).toHaveAttribute('href', '/admin/applications/8');

  fireEvent.click(screen.getByRole('button', { name: 'Suspend Clinic' }));
  const box = await dialog();
  expect(within(box).getByRole('button', { name: 'Confirm Suspend' })).toBeDisabled();
  fireEvent.change(within(box).getByLabelText(/^Reason/), { target: { value: 'Expired permit' } });
  fireEvent.click(within(box).getByRole('button', { name: 'Confirm Suspend' }));
  await waitFor(() => expect(api.suspendClinic).toHaveBeenCalledWith(1, 'Expired permit'));
});

test('user management: filters, suspend with a reason, reactivate, and no action on yourself', async () => {
  api.getUsers.mockResolvedValue(
    page([
      { id: 1, name: 'Rhea Delos Reyes', email: 'rhea@example.com', role: 'system_admin', status: 'active', clinic_name: null, created_at: '2024-01-10T00:00:00+08:00' },
      { id: 2, name: 'Maria Santos', email: 'maria@example.com', role: 'patient', status: 'active', clinic_name: null, created_at: '2025-06-10T00:00:00+08:00' },
      { id: 3, name: 'Ben Aquino', email: 'ben@example.com', role: 'clinic_admin', status: 'suspended', clinic_name: 'Impasugong Smile', created_at: '2025-10-10T00:00:00+08:00' },
    ])
  );
  api.updateUser.mockResolvedValue({});
  renderWithProviders(<AdminUsersPage />, asAdmin('/admin/users'));

  expect(await screen.findByText('3 users on the platform')).toBeInTheDocument();
  expect(screen.getByText('Impasugong Smile')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Suspend Rhea Delos Reyes' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Suspend Maria Santos' }));
  let box = await dialog();
  expect(within(box).getByText(/this user account/)).toBeInTheDocument();
  fireEvent.change(within(box).getByLabelText(/^Reason/), { target: { value: 'Abuse' } });
  fireEvent.click(within(box).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith(2, { status: 'suspended', reason: 'Abuse' }));

  fireEvent.click(await screen.findByRole('button', { name: 'Reactivate Ben Aquino' }));
  box = await dialog();
  fireEvent.click(within(box).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith(3, { status: 'active' }));

  fireEvent.change(screen.getByLabelText('Filter by role'), { target: { value: 'patient' } });
  await waitFor(() => expect(api.getUsers).toHaveBeenLastCalledWith(expect.objectContaining({ role: 'patient' })));
});

test('account type can still be changed, from the person\'s name', async () => {
  api.getUsers.mockResolvedValue(page([{ id: 2, name: 'Maria Santos', email: 'maria@example.com', role: 'patient', status: 'active', created_at: '2025-06-10T00:00:00+08:00' }]));
  api.updateUser.mockResolvedValue({});
  renderWithProviders(<AdminUsersPage />, asAdmin('/admin/users'));

  fireEvent.click(await screen.findByRole('button', { name: 'Change account type of Maria Santos' }));
  const box = await dialog();
  fireEvent.change(within(box).getByLabelText(/^Account type/), { target: { value: 'system_admin' } });
  expect(within(box).getByText(/approve clinics, suspend accounts/)).toBeInTheDocument();
  fireEvent.click(within(box).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith(2, { role: 'system_admin' }));
});

test('verification list: admin, documents and notes; rejecting needs a reason', async () => {
  api.getApplications.mockResolvedValue(
    page([
      { ...APPLICATION, status: 'pending', document_status: 'pending', documents_submitted: 4, documents_required: 4 },
      { ...APPLICATION, id: 6, clinic_name: 'Don Carlos Dental', missing_documents: ['bir_registration'], document_status: 'missing_info', documents_submitted: 3, documents_required: 4 },
      { ...APPLICATION, id: 7, clinic_name: 'Impasugong Smile Clinic', status: 'rejected', review_notes: 'DOH License required.', document_status: 'returned', documents_submitted: 4, documents_required: 4 },
    ])
  );
  api.rejectApplication.mockResolvedValue({});
  renderWithProviders(<AdminApplicationsPage />, asAdmin('/admin/applications'));

  expect(await screen.findByText('3 verification requests')).toBeInTheDocument();
  expect(screen.getAllByText(/Docs: 4\/4/).length).toBe(2);
  expect(screen.getByText('BIR Registration missing.')).toBeInTheDocument();
  expect(screen.getByText('DOH License required.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Approve Don Carlos Dental' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Approve Impasugong Smile Clinic' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Reject Don Carlos Dental' }));
  const box = await dialog();
  fireEvent.change(within(box).getByLabelText(/^Reason/), { target: { value: 'Add the BIR certificate' } });
  fireEvent.click(within(box).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.rejectApplication).toHaveBeenCalledWith(6, 'Add the BIR certificate'));
});

test('verification review: documents open, and all three decisions work', async () => {
  api.getApplication.mockResolvedValue({ ...APPLICATION, missing_documents: ['doh_license'] });
  api.openApplicationDocument.mockResolvedValue();
  api.requestApplicationDocuments.mockResolvedValue({});
  api.rejectApplication.mockResolvedValue({});
  renderWithProviders(<AdminApplicationDetailPage />, asAdmin('/admin/applications/5', '/admin/applications/:applicationId'));

  expect(await screen.findByRole('heading', { name: 'Kitaotao Family Dental' })).toBeInTheDocument();
  expect(screen.getByText('Missing')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View Business Permit' }));
  expect(api.openApplicationDocument).toHaveBeenCalledWith('admin', 5, 1, { download: false });
  fireEvent.click(screen.getByRole('button', { name: 'Download Business Permit' }));
  expect(api.openApplicationDocument).toHaveBeenCalledWith('admin', 5, 1, { download: true });
  expect(screen.getByRole('button', { name: 'Approve Clinic' })).toBeDisabled();

  fireEvent.click(screen.getByRole('button', { name: 'Request More Documents' }));
  let box = await dialog();
  fireEvent.change(within(box).getByLabelText(/^What the applicant needs/), { target: { value: 'Current DOH license' } });
  fireEvent.click(within(box).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.requestApplicationDocuments).toHaveBeenCalledWith(5, 'Current DOH license'));

  fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
  box = await dialog();
  fireEvent.change(within(box).getByLabelText(/^Reason/), { target: { value: 'Not a dental clinic' } });
  fireEvent.click(within(box).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.rejectApplication).toHaveBeenCalledWith(5, 'Not a dental clinic'));
});

test('verification review: cancelling the password check changes nothing and says so', async () => {
  api.getApplication.mockResolvedValue(APPLICATION);
  api.approveApplication.mockRejectedValue(passwordRequired());
  renderWithProviders(<AdminApplicationDetailPage />, asAdmin('/admin/applications/5', '/admin/applications/:applicationId'));

  fireEvent.click(await screen.findByRole('button', { name: 'Approve Clinic' }));
  fireEvent.click(within(await dialog()).getByRole('button', { name: 'Confirm' }));
  await screen.findByLabelText(/^Password/);
  fireEvent.click(within(screen.getAllByRole('dialog').pop()).getByRole('button', { name: 'Cancel' }));
  expect(await screen.findByText(/your password was not confirmed/)).toBeInTheDocument();
});

test('an approved registration shows the result and links to its clinic', async () => {
  api.getApplication.mockResolvedValue({ ...APPLICATION, status: 'approved', clinic_id: 4, reviewed_at: '2026-08-06T10:00:00+08:00' });
  renderWithProviders(<AdminApplicationDetailPage />, asAdmin('/admin/applications/5', '/admin/applications/:applicationId'));

  expect(await screen.findByText(/Clinic verified on Aug 6, 2026/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View Clinic' })).toHaveAttribute('href', '/admin/clinics/4');
  expect(screen.queryByRole('button', { name: 'Approve Clinic' })).not.toBeInTheDocument();
});

test('subscriptions table shows plan, amount and statuses; only a submitted proof can be approved', async () => {
  api.getAdminSubscriptions.mockResolvedValue(
    page([
      { clinic_id: 1, clinic_name: 'Braganza Dental Clinic', plan: 'Professional', amount: 4999, due_at: '2027-01-15T00:00:00+08:00', status: 'active', payment_status: 'verified', payment_id: 2 },
      { clinic_id: 2, clinic_name: 'Valencia Smile Center', plan: 'Starter', amount: 1999, due_at: '2025-03-15T00:00:00+08:00', status: 'pending_payment', payment_status: 'pending', payment_id: 3 },
    ])
  );
  api.verifySubscriptionPayment.mockResolvedValue({});
  renderWithProviders(<AdminSubscriptionsPage />, asAdmin('/admin/subscriptions'));

  expect(await screen.findByText('2 clinic subscriptions')).toBeInTheDocument();
  expect(screen.getByText('₱4,999/mo')).toBeInTheDocument();
  expect(screen.getByText('Pending-Payment')).toBeInTheDocument();
  expect(screen.getByText('Submitted')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Approve payment from Braganza Dental Clinic' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Approve payment from Valencia Smile Center' }));
  fireEvent.click(within(await dialog()).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.verifySubscriptionPayment).toHaveBeenCalledWith(3));
});

test('payment review: proof downloads, reject needs a reason, and the plan can change', async () => {
  api.getAdminSubscription.mockResolvedValue(SUBSCRIPTION);
  api.downloadPaymentProof.mockResolvedValue();
  api.rejectSubscriptionPayment.mockResolvedValue({});
  api.changeSubscriptionPlan.mockResolvedValue({});
  renderWithProviders(<AdminSubscriptionDetailPage />, asAdmin('/admin/subscriptions/2', '/admin/subscriptions/:clinicId'));

  expect(await screen.findByRole('heading', { name: 'Valencia Smile Center' })).toBeInTheDocument();
  expect(screen.getByText('Plan: Starter · Amount: ₱1,999/mo · Due: Mar 15, 2025')).toBeInTheDocument();
  expect(screen.getByText('Proof of Payment Submitted')).toBeInTheDocument();
  expect(screen.getByText('GCash · Ref. REF1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Download' }));
  await waitFor(() => expect(api.downloadPaymentProof).toHaveBeenCalledWith(3, 'payment-proof-2-3'));

  fireEvent.click(screen.getByRole('button', { name: 'Reject Payment' }));
  const box = await dialog();
  fireEvent.change(within(box).getByLabelText(/^Reason/), { target: { value: 'Amount does not match' } });
  fireEvent.click(within(box).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.rejectSubscriptionPayment).toHaveBeenCalledWith(3, 'Amount does not match'));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.change(screen.getByLabelText(/^Plan/), { target: { value: 'enterprise' } });
  fireEvent.click(screen.getByRole('button', { name: 'Change Plan' }));
  await waitFor(() => expect(api.changeSubscriptionPlan).toHaveBeenCalledWith(2, 'enterprise'));
});

test('a verified payment says so and shows the workflow finished', async () => {
  api.getAdminSubscription.mockResolvedValue({ ...SUBSCRIPTION, status: 'active', payment_status: 'verified', payment: { ...SUBSCRIPTION.payment, status: 'verified' } });
  renderWithProviders(<AdminSubscriptionDetailPage />, asAdmin('/admin/subscriptions/2', '/admin/subscriptions/:clinicId'));

  expect(await screen.findByText(/Payment verified\. Subscription active\./)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Approve Payment' })).not.toBeInTheDocument();
  expect(screen.getByText('Subscription activated / renewed').closest('li')).toHaveClass('is-done');
});

test('reports: charts on the overview, a table per tab, month filter and export', async () => {
  api.getReports.mockResolvedValue(REPORTS);
  api.exportReportCsv.mockResolvedValue();
  renderWithProviders(<AdminReportsPage />, asAdmin('/admin/reports'));

  expect(await screen.findByText('Clinic Growth')).toBeInTheDocument();
  expect(screen.getByText('Starter: 2', { selector: 'li' })).toBeInTheDocument();
  expect(screen.getByText('Enterprise: 1', { selector: 'li' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Users' }));
  expect(await screen.findByText('Users Report')).toBeInTheDocument();
  expect(screen.getByText('New Dentists')).toBeInTheDocument();
  expect(screen.getByText('-1')).toHaveClass('is-down');
  expect(screen.getByRole('columnheader', { name: 'This Month' })).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Filter by month'), { target: { value: '2026-11' } });
  await waitFor(() => expect(api.getReports).toHaveBeenLastCalledWith({ month: '2026-11' }));
  expect(await screen.findByRole('columnheader', { name: 'November 2026' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Export Report' }));
  await waitFor(() => expect(api.exportReportCsv).toHaveBeenCalledWith({ month: '2026-11', section: 'users' }));
});

test('announcements: published ones archive, drafts edit and publish', async () => {
  api.getAnnouncements.mockResolvedValue(
    page([
      { id: 1, title: 'Platform Maintenance Window', content: 'Tonight', audience: 'all', status: 'published', published_at: '2026-07-15T10:00:00+08:00' },
      { id: 2, title: 'Subscription Renewal Notice', content: 'Reminder', audience: 'clinic_admins', status: 'draft', created_at: '2026-07-10T10:00:00+08:00' },
    ])
  );
  api.archiveAnnouncement.mockResolvedValue({});
  api.publishAnnouncement.mockResolvedValue({});
  renderWithProviders(<AdminAnnouncementsPage />, asAdmin('/admin/announcements'));

  expect(await screen.findByText('Target: All Users · July 15, 2026')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Create Announcement' })).toHaveAttribute('href', '/admin/announcements/new');
  expect(screen.getByRole('link', { name: 'Edit Subscription Renewal Notice' })).toHaveAttribute('href', '/admin/announcements/2/edit');

  fireEvent.click(screen.getByRole('button', { name: 'Archive Platform Maintenance Window' }));
  fireEvent.click(within(await dialog()).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.archiveAnnouncement).toHaveBeenCalledWith(1));

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Publish Subscription Renewal Notice' }));
  fireEvent.click(within(await dialog()).getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.publishAnnouncement).toHaveBeenCalledWith(2));
});

test('creating an announcement saves a draft or publishes it, and needs a title and content', async () => {
  api.createAnnouncement.mockResolvedValue({});
  renderWithProviders(<AdminAnnouncementFormPage />, asAdmin('/admin/announcements/new'));

  const publish = await screen.findByRole('button', { name: 'Publish Now' });
  expect(publish).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/^Title/), { target: { value: 'Dental Chart v2' } });
  fireEvent.change(screen.getByLabelText(/^Target Audience/), { target: { value: 'dentists' } });
  fireEvent.change(screen.getByLabelText(/^Content/), { target: { value: 'Now per tooth.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save as Draft' }));

  await waitFor(() =>
    expect(api.createAnnouncement).toHaveBeenCalledWith({ title: 'Dental Chart v2', audience: 'dentists', content: 'Now per tooth.', publish: false })
  );
});

test('audit logs: table, search, module filter, details, export and integrity check', async () => {
  const log = {
    id: 9,
    label: 'Approved clinic registration',
    module: 'Clinic verification',
    outcome: 'success',
    user_id: 1,
    user_name: 'Admin Rhea',
    user_role: 'system_admin',
    subject_label: 'Braganza Dental',
    ip_address: '10.0.0.1',
    sealed: true,
    created_at: '2026-07-15T09:14:00+08:00',
  };
  api.getAuditLogs.mockResolvedValue(page([log, { ...log, id: 10, outcome: 'pending', label: 'Submitted proof of payment' }]));
  api.exportAuditCsv.mockRejectedValueOnce(passwordRequired()).mockResolvedValueOnce();
  api.confirmAdminPassword.mockResolvedValue({});
  api.checkAuditIntegrity.mockResolvedValue({ status: 'failed', checked: 5, pending: 1, checked_at: '2026-07-15T10:00:00+08:00', problems: [{ id: 3, type: 'hash', message: 'Changed after it was sealed.' }] });
  renderWithProviders(<AdminAuditLogPage />, asAdmin('/admin/audit-logs'));

  expect(await screen.findByText('2 log entries')).toBeInTheDocument();
  expect(screen.getByText('pending')).toHaveClass('is-warning');

  fireEvent.click(screen.getByRole('button', { name: 'View log entry 9' }));
  const box = await dialog();
  expect(within(box).getByText('Log Details')).toBeInTheDocument();
  expect(within(box).getByText('Braganza Dental')).toBeInTheDocument();
  expect(within(box).getByText('Success')).toBeInTheDocument();
  fireEvent.click(within(box).getByRole('button', { name: 'Close' }));

  fireEvent.change(screen.getByLabelText('Search logs'), { target: { value: 'Rhea' } });
  await waitFor(() => expect(api.getAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Rhea' })));
  fireEvent.change(screen.getByLabelText('Filter by module'), { target: { value: 'verification' } });
  await waitFor(() => expect(api.getAuditLogs).toHaveBeenLastCalledWith(expect.objectContaining({ category: 'verification' })));

  fireEvent.click(screen.getByRole('button', { name: 'Export' }));
  fireEvent.change(await screen.findByLabelText(/^Password/), { target: { value: 'secret' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  await waitFor(() => expect(api.exportAuditCsv).toHaveBeenCalledTimes(2));

  fireEvent.click(screen.getByRole('button', { name: 'Run Integrity Check' }));
  expect(await screen.findByText(/altered outside the application/)).toBeInTheDocument();
  expect(screen.getByText(/Changed after it was sealed/)).toBeInTheDocument();
});

test('settings: every tab edits its values and Save sends them, with the password check', async () => {
  api.getPlatformSettings.mockResolvedValue(SETTINGS);
  api.updatePlatformSettings.mockRejectedValueOnce(passwordRequired()).mockResolvedValueOnce({ ...SETTINGS, platform_name: 'Kagay Dental' });
  api.confirmAdminPassword.mockResolvedValue({});
  renderWithProviders(<AdminSettingsPage />, asAdmin('/admin/settings'));

  fireEvent.change(await screen.findByLabelText(/^Platform Name/), { target: { value: 'Kagay Dental' } });
  fireEvent.click(screen.getByRole('switch', { name: /Maintenance Mode/ }));

  fireEvent.click(screen.getByRole('button', { name: 'Security' }));
  fireEvent.change(await screen.findByLabelText(/^Session Timeout/), { target: { value: '45' } });
  expect(screen.getByText(/at least one letter and one number/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Verification' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'BIR Registration' }));

  fireEvent.click(screen.getByRole('button', { name: 'Subscription' }));
  fireEvent.change(screen.getByLabelText(/^Payment Grace Period/), { target: { value: '10' } });
  expect(screen.getByText('₱1,999/mo')).toBeInTheDocument();
  expect(screen.getByText('1 dentist, 1 branch')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
  fireEvent.change(await screen.findByLabelText(/^Password/), { target: { value: 'secret' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

  await waitFor(() => expect(api.updatePlatformSettings).toHaveBeenCalledTimes(2));
  expect(api.updatePlatformSettings).toHaveBeenLastCalledWith({
    platform_name: 'Kagay Dental',
    support_email: 'help@example.com',
    maintenance_mode: true,
    allow_self_registration: true,
    session_timeout_minutes: 45,
    require_verification: true,
    required_documents: ['business_permit', 'doh_license', 'prc_id'],
    payment_grace_days: 10,
  });
  expect(await screen.findByText('Settings saved.')).toBeInTheDocument();
});

test('settings keeps the live health checks', async () => {
  api.getPlatformSettings.mockResolvedValue(SETTINGS);
  api.getSystemHealth.mockResolvedValue({
    status: 'degraded',
    environment: 'local',
    checked_at: '2026-10-30T09:00:00+08:00',
    checks: [{ key: 'queue', label: 'Background jobs (emails, reminders)', status: 'warn', detail: '0 waiting, 2 failed' }],
  });
  renderWithProviders(<AdminSettingsPage />, asAdmin('/admin/settings'));

  await screen.findByLabelText(/^Platform Name/);
  fireEvent.click(screen.getByRole('button', { name: 'Health' }));
  expect(await screen.findByText('0 waiting, 2 failed')).toBeInTheDocument();
  expect(screen.getByText('Attention')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save Settings' })).not.toBeInTheDocument();
});

test('my profile: details, password rules and notification switches that save at once', async () => {
  getNotificationPreferences.mockResolvedValue({ categories: { admin_payment_submissions: false } });
  updateNotificationPreferences.mockResolvedValue({});
  changePassword.mockResolvedValue('ok');
  renderWithProviders(<AdminProfilePage />, asAdmin('/admin/profile'));

  expect(await screen.findByText('+63 912 000 0001')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Security' }));
  fireEvent.change(await screen.findByLabelText(/^Current Password/), { target: { value: 'old-pass-1' } });
  fireEvent.change(screen.getByLabelText(/^New Password/), { target: { value: 'Newpass123' } });
  fireEvent.change(screen.getByLabelText(/^Confirm New Password/), { target: { value: 'Different1' } });
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
  expect(await screen.findByText('New passwords do not match.')).toBeInTheDocument();
  expect(changePassword).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText(/^Confirm New Password/), { target: { value: 'Newpass123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
  await waitFor(() => expect(changePassword).toHaveBeenCalledWith({ currentPassword: 'old-pass-1', newPassword: 'Newpass123' }));

  fireEvent.click(within(screen.getByRole('group', { name: 'Profile sections' })).getByRole('button', { name: 'Notifications' }));
  const payments = await screen.findByRole('switch', { name: /Payment Submissions/ });
  expect(payments).not.toBeChecked();
  expect(screen.getByRole('switch', { name: /Verification Requests/ })).toBeChecked();
  fireEvent.click(payments);
  await waitFor(() => expect(updateNotificationPreferences).toHaveBeenCalledWith({ categories: { admin_payment_submissions: true } }));
});
