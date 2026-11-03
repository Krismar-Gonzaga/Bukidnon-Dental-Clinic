import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import ClinicDashboardPage from './ClinicDashboardPage';
import ClinicAppointmentDetailPage from './ClinicAppointmentDetailPage';
import ClinicSchedulePage from './ClinicSchedulePage';
import ClinicRecordsPage from './ClinicRecordsPage';
import * as api from '../../services/clinicPortalApi';
import { getNotifications } from '../../services/notificationApi';
import { toAppointment } from '../../services/adapters';
import { businessTodayKey } from '../../utils/dateTime';
import { clinicUser, renderWithProviders } from '../../testUtils';
import { apiAppointment, appointment, emptyNotifications } from '../../testFixtures';

jest.mock('../../services/clinicPortalApi');
jest.mock('../../services/notificationApi');
jest.mock('../../services/publicApi');

// Dentist portal (dentist dashboard design): Overview, Schedule, Records.

const DENTIST = ['clinic.view', 'appointments.view_assigned', 'appointments.progress', 'patients.view', 'records.view', 'records.write'];
const STAFF = ['clinic.view', 'appointments.view_all', 'appointments.manage', 'patients.view', 'patients.manage'];

const todayAt = (time) => `${businessTodayKey()}T${time}:00+08:00`;
const weekdayToday = () =>
  new Date(todayAt('12:00')).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Manila' });

const record = {
  id: 61,
  patient_id: 3,
  patient: { id: 3, name: 'Juan Dela Cruz' },
  record_type: 'examination',
  findings: 'Sensitivity in lower left molar',
  created_at: todayAt('08:00'),
  dentist: 'Dr. Ana Reyes',
  is_patient_visible: false,
};

const emptyDashboard = {
  appointments: { today: [], pending_requests: 0, upcoming: 0, completed_this_month: 0, cancelled_this_month: 0, same_day_last_week: 0 },
  my_patients: { total: 0, new_this_month: 0, new_today: 0 },
  alerts: [],
};

const render = (element, { permissions = DENTIST, role = 'dentist', route = '/clinic/7/dashboard', path = '/clinic/:clinicId/dashboard' } = {}) =>
  renderWithProviders(element, { user: clinicUser(permissions, role), route, path });

beforeEach(() => {
  getNotifications.mockResolvedValue(emptyNotifications);
  api.getClinicDashboard.mockResolvedValue(emptyDashboard);
  api.getClinicRecords.mockResolvedValue({ items: [], meta: { last_page: 1 } });
  api.getClinicPatients.mockResolvedValue({ items: [{ id: 3, name: 'Juan Dela Cruz', phone: '0917', email: null }], meta: {} });
  api.getClinicAppointments.mockResolvedValue({ appointments: [], meta: {} });
});

test('dentist overview: own sidebar, today, figures and recent notes', async () => {
  api.getClinicDashboard.mockResolvedValue({
    ...emptyDashboard,
    appointments: {
      ...emptyDashboard.appointments,
      today: [
        apiAppointment({ id: 21, status: 'confirmed', starts_at: todayAt('09:00'), ends_at: todayAt('09:30'), patient: { id: 3, name: 'Juan Dela Cruz' } }),
        apiAppointment({ id: 22, status: 'cancelled', starts_at: todayAt('10:00'), ends_at: todayAt('10:30'), patient: { id: 4, name: 'Rosa Lim' } }),
      ],
      same_day_last_week: 2,
    },
    my_patients: { total: 9, new_this_month: 4, new_today: 2 },
  });
  api.getClinicRecords.mockResolvedValue({ items: [record], meta: { last_page: 1 } });
  render(<ClinicDashboardPage />);

  const nav = screen.getByRole('navigation', { name: 'Clinic' });
  expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual(['Overview', 'Schedule', 'Patients', 'Records']);
  expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();

  expect(await screen.findByRole('heading', { name: /Dr\. Ana Reyes/ })).toBeInTheDocument();
  expect(screen.getByText(/You have 1 appointment scheduled for today/)).toBeInTheDocument();
  expect(screen.getByText(`-50% vs last ${weekdayToday()}`)).toBeInTheDocument();
  expect(screen.getByText('+2 today')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Juan Dela Cruz.*Confirmed/ })).toHaveAttribute('href', '/clinic/7/appointments/21');
  expect(await screen.findByText('Sensitivity in lower left molar')).toBeInTheDocument();
  expect(api.getClinicRecords).toHaveBeenCalledWith('7', { mine: 1, per_page: 3 });
  // Registering patients needs patients.manage, which dentists do not have.
  expect(screen.queryByRole('link', { name: /Add New Patient/ })).not.toBeInTheDocument();
});

test('a treatment plan from the quick actions is checked and confirmed before saving', async () => {
  api.createRecord.mockResolvedValue({});
  render(<ClinicDashboardPage />);

  fireEvent.click(await screen.findByRole('button', { name: /Create Treatment Plan/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Juan Dela Cruz/ }));
  const dialog = screen.getByRole('dialog', { name: 'Create treatment plan' });

  fireEvent.click(within(dialog).getByRole('button', { name: 'Save record' }));
  expect(within(dialog).getByRole('alert')).toHaveTextContent(/at least a complaint/);

  fireEvent.change(within(dialog).getByLabelText('Procedures performed'), { target: { value: 'Root canal, tooth 36' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save record' }));
  expect(api.createRecord).not.toHaveBeenCalled();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Yes, save record' }));

  await waitFor(() =>
    expect(api.createRecord).toHaveBeenCalledWith('7', 3, expect.objectContaining({ record_type: 'treatment', procedures: 'Root canal, tooth 36' }))
  );
  expect(await screen.findByText(/Record saved for/)).toHaveTextContent('Record saved for Juan Dela Cruz.');
});

test('closing a record with unsaved changes asks before discarding', async () => {
  render(<ClinicDashboardPage />);

  fireEvent.click(await screen.findByRole('button', { name: /Add Examination Note/ }));
  fireEvent.click(await screen.findByRole('button', { name: /Juan Dela Cruz/ }));
  const dialog = screen.getByRole('dialog', { name: 'Add examination note' });
  fireEvent.change(within(dialog).getByLabelText('Findings'), { target: { value: 'Caries on 16' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

  const confirm = screen.getByRole('dialog', { name: 'Discard this record?' });
  fireEvent.click(within(confirm).getByRole('button', { name: 'Go back' }));
  expect(within(dialog).getByLabelText('Findings')).toHaveValue('Caries on 16');
});

test("dentist schedule: week calendar, today's agenda and month view", async () => {
  const visit = apiAppointment({ id: 31, status: 'confirmed', starts_at: todayAt('09:00'), ends_at: todayAt('10:00'), patient: { id: 3, name: 'Juan Dela Cruz' } });
  api.getClinicAppointmentsInRange.mockResolvedValue({ appointments: [toAppointment(visit)], complete: true });
  render(<ClinicSchedulePage />, { route: '/clinic/7/schedule', path: '/clinic/:clinicId/schedule' });

  const nav = screen.getByRole('navigation', { name: 'Clinic' });
  expect(within(nav).getByRole('link', { name: 'Schedule' })).toHaveAttribute('aria-current', 'page');

  expect(await screen.findByText(/1 appointment scheduled this week with you/)).toBeInTheDocument();
  const block = screen.getByRole('link', { name: '9:00 AM, Dental Cleaning with Juan Dela Cruz, Confirmed' });
  expect(block).toHaveAttribute('href', '/clinic/7/appointments/31');
  expect(screen.getByRole('heading', { name: "Today's Agenda" })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Month' }));
  expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true');
  expect(await screen.findByText(/scheduled this month with you/)).toBeInTheDocument();
});

test('a dentist confirms before starting a visit', async () => {
  api.getClinicAppointment.mockResolvedValue(appointment({ status: 'checked_in', patient: { id: 3, name: 'Juan Dela Cruz' } }));
  api.appointmentAction.mockResolvedValue({});
  render(<ClinicAppointmentDetailPage />, { route: '/clinic/7/appointments/12', path: '/clinic/:clinicId/appointments/:appointmentId' });

  expect(await screen.findByRole('link', { name: /Back to schedule/ })).toHaveAttribute('href', '/clinic/7/schedule');
  fireEvent.click(screen.getByRole('button', { name: 'Start visit' }));
  expect(api.appointmentAction).not.toHaveBeenCalled();

  const dialog = screen.getByRole('dialog', { name: 'Start visit' });
  expect(dialog).toHaveTextContent('Start the visit with Juan Dela Cruz?');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Start visit' }));
  await waitFor(() => expect(api.appointmentAction).toHaveBeenCalledWith('7', '12', 'start', undefined));
});

test("records page lists the dentist's records and filters to their own", async () => {
  api.getClinicRecords.mockResolvedValue({ items: [record], meta: { last_page: 1 } });
  render(<ClinicRecordsPage />, { route: '/clinic/7/records?mine=1', path: '/clinic/:clinicId/records' });

  expect(await screen.findByText('Sensitivity in lower left molar')).toBeInTheDocument();
  expect(api.getClinicRecords).toHaveBeenCalledWith('7', expect.objectContaining({ mine: 1, page: 1 }));
  fireEvent.click(screen.getByLabelText('Only records I wrote'));
  await waitFor(() => expect(api.getClinicRecords).toHaveBeenLastCalledWith('7', expect.objectContaining({ mine: undefined })));
});

test('records page is closed to roles without records access', () => {
  render(<ClinicRecordsPage />, { permissions: STAFF, role: 'staff', route: '/clinic/7/records', path: '/clinic/:clinicId/records' });
  expect(screen.getByText('Navigated away')).toBeInTheDocument();
});
