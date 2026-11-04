import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import ClinicAddDentistPage from './ClinicAddDentistPage';
import ClinicAddStaffPage from './ClinicAddStaffPage';
import ClinicAdminSettingsPage from './ClinicAdminSettingsPage';
import ClinicAppointmentDetailPage from './ClinicAppointmentDetailPage';
import ClinicDentistProfilePage from './ClinicDentistProfilePage';
import ClinicNotificationsPage from './ClinicNotificationsPage';
import ClinicPatientDetailPage from './ClinicPatientDetailPage';
import ClinicPaymentProofPage from './ClinicPaymentProofPage';
import ClinicReviewsPage from './ClinicReviewsPage';
import ClinicServicesPage from './ClinicServicesPage';
import ClinicSubscriptionPage from './ClinicSubscriptionPage';
import ClinicWalkInPage from './ClinicWalkInPage';
import * as api from '../../services/clinicPortalApi';
import * as auth from '../../services/authService';
import { getAvailability, getSpecializations } from '../../services/publicApi';
import { getNotificationPreferences, getNotifications, updateNotificationPreferences } from '../../services/notificationApi';
import { clinicUser, renderWithProviders } from '../../testUtils';
import { appointment, emptyNotifications } from '../../testFixtures';

jest.mock('../../services/clinicPortalApi');
jest.mock('../../services/notificationApi');
jest.mock('../../services/publicApi');
jest.mock('../../services/authService');

const ADMIN = [
  'clinic.view',
  'clinic.profile.manage',
  'clinic.services.manage',
  'clinic.dentists.manage',
  'clinic.schedules.manage',
  'clinic.staff.manage',
  'clinic.settings.manage',
  'clinic.permissions.manage',
  'clinic.audit.view',
  'appointments.view_all',
  'appointments.manage',
  'patients.view',
  'patients.manage',
  'records.view',
  'records.write',
  'feedback.view',
  'feedback.respond',
  'subscription.manage',
];

const renderPage = (element, route, path, permissions = ADMIN, role = 'clinic_admin') =>
  renderWithProviders(element, { user: clinicUser(permissions, role), route, path });

beforeEach(() => {
  getNotifications.mockResolvedValue(emptyNotifications);
});

test('add staff: only changed permissions are sent; records are never offered', async () => {
  api.inviteMember.mockResolvedValue({});
  renderPage(<ClinicAddStaffPage />, '/clinic/7/staff/new', '/clinic/:clinicId/staff/new');

  expect(screen.queryByLabelText(/records/i)).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Rosa' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Lim' } });
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'rosa@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }));
  await waitFor(() => expect(api.inviteMember).toHaveBeenCalledTimes(1));
  expect(api.inviteMember.mock.calls[0][1]).toEqual({ role: 'staff', name: 'Rosa Lim', email: 'rosa@example.com', position: 'receptionist' });
});

test('add staff: a changed tick sends this person their own permission list', async () => {
  api.inviteMember.mockResolvedValue({});
  renderPage(<ClinicAddStaffPage />, '/clinic/7/staff/new', '/clinic/:clinicId/staff/new');

  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Rosa' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Lim' } });
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'rosa@example.com' } });
  fireEvent.click(screen.getByLabelText('View Reports'));
  fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }));
  await waitFor(() => expect(api.inviteMember).toHaveBeenCalledTimes(1));
  expect(api.inviteMember.mock.calls[0][1].permissions).toContain('reports.view');
});

test('add dentist sends the working week', async () => {
  getSpecializations.mockResolvedValue([{ id: 3, name: 'Orthodontist' }]);
  api.inviteMember.mockResolvedValue({});
  renderPage(<ClinicAddDentistPage />, '/clinic/7/dentists/new', '/clinic/:clinicId/dentists/new');

  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Ben' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Cruz' } });
  fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'ben@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: 'Fri' }));
  fireEvent.click(screen.getByRole('button', { name: 'Send Invitation' }));
  await waitFor(() => expect(api.inviteMember).toHaveBeenCalledTimes(1));
  expect(api.inviteMember.mock.calls[0][1]).toMatchObject({ role: 'dentist', name: 'Ben Cruz', working_days: [1, 2, 3, 4], starts_at: '08:00', ends_at: '17:00' });
});

test('dentist profile shows the week, appointments and asks before deactivating', async () => {
  api.getBranches.mockResolvedValue([]);
  api.updateDentist.mockResolvedValue({});
  api.getClinicDentist.mockResolvedValue({
    id: 2,
    name: 'Dr. Ben Cruz',
    is_active: true,
    years_experience: 7,
    appointments_today: 2,
    appointments_total: 40,
    schedules: [{ day_of_week: 1, branch_id: 1, starts_at: '08:00', ends_at: '17:00' }],
    appointments: [{ id: 9, patient: 'Maria Santos', service: 'Dental Cleaning', starts_at: '2026-11-02T10:00:00+08:00', status: 'confirmed' }],
  });
  renderPage(<ClinicDentistProfilePage />, '/clinic/7/dentists/2', '/clinic/:clinicId/dentists/:dentistId');

  expect(await screen.findByText('Maria Santos')).toBeInTheDocument();
  expect(screen.getByText('40 total')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
  expect(api.updateDentist).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Deactivate Dr. Ben Cruz?' })).getByRole('button', { name: 'Deactivate' }));
  await waitFor(() => expect(api.updateDentist).toHaveBeenCalledWith('7', '2', { is_active: false }));
});

test('walk-in registers a new patient, then books the chosen slot', async () => {
  api.getClinicServices.mockResolvedValue([{ id: 4, name: 'Dental Cleaning', is_available: true }]);
  api.getClinicDentists.mockResolvedValue([{ id: 2, name: 'Dr. Ben Cruz', is_active: true }]);
  api.registerPatient.mockResolvedValue({ data: { id: 77 } });
  api.bookForPatient.mockResolvedValue({ data: { id: 90 } });
  getAvailability.mockResolvedValue([{ startsAt: '2030-11-02 15:00', label: '3:00 PM', branchId: 1 }]);
  renderPage(<ClinicWalkInPage />, '/clinic/7/appointments/walk-in', '/clinic/:clinicId/appointments/walk-in');

  const submit = screen.getByRole('button', { name: 'Register Walk-in' });
  expect(submit).toBeDisabled();
  fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Jose' } });
  fireEvent.change(screen.getByLabelText('Last name'), { target: { value: 'Reyes' } });
  fireEvent.change(screen.getByLabelText('Phone number'), { target: { value: '0917' } });
  await screen.findByRole('option', { name: 'Dental Cleaning' });
  await screen.findByRole('option', { name: 'Dr. Ben Cruz' });
  fireEvent.change(screen.getByLabelText('Service'), { target: { value: '4' } });
  fireEvent.change(screen.getByLabelText('Assign dentist'), { target: { value: '2' } });
  await screen.findByRole('option', { name: '3:00 PM' });
  fireEvent.change(screen.getByLabelText('Time slot'), { target: { value: '2030-11-02 15:00' } });
  fireEvent.click(submit);

  await waitFor(() =>
    expect(api.bookForPatient).toHaveBeenCalledWith('7', { patient_id: 77, service_rate_id: 4, dentist_id: 2, branch_id: 1, starts_at: '2030-11-02 15:00', walk_in: true })
  );
  expect(api.registerPatient).toHaveBeenCalledWith('7', { full_name: 'Jose Reyes', phone: '0917' });
});

test('appointment details: reassign only offers other active dentists; flags are shown', async () => {
  api.getClinicAppointment.mockResolvedValue(appointment({ status: 'confirmed', dentist: { id: 2, name: 'Dr. Ben Cruz' }, medical_flags: ['Hypertensive, requires BP check'] }));
  api.getClinicDentists.mockResolvedValue([
    { id: 2, name: 'Dr. Ben Cruz', is_active: true },
    { id: 3, name: 'Dr. Ana Lim', is_active: true },
    { id: 4, name: 'Dr. Off Duty', is_active: false },
  ]);
  api.reassignAppointment.mockResolvedValue({});
  renderPage(<ClinicAppointmentDetailPage />, '/clinic/7/appointments/12', '/clinic/:clinicId/appointments/:appointmentId');

  expect(await screen.findByText('Hypertensive, requires BP check')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reassign Dentist' }));
  const dialog = screen.getByRole('dialog', { name: 'Reassign Dentist' });
  await within(dialog).findByRole('option', { name: 'Dr. Ana Lim' });
  expect(within(dialog).queryByRole('option', { name: 'Dr. Off Duty' })).not.toBeInTheDocument();
  expect(within(dialog).queryByRole('option', { name: 'Dr. Ben Cruz' })).not.toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText('Select dentist'), { target: { value: '3' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Reassign' }));
  await waitFor(() => expect(api.reassignAppointment).toHaveBeenCalledWith('7', '12', 3));
});

test('patient files upload and download through the API', async () => {
  const report = { id: 5, name: 'X-Ray.pdf', size: 2048, uploaded_at: '2026-07-10T10:00:00+08:00' };
  api.getClinicPatient.mockResolvedValue({ id: 3, name: 'Juan Dela Cruz', has_portal_account: true, visits: 1, medical_summary: { blood_type: 'O+', conditions: 'Asthma', allergies: null } });
  api.getPatientFiles.mockResolvedValue([report]);
  api.uploadPatientFile.mockResolvedValue({});
  api.downloadPatientFile.mockResolvedValue();
  renderPage(<ClinicPatientDetailPage />, '/clinic/7/patients/3', '/clinic/:clinicId/patients/:patientId');

  expect(await screen.findByText('Asthma')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Files' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Download X-Ray.pdf' }));
  await waitFor(() => expect(api.downloadPatientFile).toHaveBeenCalledWith('7', '3', report));

  const file = new File(['x'], 'plan.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByLabelText('Choose a file to upload'), { target: { files: [file] } });
  await waitFor(() => expect(api.uploadPatientFile).toHaveBeenCalledWith('7', '3', file));
});

test('reviews: summary, reply and report with a chosen reason', async () => {
  api.getClinicReviews.mockResolvedValue({
    items: [{ id: 1, rating: 5, comment: 'Great', patient_name: 'Maria Santos', service: 'Cleaning', dentist: 'Dr. Ben', status: 'approved', date: '2026-07-10' }],
    meta: { last_page: 1, summary: { count: 1, average: 5, breakdown: { 5: 1 } } },
  });
  api.replyToReview.mockResolvedValue({});
  api.reportReview.mockResolvedValue({});
  renderPage(<ClinicReviewsPage />, '/clinic/7/reviews', '/clinic/:clinicId/reviews');

  expect(await screen.findByText('Overall Rating')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reply to this review' }));
  fireEvent.change(screen.getByLabelText('Your reply to Maria Santos'), { target: { value: 'Thank you!' } });
  fireEvent.click(screen.getByRole('button', { name: 'Post Reply' }));
  await waitFor(() => expect(api.replyToReview).toHaveBeenCalledWith('7', '1', 'Thank you!'));

  fireEvent.click(screen.getByRole('button', { name: 'Report' }));
  const dialog = screen.getByRole('dialog', { name: 'Report Review' });
  expect(within(dialog).getByRole('button', { name: 'Submit Report' })).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Spam or fake review' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Submit Report' }));
  await waitFor(() => expect(api.reportReview).toHaveBeenCalledWith('7', '1', 'Spam or fake review'));
});

test('notifications filter by group and preferences save per category', async () => {
  getNotifications.mockResolvedValue({
    notifications: [
      { id: 'a', kind: 'appointment', title: 'New request', message: 'm', time: 'now', unread: true },
      { id: 'b', kind: 'inventory', title: 'Low stock', message: 'm', time: 'now', unread: false },
    ],
    unreadCount: 1,
    pageCount: 1,
  });
  getNotificationPreferences.mockResolvedValue({ categories: { new_reviews: false } });
  updateNotificationPreferences.mockResolvedValue({});
  renderPage(<ClinicNotificationsPage />, '/clinic/7/notifications', '/clinic/:clinicId/notifications');

  expect(await screen.findByText('New request')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Inventory' }));
  expect(screen.queryByText('New request')).not.toBeInTheDocument();
  expect(screen.getByText('Low stock')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
  const toggle = await screen.findByRole('switch', { name: 'New patient reviews' });
  expect(toggle).not.toBeChecked();
  fireEvent.click(toggle);
  fireEvent.click(screen.getByRole('button', { name: 'Save Preferences' }));
  await waitFor(() => expect(updateNotificationPreferences).toHaveBeenCalledWith({ categories: { new_reviews: true } }));
});

const SUBSCRIPTION = {
  plan: { name: 'Pro Plan', price: 1500, billing: 'Monthly subscription', features: ['Unlimited Appointments'] },
  status: 'active',
  renews_at: '2026-08-15T00:00:00+08:00',
  days_remaining: 31,
  has_pending_payment: false,
  channels: [{ key: 'gcash', label: 'GCash', number_label: 'GCash Number', number: '0900', account_name: 'Sample' }],
  payments: [{ id: 4, date: '2026-07-15T10:00:00+08:00', description: 'Pro Plan – Monthly Renewal', amount: 1500, invoice_number: 'INV-1', status: 'verified' }],
};

test('subscription shows the plan, downloads an invoice and asks before requesting renewal', async () => {
  api.getSubscription.mockResolvedValue(SUBSCRIPTION);
  api.downloadInvoice.mockResolvedValue();
  api.requestRenewal.mockResolvedValue({});
  renderPage(<ClinicSubscriptionPage />, '/clinic/7/subscription', '/clinic/:clinicId/subscription');

  expect(await screen.findByText('31 days')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Download invoice INV-1' }));
  await waitFor(() => expect(api.downloadInvoice).toHaveBeenCalledWith('7', SUBSCRIPTION.payments[0]));

  fireEvent.click(screen.getByRole('button', { name: 'Request Renewal' }));
  expect(api.requestRenewal).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Request renewal?' })).getByRole('button', { name: 'Request Renewal' }));
  await waitFor(() => expect(api.requestRenewal).toHaveBeenCalledWith('7'));
});

test('payment proof refuses wrong files and shows what happens next', async () => {
  api.getSubscription.mockResolvedValue(SUBSCRIPTION);
  api.submitPaymentProof.mockResolvedValue({});
  const { container } = renderPage(<ClinicPaymentProofPage />, '/clinic/7/subscription/payment', '/clinic/:clinicId/subscription/payment');

  const submit = await screen.findByRole('button', { name: 'Submit Proof' });
  expect(submit).toBeDisabled();
  const input = container.querySelector('input[type="file"]');
  fireEvent.change(input, { target: { files: [new File(['x'], 'a.txt', { type: 'text/plain' })] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('JPG, PNG or PDF');
  expect(submit).toBeDisabled();

  const proof = new File(['x'], 'receipt.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [proof] } });
  fireEvent.change(screen.getByLabelText(/Reference number/), { target: { value: 'REF1' } });
  fireEvent.click(submit);
  await waitFor(() => expect(api.submitPaymentProof).toHaveBeenCalledWith('7', { method: 'gcash', reference: 'REF1', proof }));
  expect(await screen.findByText('What happens next?')).toBeInTheDocument();
});

test('settings: booking choices and the role matrix save', async () => {
  api.getClinicSettings.mockResolvedValue({ timezone: 'Asia/Manila', slot_options: [15, 30], slot_minutes: 30, allow_online_booking: true, require_approval: true, send_reminders: true, allow_patient_cancel: true });
  api.updateClinicSettings.mockResolvedValue({});
  api.getRolePermissions.mockResolvedValue({ modules: [{ key: 'reports', label: 'Reports' }], positions: [{ key: 'receptionist', label: 'Receptionist', modules: [] }] });
  api.updateRolePermissions.mockResolvedValue({});
  renderPage(<ClinicAdminSettingsPage />, '/clinic/7/clinic-settings', '/clinic/:clinicId/clinic-settings');

  fireEvent.click(await screen.findByRole('switch', { name: 'Allow patients to cancel online' }));
  fireEvent.change(screen.getByLabelText('Appointment slot duration'), { target: { value: '15' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Settings' }));
  await waitFor(() =>
    expect(api.updateClinicSettings).toHaveBeenCalledWith('7', { slot_minutes: 15, allow_online_booking: true, require_approval: true, send_reminders: true, allow_patient_cancel: false })
  );

  fireEvent.click(screen.getByRole('button', { name: 'Permissions' }));
  fireEvent.click(await screen.findByRole('checkbox', { name: 'Receptionist: Reports' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save Permissions' }));
  await waitFor(() => expect(api.updateRolePermissions).toHaveBeenCalledWith('7', { receptionist: ['reports'] }));
});

test('settings: two-factor setup needs the password and a code, then shows recovery codes', async () => {
  auth.startTwoFactorSetup.mockResolvedValue({ secret: 'ABC123', otpauth_url: 'otpauth://totp/x' });
  auth.confirmTwoFactor.mockResolvedValue({ recovery_codes: ['code-one', 'code-two'] });
  auth.fetchCurrentUser.mockResolvedValue(null);
  renderPage(<ClinicAdminSettingsPage />, '/clinic/7/clinic-settings', '/clinic/:clinicId/clinic-settings', ['clinic.view', 'clinic.audit.view']);

  fireEvent.click(screen.getByRole('button', { name: 'Security' }));
  fireEvent.click(screen.getByRole('switch', { name: /Two-Factor Authentication/ }));
  const dialog = screen.getByRole('dialog', { name: 'Set Up Two-Factor Authentication' });
  fireEvent.change(within(dialog).getByLabelText('Confirm your password'), { target: { value: 'secret' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Continue' }));
  expect(await within(dialog).findByText('ABC123')).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText('6-digit code'), { target: { value: '123456' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Enable 2FA' }));
  expect(await within(dialog).findByText('code-one')).toBeInTheDocument();
  expect(auth.startTwoFactorSetup).toHaveBeenCalledWith('secret');
  expect(auth.confirmTwoFactor).toHaveBeenCalledWith('123456');
});

test('services: remove asks first and archives', async () => {
  api.getClinicServices.mockResolvedValue([{ id: 4, name: 'Dental Cleaning', category: 'Preventive', price: '500', price_max: '1500', duration_minutes: 45, duration_max: 60, is_available: true }]);
  api.archiveClinicService.mockResolvedValue({});
  renderPage(<ClinicServicesPage />, '/clinic/7/services', '/clinic/:clinicId/services');

  expect(await screen.findByText('45–60 min')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Dental Cleaning' }));
  expect(api.archiveClinicService).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Remove Dental Cleaning?' })).getByRole('button', { name: 'Remove' }));
  await waitFor(() => expect(api.archiveClinicService).toHaveBeenCalledWith('7', 4));
});
