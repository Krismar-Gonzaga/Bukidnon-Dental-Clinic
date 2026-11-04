import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import ClinicAppointmentDetailPage from './ClinicAppointmentDetailPage';
import ClinicAppointmentsPage from './ClinicAppointmentsPage';
import ClinicCheckInPage from './ClinicCheckInPage';
import ClinicDashboardPage from './ClinicDashboardPage';
import ClinicDentistSchedulePage from './ClinicDentistSchedulePage';
import ClinicNotificationsPage from './ClinicNotificationsPage';
import FrontDeskProfilePage from './FrontDeskProfilePage';
import { hourParts, summarizeToday, workingDaysLabel } from './frontDesk';
import * as api from '../../services/clinicPortalApi';
import { getAvailability } from '../../services/publicApi';
import { getNotificationPreferences, getNotifications, markNotificationRead, updateNotificationPreferences } from '../../services/notificationApi';
import { clinicUser, renderWithProviders } from '../../testUtils';
import { appointment, emptyNotifications } from '../../testFixtures';
import { businessTodayKey } from '../../utils/dateTime';

jest.mock('../../services/clinicPortalApi');
jest.mock('../../services/notificationApi');
jest.mock('../../services/publicApi');
jest.mock('../../services/authService');

const STAFF = ['clinic.view', 'appointments.view_all', 'appointments.manage', 'patients.view', 'patients.manage', 'patients.medical_alerts'];
const today = businessTodayKey();
const at = (time) => `${today}T${time}:00+08:00`;

const renderPage = (element, route, path, permissions = STAFF) => renderWithProviders(element, { user: clinicUser(permissions, 'staff'), route, path });

const todayAppointment = (id, name, status, time) => appointment({ id, status, starts_at: at(time), patient: { id: id + 100, name }, service: { id: 4, name: 'Dental Cleaning' }, dentist: { id: 2, name: 'Dr. Ben Cruz' } });

beforeEach(() => {
  getNotifications.mockResolvedValue(emptyNotifications);
});

test('summaries and labels the front desk screens rely on', () => {
  const rows = ['checked_in', 'in_progress', 'pending', 'completed', 'no_show', 'confirmed'].map((backendStatus) => ({ backendStatus }));
  expect(summarizeToday(rows)).toEqual({ total: 6, waiting: 1, ongoing: 1, checkedIn: 2, completed: 1, pending: 1, noShow: 1 });
  expect(workingDaysLabel([1, 2, 3, 4, 5])).toBe('Mon – Fri');
  expect(workingDaysLabel([1, 3])).toBe('Mon, Wed');
  expect(workingDaysLabel([])).toBe('Not set');
  expect(hourParts('2026-11-03T08:00:00+08:00')).toEqual({ hour: '8', period: 'AM' });
  expect(hourParts('2026-11-03T08:30:00+08:00')).toEqual({ hour: '8:30', period: 'AM' });
});

test('dashboard: staff sidebar, no inventory, the queue and quick actions', async () => {
  api.getClinicAppointments.mockImplementation(async (_, params) => ({
    appointments: params.from === today ? [todayAppointment(1, 'Maria Santos', 'checked_in', '08:00'), todayAppointment(2, 'Carlos Dizon', 'pending', '11:00')] : [],
    meta: { total: 2 },
  }));
  renderPage(<ClinicDashboardPage />, '/clinic/7/dashboard', '/clinic/:clinicId/dashboard');

  const nav = screen.getByRole('navigation', { name: 'Clinic' });
  ['Dashboard', 'Appointments', 'Patients', 'Check-in / Queue', 'Dentist Schedule', 'Notifications', 'My Profile'].forEach((name) => expect(within(nav).getByRole('link', { name })).toBeInTheDocument());
  expect(within(nav).queryByRole('link', { name: 'Inventory' })).not.toBeInTheDocument();

  expect(await screen.findByText('Maria Santos')).toBeInTheDocument();
  expect(screen.getByText('2 appointments')).toBeInTheDocument();
  expect(screen.getByText('1 patient')).toBeInTheDocument();
  expect(screen.getByText('Not checked in')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Register Patient/ })).toHaveAttribute('href', '/clinic/7/patients?register=1');
  expect(screen.getByRole('link', { name: /Schedule Appointment/ })).toHaveAttribute('href', '/clinic/7/appointments/new');
  expect(screen.getAllByRole('link', { name: /Check In Patient/ })[0]).toHaveAttribute('href', '/clinic/7/check-in');
});

test('a staff member given other modules keeps those sections', () => {
  api.getClinicAppointments.mockResolvedValue({ appointments: [], meta: { total: 0 } });
  renderPage(<ClinicDashboardPage />, '/clinic/7/dashboard', '/clinic/:clinicId/dashboard', [...STAFF, 'inventory.view', 'reports.view']);

  const nav = screen.getByRole('navigation', { name: 'Clinic' });
  expect(within(nav).getByRole('link', { name: 'Inventory' })).toBeInTheDocument();
  expect(within(nav).getByRole('link', { name: 'Reports' })).toBeInTheDocument();
});

test('appointments: confirm pending, check in only confirmed visits today, and asks first', async () => {
  const tomorrow = appointment({ id: 3, status: 'confirmed', starts_at: '2099-01-01T08:00:00+08:00', patient: { id: 9, name: 'Future Patient' } });
  api.getClinicAppointments.mockResolvedValue({ appointments: [todayAppointment(1, 'Ana Lim', 'confirmed', '10:00'), todayAppointment(2, 'Carlos Dizon', 'pending', '11:00'), tomorrow], meta: { total: 3, last_page: 1 } });
  api.appointmentAction.mockResolvedValue({});
  renderPage(<ClinicAppointmentsPage />, '/clinic/7/appointments', '/clinic/:clinicId/appointments');

  expect(await screen.findByText('3 total')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirm Carlos Dizon' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Check in Carlos Dizon' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Check in Future Patient' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Check in Ana Lim' }));
  expect(api.appointmentAction).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Check In Patient' })).getByRole('button', { name: 'Check In' }));
  await waitFor(() => expect(api.appointmentAction).toHaveBeenCalledWith('7', '1', 'check-in'));
});

test('check-in wizard: search, pick today, see alerts, check in and get a queue number', async () => {
  api.getCheckInQueue.mockResolvedValue([{ id: 8, queue_number: 1, patient: 'Maria Santos', service: 'Braces', dentist: 'Dr. Ben Cruz', status: 'in_progress', checked_in_at: at('08:00') }]);
  api.getClinicPatients.mockResolvedValue({ items: [{ id: 3, name: 'John Reyes', phone: '0917', gender: 'male' }], meta: {} });
  api.getClinicAppointments.mockResolvedValue({ appointments: [todayAppointment(5, 'John Reyes', 'confirmed', '09:00'), todayAppointment(6, 'John Reyes', 'pending', '12:00')], meta: {} });
  api.getClinicAppointment.mockResolvedValue(appointment({ id: 5, status: 'confirmed', starts_at: at('09:00'), patient: { id: 3, name: 'John Reyes' }, service: { id: 4, name: 'Dental Cleaning' }, dentist: { id: 2, name: 'Dr. Ben Cruz' }, medical_flags: ['Allergies: Penicillin'] }));
  api.appointmentAction.mockResolvedValue({});
  renderPage(<ClinicCheckInPage />, '/clinic/7/check-in', '/clinic/:clinicId/check-in');

  expect(await screen.findByText('Serving')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search patient by name or phone'), { target: { value: 'jo' } });
  fireEvent.click(await screen.findByRole('button', { name: /John Reyes/ }));

  const rows = await screen.findAllByRole('button', { name: /Dental Cleaning/ });
  expect(rows[1]).toBeDisabled(); // pending: must be confirmed first
  fireEvent.click(rows[0]);

  expect(await screen.findByText('Allergies: Penicillin')).toBeInTheDocument();
  api.getCheckInQueue.mockResolvedValue([{ id: '5', queue_number: 3, patient: 'John Reyes', service: 'Dental Cleaning', dentist: 'Dr. Ben Cruz', status: 'checked_in', checked_in_at: at('09:15') }]);
  fireEvent.click(screen.getByRole('button', { name: 'Check In Patient' }));

  expect(await screen.findByRole('heading', { name: 'Check-in Successful!' })).toBeInTheDocument();
  expect(api.appointmentAction).toHaveBeenCalledWith('7', '5', 'check-in');
  expect(await screen.findByText(/Queue #3/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Check In Another Patient' }));
  expect(screen.getByLabelText('Search patient by name or phone')).toHaveValue('');
});

test('appointment details: alerts, saved notes, cancel asks, no reassign, success line', async () => {
  api.getClinicAppointment.mockResolvedValue(appointment({ id: 12, status: 'confirmed', starts_at: at('09:00'), patient: { id: 3, name: 'John Reyes', phone: '0917', age: 32, gender: 'male' }, medical_flags: ['Allergies: Penicillin'], front_desk_notes: 'Call first', patient_last_visit_at: '2026-07-01T09:00:00+08:00' }));
  api.saveFrontDeskNotes.mockResolvedValue({});
  api.appointmentAction.mockResolvedValue({});
  renderPage(<ClinicAppointmentDetailPage />, '/clinic/7/appointments/12', '/clinic/:clinicId/appointments/:appointmentId');

  expect(await screen.findByText('Medical Notes')).toBeInTheDocument();
  expect(screen.getByText('Allergies: Penicillin')).toBeInTheDocument();
  expect(screen.getByText('32 · Male')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Patient Profile' })).toHaveAttribute('href', '/clinic/7/patients/3');
  expect(screen.queryByRole('button', { name: 'Reassign Dentist' })).not.toBeInTheDocument();

  const notes = screen.getByLabelText('Front-desk notes');
  expect(notes).toHaveValue('Call first');
  fireEvent.change(notes, { target: { value: 'Call after 2 PM' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Notes' }));
  await waitFor(() => expect(api.saveFrontDeskNotes).toHaveBeenCalledWith('7', '12', 'Call after 2 PM'));

  fireEvent.click(screen.getByRole('button', { name: 'Cancel Appointment' }));
  const dialog = screen.getByRole('dialog', { name: 'Cancel Appointment' });
  expect(within(dialog).getByRole('button', { name: 'Yes, Cancel' })).toBeDisabled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Keep Appointment' }));
  expect(api.appointmentAction).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Mark No-Show' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Mark No-Show' })).getByRole('button', { name: 'Mark No-Show' }));
  expect(await screen.findByText('Status updated to no-show.')).toBeInTheDocument();
});

test('appointment details offer Check In on the day of the visit only', async () => {
  const detailPath = '/clinic/:clinicId/appointments/:appointmentId';
  api.getClinicAppointment.mockResolvedValue(appointment({ id: 12, status: 'confirmed', starts_at: at('09:00'), patient: { id: 3, name: 'John Reyes' } }));
  const { unmount } = renderPage(<ClinicAppointmentDetailPage />, '/clinic/7/appointments/12', detailPath);
  expect(await screen.findByRole('button', { name: 'Check In' })).toBeInTheDocument();
  unmount();

  api.getClinicAppointment.mockResolvedValue(appointment({ id: 13, status: 'confirmed', starts_at: '2099-01-15T09:00:00+08:00', patient: { id: 3, name: 'John Reyes' } }));
  renderPage(<ClinicAppointmentDetailPage />, '/clinic/7/appointments/13', detailPath);
  expect(await screen.findByRole('button', { name: 'Mark No-Show' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Check In' })).not.toBeInTheDocument();
});

test('dentist schedule is view-only and shows the day, availability and open slots', async () => {
  api.getClinicDentists.mockResolvedValue([{ id: 2, name: 'Dr. Ben Cruz', is_active: true, schedules: [1, 2, 3, 4, 5].map((day) => ({ day_of_week: day, starts_at: '08:00', ends_at: '17:00', branch_id: 1 })) }]);
  api.getClinicServices.mockResolvedValue([{ id: 4, duration_minutes: 60, is_available: true }, { id: 5, duration_minutes: 30, is_available: true }]);
  api.getClinicAppointments.mockResolvedValue({ appointments: [todayAppointment(1, 'Maria Santos', 'confirmed', '08:00')], meta: { total: 1 } });
  getAvailability.mockResolvedValue([{ startsAt: at('12:00'), label: '12:00 PM', branchId: 1 }]);
  renderPage(<ClinicDentistSchedulePage />, '/clinic/7/dentist-schedule', '/clinic/:clinicId/dentist-schedule');

  expect(await screen.findByText('Maria Santos')).toBeInTheDocument();
  expect(screen.getByText('Mon – Fri')).toBeInTheDocument();
  expect(await screen.findByText('12:00 PM')).toBeInTheDocument();
  expect(getAvailability).toHaveBeenCalledWith(expect.objectContaining({ serviceRateId: 5, dentistId: '2', date: today }));
  expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
});

test('notifications: unread count, mark one read and no settings tab', async () => {
  getNotifications.mockResolvedValue({ notifications: [{ id: 'a', kind: 'appointment', title: 'Check-in Reminder', message: 'Ana Lim is due', time: 'now', unread: true }], unreadCount: 1, pageCount: 1 });
  markNotificationRead.mockResolvedValue({});
  renderPage(<ClinicNotificationsPage />, '/clinic/7/notifications', '/clinic/:clinicId/notifications');

  expect(await screen.findByText('1 unread')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Mark Check-in Reminder as read' }));
  await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith('a'));
});

test('profile: details, read-only schedule and saved preferences', async () => {
  api.getMyClinicDetails.mockResolvedValue({ name: 'Patricia Gomez', email: 'p@example.com', phone: '0912', address: 'Purok 3', position_label: 'Front Desk Staff', clinic_name: 'Valencia Smiles', status: 'active', work_schedule: { days: [1, 2], starts_at: '07:30', ends_at: '17:00' } });
  getNotificationPreferences.mockResolvedValue({ categories: { system_announcements: false } });
  updateNotificationPreferences.mockResolvedValue({});
  renderPage(<FrontDeskProfilePage />, '/clinic/7/profile', '/clinic/:clinicId/profile');

  expect(await screen.findByText('Purok 3')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Schedule' }));
  expect(screen.getByText(/7:30 AM/)).toBeInTheDocument();
  expect(screen.getByText('Schedule changes must be requested through Clinic Admin.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Security' }));
  expect(screen.getByRole('button', { name: 'Update Password' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Preferences' }));
  const toggle = await screen.findByRole('switch', { name: /System Announcements/ });
  expect(toggle).not.toBeChecked();
  fireEvent.click(toggle);
  await waitFor(() => expect(updateNotificationPreferences).toHaveBeenCalledWith({ categories: { system_announcements: true } }));
});
