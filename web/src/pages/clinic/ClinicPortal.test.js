import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import ClinicDashboardPage from './ClinicDashboardPage';
import ClinicAppointmentDetailPage from './ClinicAppointmentDetailPage';
import ClinicPatientDetailPage from './ClinicPatientDetailPage';
import ClinicInventoryItemPage from './ClinicInventoryItemPage';
import ClinicStaffPage from './ClinicStaffPage';
import ClinicLayout from '../../layouts/ClinicLayout';
import * as api from '../../services/clinicPortalApi';
import { requestPasswordReset } from '../../services/authService';
import { getNotifications } from '../../services/notificationApi';
import { clinicUser, renderWithProviders } from '../../testUtils';
import { apiAppointment, appointment, emptyNotifications } from '../../testFixtures';

jest.mock('../../services/clinicPortalApi');
jest.mock('../../services/notificationApi');
jest.mock('../../services/publicApi');
jest.mock('../../services/authService');
// The slot calendar has its own tests; this stand-in confirms one chosen slot.
const mockSlotPicker = { confirm: null };
jest.mock('../../components/portal/SlotPickerModal', () => ({
  __esModule: true,
  default: ({ onConfirm }) => (
    <button type="button" onClick={() => onConfirm(mockSlotPicker.confirm)}>
      Pick slot
    </button>
  ),
}));

const ADMIN = ['clinic.view', 'clinic.profile.manage', 'clinic.branches.manage', 'clinic.services.manage', 'clinic.dentists.manage', 'clinic.schedules.manage', 'clinic.staff.manage', 'appointments.view_all', 'appointments.manage', 'patients.view', 'inventory.view', 'inventory.manage', 'feedback.view', 'reports.view'];
const STAFF = ['clinic.view', 'appointments.view_all', 'appointments.manage', 'patients.view', 'patients.manage'];
const DENTIST = ['clinic.view', 'appointments.view_assigned', 'appointments.progress', 'patients.view', 'records.view', 'records.write'];

beforeEach(() => {
  getNotifications.mockResolvedValue(emptyNotifications);
  api.getClinicDashboard.mockResolvedValue({ appointments: { today: [], pending_requests: 2, upcoming: 5, completed_this_month: 1, cancelled_this_month: 0 } });
});

const renderClinicPage = (element, permissions, role, { route = '/clinic/7/dashboard', path = '/clinic/:clinicId/dashboard' } = {}) =>
  renderWithProviders(element, { user: clinicUser(permissions, role), route, path });

test('navigation only shows sections the member is allowed to use', async () => {
  renderClinicPage(<ClinicDashboardPage />, STAFF, 'staff');
  const nav = screen.getByRole('navigation', { name: 'Clinic' });

  expect(within(nav).getByRole('link', { name: 'Appointments' })).toBeInTheDocument();
  expect(within(nav).getByRole('link', { name: 'Patients' })).toBeInTheDocument();
  expect(within(nav).queryByRole('link', { name: 'Inventory' })).not.toBeInTheDocument();
  expect(within(nav).queryByRole('link', { name: 'Staff' })).not.toBeInTheDocument();
  expect(screen.getByText(/Receptionist \/ Staff · Valencia Smiles/)).toBeInTheDocument();
  expect(await screen.findByText('Pending requests')).toBeInTheDocument();
});

test('a clinic the user is not a member of redirects away', () => {
  renderWithProviders(<ClinicDashboardPage />, {
    user: clinicUser(ADMIN),
    route: '/clinic/99/dashboard',
    path: '/clinic/:clinicId/dashboard',
  });
  expect(screen.getByText('Navigated away')).toBeInTheDocument();
});

test('a page the role lacks permission for redirects to the clinic dashboard', () => {
  renderClinicPage(<ClinicStaffPage />, DENTIST, 'dentist', { route: '/clinic/7/staff', path: '/clinic/:clinicId/staff' });
  expect(screen.getByText('Navigated away')).toBeInTheDocument();
});

const detailRoute = { route: '/clinic/7/appointments/12', path: '/clinic/:clinicId/appointments/:appointmentId' };

test('receptionist sees confirm/decline for a pending request; decline needs a reason', async () => {
  api.getClinicAppointment.mockResolvedValue(appointment({ patient: { id: 3, name: 'Juan Dela Cruz', email: 'juan@example.com', phone: '0917' } }));
  api.appointmentAction.mockResolvedValue({});
  renderClinicPage(<ClinicAppointmentDetailPage />, STAFF, 'staff', detailRoute);

  expect(await screen.findByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  expect(screen.getByText('Juan Dela Cruz')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /clinical records/ })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
  const dialog = screen.getByRole('dialog', { name: 'Decline' });
  const submit = within(dialog).getByRole('button', { name: 'Decline' });
  expect(submit).toBeDisabled();
  fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'Fully booked' } });
  fireEvent.click(submit);

  await waitFor(() => expect(api.appointmentAction).toHaveBeenCalledWith('7', '12', 'reject', { reason: 'Fully booked' }));
});

test('a dentist can only progress an appointment, not confirm it', async () => {
  api.getClinicAppointment.mockResolvedValue(appointment({ status: 'checked_in' }));
  renderClinicPage(<ClinicAppointmentDetailPage />, DENTIST, 'dentist', detailRoute);

  expect(await screen.findByRole('button', { name: 'Start visit' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Confirm' })).not.toBeInTheDocument();

  api.getClinicAppointment.mockResolvedValue(appointment({ status: 'pending' }));
});

test('dentist adds a clinical record and corrects it with a reason', async () => {
  api.getClinicPatient.mockResolvedValue({ id: 3, name: 'Juan Dela Cruz', has_portal_account: true, phone: '0917' });
  api.getClinicAppointments.mockResolvedValue({ appointments: [], meta: {} });
  api.getPatientMedicalHistory.mockResolvedValue({ current: null, history: [] });
  api.getPatientRecords.mockResolvedValue([
    { id: 40, record_type: 'treatment', findings: 'Mild gingivitis', created_at: '2026-10-01T10:00:00+08:00', dentist: 'Dr. Maria Santos', is_patient_visible: false },
  ]);
  api.createRecord.mockResolvedValue({});
  api.amendRecord.mockResolvedValue({});
  renderClinicPage(<ClinicPatientDetailPage />, DENTIST, 'dentist', { route: '/clinic/7/patients/3', path: '/clinic/:clinicId/patients/:patientId' });

  expect(await screen.findByText('Mild gingivitis')).toBeInTheDocument();
  expect(screen.getByText(/Viewing is logged/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Correct' }));
  const dialog = screen.getByRole('dialog', { name: 'Correct record' });
  fireEvent.change(within(dialog).getByLabelText('Findings'), { target: { value: 'Moderate gingivitis' } });
  fireEvent.change(within(dialog).getByLabelText('Reason for correction'), { target: { value: 'Severity recorded incorrectly' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save correction' }));
  // Records cannot be edited afterwards, so saving asks first.
  expect(api.amendRecord).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, save correction' }));

  await waitFor(() =>
    expect(api.amendRecord).toHaveBeenCalledWith('7', '3', 40, expect.objectContaining({ findings: 'Moderate gingivitis', amendment_reason: 'Severity recorded incorrectly' }))
  );
});

test('a receptionist sees patient details but no clinical sections', async () => {
  api.getClinicPatient.mockResolvedValue({ id: 3, name: 'Juan Dela Cruz', has_portal_account: false });
  api.getClinicAppointments.mockResolvedValue({ appointments: [], meta: {} });
  renderClinicPage(<ClinicPatientDetailPage />, STAFF, 'staff', { route: '/clinic/7/patients/3', path: '/clinic/:clinicId/patients/:patientId' });

  expect(await screen.findByRole('heading', { name: 'Juan Dela Cruz' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Clinical records' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Medical history' })).not.toBeInTheDocument();
  expect(api.getPatientRecords).not.toHaveBeenCalled();
});

test('recording a disposal requires a batch and a reason', async () => {
  api.getInventoryItem.mockResolvedValue({
    id: 4, name: 'Nitrile gloves', unit: 'box', minimum_stock: 10, quantity_usable: 3, quantity_expired: 2, is_active: true,
    batches: [{ id: 21, batch_number: 'LOT-A', quantity_on_hand: 2, expires_on: '2026-09-01', is_expired: true, is_near_expiry: false }],
    movements: [],
  });
  api.getSuppliers.mockResolvedValue([]);
  api.recordMovement.mockResolvedValue({});
  renderClinicPage(<ClinicInventoryItemPage />, ADMIN, 'clinic_admin', { route: '/clinic/7/inventory/4', path: '/clinic/:clinicId/inventory/:itemId' });

  expect(await screen.findByText('Expired')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Movement'), { target: { value: 'disposal' } });
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText('Batch'), { target: { value: '21' } });
  fireEvent.change(screen.getByLabelText('Reason (required)'), { target: { value: 'Expired' } });
  fireEvent.click(screen.getByRole('button', { name: 'Record movement' }));

  await waitFor(() => expect(api.recordMovement).toHaveBeenCalledWith('7', 4, { type: 'disposal', quantity: 2, reason: 'Expired', batch_id: 21 }));
});

test('clinic admin invites a staff member', async () => {
  api.getMembers.mockResolvedValue([{ id: 1, user_id: 2, name: 'Ana Reyes', email: 'ana@example.com', role: 'clinic_admin', status: 'active' }]);
  api.inviteMember.mockResolvedValue({ message: 'Account created. They will receive an email to set their password.' });
  api.getBranches.mockResolvedValue([]);
  renderClinicPage(<ClinicStaffPage />, ADMIN, 'clinic_admin', { route: '/clinic/7/staff', path: '/clinic/:clinicId/staff' });

  // Admins cannot change their own role or access here.
  // (The signed-in admin is also "Ana Reyes" in the sidebar, so wait for the table.)
  expect(await screen.findByText('You')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit Ana Reyes' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Add Staff' }));
  const dialog = screen.getByRole('dialog', { name: 'Add staff member' });
  fireEvent.change(within(dialog).getByLabelText('Full name'), { target: { value: 'Rosa Lim' } });
  fireEvent.change(within(dialog).getByLabelText('Email'), { target: { value: 'rosa@example.com' } });
  fireEvent.change(within(dialog).getByLabelText('Role'), { target: { value: 'dentist' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));

  expect(await screen.findByText(/receive an email to set their password/)).toBeInTheDocument();
  expect(api.inviteMember).toHaveBeenCalledWith('7', { name: 'Rosa Lim', email: 'rosa@example.com', role: 'dentist' });
});

// Keep the fixture import used for clarity in failure output.
void apiAppointment;

test('staff table leaves out dentists, filters by role, edits, deactivates and resets a password', async () => {
  api.getMembers.mockResolvedValue([
    { id: 1, user_id: 2, name: 'Ana Reyes', email: 'ana@example.com', role: 'clinic_admin', status: 'active', branches: null },
    { id: 4, user_id: 8, name: 'Sofia Lim', email: 'sofia@example.com', phone: '0912', role: 'staff', status: 'active', last_active_at: null, branches: null },
    { id: 5, user_id: 9, name: 'Dr. Ben Cruz', email: 'ben@example.com', role: 'dentist', status: 'active', branches: ['Main Branch'] },
  ]);
  api.updateMember.mockResolvedValue({});
  requestPasswordReset.mockResolvedValue({});
  renderClinicPage(<ClinicStaffPage />, ADMIN, 'clinic_admin', { route: '/clinic/7/staff', path: '/clinic/:clinicId/staff' });

  const row = (await screen.findByText('Sofia Lim')).closest('tr');
  expect(screen.getByText('2 staff members')).toBeInTheDocument();
  expect(within(screen.getByRole('table')).queryByText('Dr. Ben Cruz')).not.toBeInTheDocument();
  expect(within(row).getByText('0912')).toBeInTheDocument();
  expect(within(row).getByText('Never')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'clinic_admin' } });
  expect(within(screen.getByRole('table')).queryByText('Sofia Lim')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'all' } });

  fireEvent.click(screen.getByRole('button', { name: 'Edit Sofia Lim' }));
  const edit = screen.getByRole('dialog', { name: 'Edit Sofia Lim' });
  fireEvent.change(within(edit).getByLabelText(/Work phone/), { target: { value: '0999' } });
  fireEvent.click(within(edit).getByRole('button', { name: 'Save' }));
  await waitFor(() => expect(api.updateMember).toHaveBeenCalledWith('7', 4, { role: 'staff', phone: '0999' }));

  fireEvent.click(await screen.findByRole('button', { name: 'Deactivate Sofia Lim' }));
  expect(api.updateMember).toHaveBeenCalledTimes(1); // asks first
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Deactivate Sofia Lim?' })).getByRole('button', { name: 'Deactivate' }));
  await waitFor(() => expect(api.updateMember).toHaveBeenLastCalledWith('7', 4, { status: 'suspended' }));

  fireEvent.click(await screen.findByRole('button', { name: 'Send Sofia Lim a password reset link' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Reset password for Sofia Lim?' })).getByRole('button', { name: 'Send reset link' }));
  await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledWith('sofia@example.com'));
});

const INSIGHTS = {
  today: { date: '2026-11-02', appointments: 12, yesterday: 10, pending_requests: 5 },
  patients: { total: 847, new_this_month: 12 },
  dentists: { total: 4, active: 3, inactive: 1 },
  staff: { total: 6, active: 5, inactive: 1 },
  appointments_by_day: ['10-27', '10-28', '10-29', '10-30', '10-31', '11-01', '11-02'].map((d) => ({ date: `2026-${d}`, confirmed: 3, pending: 1, cancelled: 1 })),
  revenue: { year: 2026, currency: 'PHP', this_month: 58420, last_month: 52160, by_month: [{ month: '2026-10', total: 52160 }, { month: '2026-11', total: 58420 }] },
  activity: [{ id: 9, action: 'appointment.status_changed', kind: 'appointment', title: 'Appointment confirmed', subject: 'Maria Santos – Braces Consultation', actor: 'Ana Reyes', created_at: '2026-11-02T09:00:00+08:00' }],
};

const mockAdminDashboard = () => {
  api.getClinicInsights.mockResolvedValue(INSIGHTS);
  api.getClinicAppointments.mockResolvedValue({ appointments: [], meta: {} });
  api.getAppointmentCalendar.mockResolvedValue({ month: '2026-11', days: [] });
};

test('clinic admin dashboard: greeting, figures, approvals, calendar and quick actions', async () => {
  api.getClinicInsights.mockResolvedValue(INSIGHTS);
  api.getClinicDashboard.mockResolvedValue({ alerts: [] });
  api.getAppointmentCalendar.mockResolvedValue({ month: '2026-11', days: [{ date: '2026-11-18', total: 2 }] });
  api.getClinicAppointments.mockResolvedValue({
    appointments: [appointment({ id: 31, status: 'pending', service: { name: 'Tooth Extraction' }, patient: { id: 3, name: 'Jose Reyes' } })],
    meta: {},
  });
  api.appointmentAction.mockResolvedValue({});
  renderClinicPage(<ClinicDashboardPage />, [...ADMIN, 'patients.manage'], 'clinic_admin');

  // Sidebar groups from the design; Services and Branches moved to Clinic Profile tabs.
  const nav = screen.getByRole('navigation', { name: 'Clinic' });
  ['Clinic', 'Team', 'Operations', 'Business'].forEach((group) => expect(within(nav).getByText(group)).toBeInTheDocument());
  expect(within(nav).getByRole('link', { name: 'Clinic Profile' })).toHaveAttribute('href', '/clinic/7/settings');
  expect(within(nav).queryByRole('link', { name: 'Services & Prices' })).not.toBeInTheDocument();
  ['System', 'Notifications', 'Settings'].forEach((name) => expect(within(nav).queryByText(name)).not.toBeInTheDocument());
  expect(screen.queryByLabelText('Search patients, branches, or staff')).not.toBeInTheDocument();

  expect(await screen.findByText('Today\'s Appointments')).toBeInTheDocument();
  expect(screen.getByText('12 appointments')).toBeInTheDocument();
  expect(screen.getByText('5 pending approvals')).toBeInTheDocument();
  expect(screen.getByText('+2 from yesterday')).toBeInTheDocument();
  expect(screen.getByText('+12 this month')).toBeInTheDocument();
  expect(screen.getByText('1 inactive')).toBeInTheDocument();
  expect(screen.getByText('5 active')).toBeInTheDocument();
  expect(screen.getAllByText('12% vs last month').length).toBeGreaterThan(0);
  expect(screen.getByText('Appointment confirmed: Maria Santos – Braces Consultation')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Add Patient/ })).toHaveAttribute('href', '/clinic/7/patients?register=1');
  expect(screen.getByRole('link', { name: /Add Inventory/ })).toHaveAttribute('href', '/clinic/7/inventory?new=1');

  // Approving asks first; declining needs a reason.
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm Jose Reyes' }));
  expect(api.appointmentAction).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Confirm appointment' })).getByRole('button', { name: 'Confirm appointment' }));
  await waitFor(() => expect(api.appointmentAction).toHaveBeenCalledWith('7', '31', 'confirm', undefined));

  fireEvent.click(await screen.findByRole('button', { name: 'Decline Jose Reyes' }));
  const decline = screen.getByRole('dialog', { name: 'Decline request' });
  expect(within(decline).getByRole('button', { name: 'Decline request' })).toBeDisabled();
  fireEvent.change(within(decline).getByLabelText(/Reason/), { target: { value: 'Fully booked' } });
  fireEvent.click(within(decline).getByRole('button', { name: 'Decline request' }));
  await waitFor(() => expect(api.appointmentAction).toHaveBeenCalledWith('7', '31', 'reject', { reason: 'Fully booked' }));
});

test('walk-in: registers a new patient, picks a slot and books it as a walk-in', async () => {
  mockAdminDashboard();
  api.getClinicDashboard.mockResolvedValue({ alerts: [] });
  api.getClinicDentists.mockResolvedValue([{ id: 2, name: 'Dr. Ben Cruz', is_active: true }]);
  api.getClinicServices.mockResolvedValue([{ id: 4, name: 'Dental Cleaning', duration_minutes: 30, is_available: true }]);
  api.registerPatient.mockResolvedValue({ data: { id: 77 } });
  api.bookForPatient.mockResolvedValue({ data: { id: 90, starts_at: '2026-11-02T15:00:00+08:00', patient: { name: 'Jose Reyes' } } });
  mockSlotPicker.confirm = { branchId: 1, startsAt: '2026-11-02 15:00' };
  renderClinicPage(<ClinicDashboardPage />, [...ADMIN, 'patients.manage'], 'clinic_admin');

  fireEvent.click(screen.getByRole('button', { name: 'Walk-in' }));
  const dialog = screen.getByRole('dialog', { name: 'Walk-in appointment' });
  expect(within(dialog).getByRole('button', { name: 'Choose time' })).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'New patient' }));
  fireEvent.change(within(dialog).getByLabelText(/Full name/), { target: { value: 'Jose Reyes' } });
  fireEvent.change(within(dialog).getByLabelText(/Mobile number/), { target: { value: '0917' } });
  await within(dialog).findByRole('option', { name: 'Dr. Ben Cruz' });
  await within(dialog).findByRole('option', { name: 'Dental Cleaning (30 min)' });
  fireEvent.change(within(dialog).getByLabelText(/Dentist/), { target: { value: '2' } });
  fireEvent.change(within(dialog).getByLabelText(/Service/), { target: { value: '4' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Choose time' }));

  fireEvent.click(await screen.findByRole('button', { name: 'Pick slot' }));
  await waitFor(() =>
    expect(api.bookForPatient).toHaveBeenCalledWith('7', { patient_id: 77, service_rate_id: 4, dentist_id: 2, branch_id: 1, starts_at: '2026-11-02 15:00', walk_in: true })
  );
  expect(api.registerPatient).toHaveBeenCalledWith('7', { full_name: 'Jose Reyes', phone: '0917' });
  expect(await screen.findByRole('dialog', { name: 'Walk-in booked' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open appointment' })).toHaveAttribute('href', '/clinic/7/appointments/90');
});

test('owner dashboard details: branches, alerts and CSV export stay under the new sections', async () => {
  mockAdminDashboard();
  api.getClinicDashboard.mockResolvedValue({
    appointments: { today: [], pending_requests: 2, upcoming: 5, completed_this_month: 1, cancelled_this_month: 0 },
    overview: {
      month: '2026-11',
      appointments: { this_month: 15, last_month: 10 },
      revenue_estimate: { this_month: 12000, last_month: 0, currency: 'PHP' },
      staff: { active: 4, dentists: 2 },
      branches: [
        { id: 1, name: 'Main Branch', address: 'Sayre Highway', city: 'Valencia City', is_main: true, latitude: null, longitude: null,
          appointments_today: 3, appointments_this_month: 15, patients_this_month: 9, revenue_this_month: 12000, revenue_today: 3500,
          hours_today: { opens_at: '08:00', closes_at: '17:00' }, open_now: true },
      ],
      treatments: [{ service: 'Dental Cleaning', total: 9 }],
    },
    alerts: [
      { type: 'inventory', severity: 'danger', title: 'Low stock: Gloves', message: '2 box left (minimum 10).', item_id: 4 },
      { type: 'appointments', severity: 'info', title: 'Appointment requests waiting', message: '2 requests need confirming or declining.', status: 'pending' },
    ],
  });
  api.getAppointmentReport.mockResolvedValue({ from: '2026-11-01', to: '2026-11-30', by_status: { completed: 1 }, by_service: [], by_dentist: [], new_patients: 2, reviews: { count: 0, average: 0 } });
  const createObjectURL = jest.fn(() => 'blob:report');
  window.URL.createObjectURL = createObjectURL;
  window.URL.revokeObjectURL = jest.fn();
  const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {}); // jsdom cannot download
  renderClinicPage(<ClinicDashboardPage />, ADMIN, 'clinic_admin');

  expect(await screen.findByRole('heading', { name: 'Branches & Operations' })).toBeInTheDocument();
  expect(screen.getByText('Open now')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Reorder Now' })).toHaveAttribute('href', '/clinic/7/inventory/4?receive=1');
  expect(screen.getByText('₱3,500')).toBeInTheDocument(); // daily revenue

  // Branch row menu
  fireEvent.click(screen.getByRole('button', { name: 'Actions for Main Branch' }));
  expect(screen.getByRole('link', { name: /Manage branch/ })).toHaveAttribute('href', '/clinic/7/branches');
  fireEvent.keyDown(document, { key: 'Escape' });

  // Ignore one alert, then restore; Mark All as Read hides the rest.
  fireEvent.click(screen.getByRole('button', { name: 'Ignore: Low stock: Gloves' }));
  expect(screen.queryByText('Low stock: Gloves')).not.toBeInTheDocument();
  expect(screen.getByText('1 NEW')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Mark All as Read' }));
  expect(screen.getByText(/All clear/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show 2 hidden alerts' }));
  expect(screen.getByText('Low stock: Gloves')).toBeInTheDocument();
  window.localStorage.clear();
  expect(screen.getByText('Dental Cleaning')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Export Report/ }));
  await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
  expect(api.getAppointmentReport).toHaveBeenCalledWith('7');
  expect(click).toHaveBeenCalled();
  click.mockRestore();
});

test('global search finds patients, branches and staff the member can open', async () => {
  api.getClinicPatients.mockResolvedValue({ items: [{ id: 3, name: 'Maria Santos', phone: '0917', email: null }], meta: {} });
  api.getBranches.mockResolvedValue([{ id: 1, name: 'Main Branch', address: 'Fortich St.', city: 'Malaybalay City', is_active: true }]);
  api.getMembers.mockResolvedValue([{ id: 5, user_id: 9, name: 'Dr. Maricar Lim', email: 'maricar@example.com', role: 'dentist', status: 'active' }]);
  // The dashboard design has no search bar; other pages keep it.
  renderClinicPage(
    <ClinicLayout section="services" title="Services">
      <p>content</p>
    </ClinicLayout>,
    ADMIN,
    'clinic_admin'
  );

  const input = screen.getByLabelText('Search patients, branches, or staff');
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'mari' } });

  const results = await screen.findByRole('region', { name: 'Search results' });
  expect(await within(results).findByRole('link', { name: /Maria Santos/ })).toHaveAttribute('href', '/clinic/7/patients/3');
  expect(await within(results).findByRole('link', { name: /Dr\. Maricar Lim/ })).toHaveAttribute('href', '/clinic/7/staff?search=Dr.%20Maricar%20Lim');
  expect(within(results).queryByText('Main Branch')).not.toBeInTheDocument(); // does not match "mari"
  expect(api.getClinicPatients).toHaveBeenCalledWith('7', { search: 'mari', per_page: 5 });
});
