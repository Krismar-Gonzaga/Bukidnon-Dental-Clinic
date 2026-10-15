import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import ClinicDashboardPage from './ClinicDashboardPage';
import ClinicAppointmentDetailPage from './ClinicAppointmentDetailPage';
import ClinicPatientDetailPage from './ClinicPatientDetailPage';
import ClinicInventoryItemPage from './ClinicInventoryItemPage';
import ClinicStaffPage from './ClinicStaffPage';
import * as api from '../../services/clinicPortalApi';
import { getNotifications } from '../../services/notificationApi';
import { clinicUser, renderWithProviders } from '../../testUtils';
import { apiAppointment, appointment, emptyNotifications } from '../../testFixtures';

jest.mock('../../services/clinicPortalApi');
jest.mock('../../services/notificationApi');
jest.mock('../../services/publicApi');

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
  renderClinicPage(<ClinicStaffPage />, ADMIN, 'clinic_admin', { route: '/clinic/7/staff', path: '/clinic/:clinicId/staff' });

  // Admins cannot change their own role or access here.
  expect(await screen.findByText('Ana Reyes')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Suspend access' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Add staff' }));
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
