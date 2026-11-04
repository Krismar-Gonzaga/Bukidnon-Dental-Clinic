import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import ClinicAppointmentsPage from './ClinicAppointmentsPage';
import ClinicDentistsPage from './ClinicDentistsPage';
import ClinicInventoryPage, { stockStatus } from './ClinicInventoryPage';
import ClinicPatientsPage, { ageFrom } from './ClinicPatientsPage';
import ClinicReportsPage, { reportRows } from './ClinicReportsPage';
import ClinicSettingsPage, { groupHours } from './ClinicSettingsPage';
import { monthCells } from './ClinicAdminOverview';
import * as api from '../../services/clinicPortalApi';
import { getNotifications } from '../../services/notificationApi';
import { clinicUser, renderWithProviders } from '../../testUtils';
import { appointment, emptyNotifications } from '../../testFixtures';

jest.mock('../../services/clinicPortalApi');
jest.mock('../../services/notificationApi');
jest.mock('../../services/authService');

const ADMIN = ['clinic.view', 'clinic.profile.manage', 'clinic.branches.manage', 'clinic.services.manage', 'clinic.dentists.manage', 'clinic.schedules.manage', 'clinic.staff.manage', 'appointments.view_all', 'appointments.manage', 'patients.view', 'patients.manage', 'inventory.view', 'inventory.manage', 'feedback.view', 'reports.view'];

const renderPage = (element, section, permissions = ADMIN, role = 'clinic_admin') =>
  renderWithProviders(element, { user: clinicUser(permissions, role), route: `/clinic/7/${section}`, path: `/clinic/:clinicId/${section}` });

beforeEach(() => {
  getNotifications.mockResolvedValue(emptyNotifications);
});

test('clinic profile: tabs, details, grouped hours and editing', async () => {
  api.getClinicOverview.mockResolvedValue({
    name: 'Braganza Dental Clinic',
    description: 'Comprehensive oral health care.',
    address: 'Sayre Highway',
    city: 'Valencia City',
    province: 'Bukidnon',
    contact_number: '+63 912 111 2222',
    email: 'braganza@clinic.ph',
    specializations: [{ id: 1, name: 'Orthodontics' }],
    status: 'approved',
    is_published: true,
  });
  api.getBranches.mockResolvedValue([
    { id: 1, name: 'Main Branch', is_main: true, operating_hours: [1, 2, 3, 4, 5].map((day) => ({ day_of_week: day, opens_at: '08:00', closes_at: '17:00' })).concat({ day_of_week: 6, opens_at: '08:00', closes_at: '12:00' }) },
  ]);
  api.getSpecializationOptions.mockResolvedValue([{ id: 1, name: 'Orthodontics' }]);
  api.updateClinicProfile.mockResolvedValue({});
  renderPage(<ClinicSettingsPage />, 'settings');

  expect(await screen.findByRole('heading', { name: 'Braganza Dental Clinic' })).toBeInTheDocument();
  expect(screen.getByText('Orthodontics · Valencia City, Bukidnon')).toBeInTheDocument();
  expect(screen.getByText('braganza@clinic.ph')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Services & Pricing' })).toHaveAttribute('href', '/clinic/7/services');
  expect(screen.getByRole('link', { name: 'Branches' })).toHaveAttribute('href', '/clinic/7/branches');
  expect(await screen.findByText('Monday – Friday')).toBeInTheDocument();
  expect(screen.getByText('8:00 AM – 12:00 PM')).toBeInTheDocument();
  expect(screen.getByText('Closed')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Open in Google Maps/ })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Edit Profile' }));
  const dialog = screen.getByRole('dialog', { name: 'Edit clinic profile' });
  fireEvent.change(within(dialog).getByLabelText(/Clinic name/), { target: { value: 'Braganza Dental' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save profile' }));
  await waitFor(() => expect(api.updateClinicProfile).toHaveBeenCalledWith('7', expect.objectContaining({ name: 'Braganza Dental' })));
});

test('groupHours merges consecutive days', () => {
  expect(groupHours([{ day_of_week: 1, opens_at: '08:00', closes_at: '17:00' }, { day_of_week: 2, opens_at: '08:00', closes_at: '17:00' }])).toEqual([
    { days: 'Monday – Tuesday', text: '8:00 AM – 5:00 PM' },
    { days: 'Wednesday – Sunday', text: null },
  ]);
});

test('dentists: cards, filters and confirmed deactivation', async () => {
  api.getClinicDentists.mockResolvedValue([
    { id: 1, name: 'Dr. Maria Braganza', email: 'm@x.ph', specialization: 'Orthodontist', is_active: true, appointments_today: 5, years_experience: 8, schedules: [] },
    { id: 2, name: 'Dr. Marco Villanueva', email: 'v@x.ph', specialization: 'Oral Surgeon', is_active: false, appointments_today: 0, years_experience: 3, schedules: [] },
  ]);
  api.getBranches.mockResolvedValue([]);
  api.updateDentist.mockResolvedValue({});
  renderPage(<ClinicDentistsPage />, 'dentists');

  expect(await screen.findByText('2 dentists registered')).toBeInTheDocument();
  expect(screen.getByText('5 today')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Activate Dr. Marco Villanueva' })).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'inactive' } });
  expect(screen.queryByText('Dr. Maria Braganza')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: '' } });

  fireEvent.click(screen.getByRole('button', { name: 'Deactivate Dr. Maria Braganza' }));
  expect(api.updateDentist).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Deactivate Dr. Maria Braganza?' })).getByRole('button', { name: 'Deactivate' }));
  await waitFor(() => expect(api.updateDentist).toHaveBeenCalledWith('7', 1, { is_active: false }));

  expect(screen.getByRole('link', { name: 'Add Dentist' })).toHaveAttribute('href', '/clinic/7/dentists/new');
  expect(screen.getByRole('link', { name: 'View profile of Dr. Maria Braganza' })).toHaveAttribute('href', '/clinic/7/dentists/1');
  fireEvent.click(screen.getByRole('button', { name: 'Invite by Email' }));
  expect(screen.getByRole('dialog', { name: 'Invite Dentist by Email' })).toBeInTheDocument();
});

test('appointments: type, age, filters and confirm/cancel on pending ones', async () => {
  api.getClinicDentists.mockResolvedValue([]);
  api.getClinicAppointments.mockResolvedValue({
    appointments: [
      appointment({ id: 1, status: 'pending', type: 'online', service: { name: 'Tooth Extraction' }, patient: { id: 3, name: 'Jose Reyes', age: 45 }, starts_at: '2026-11-02T10:00:00+08:00' }),
      appointment({ id: 2, status: 'confirmed', type: 'walk_in', service: { name: 'Pediatric Cleaning' }, patient: { id: 4, name: 'Ana Lim', age: 8 }, starts_at: '2026-11-02T11:00:00+08:00' }),
    ],
    meta: { current_page: 1, last_page: 1, per_page: 25, total: 2 },
  });
  api.appointmentAction.mockResolvedValue({});
  renderPage(<ClinicAppointmentsPage />, 'appointments');

  const pending = (await screen.findByText('Jose Reyes')).closest('tr');
  expect(within(pending).getByText('Age: 45')).toBeInTheDocument();
  expect(within(pending).getByText('Online')).toBeInTheDocument();
  expect(within(screen.getByText('Ana Lim').closest('tr')).getByText('Walk-in')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Confirm appointment of Ana Lim' })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'pending' } });
  await waitFor(() => expect(api.getClinicAppointments).toHaveBeenLastCalledWith('7', expect.objectContaining({ status: 'pending', page: 1 })));

  fireEvent.click(screen.getByRole('button', { name: 'Cancel appointment of Jose Reyes' }));
  const dialog = screen.getByRole('dialog', { name: 'Cancel appointment' });
  fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'Patient asked' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel appointment' }));
  await waitFor(() => expect(api.appointmentAction).toHaveBeenCalledWith('7', '1', 'cancel', { reason: 'Patient asked' }));
});

test('patients: age, visits, status and no clinical conditions column', async () => {
  api.getClinicPatients.mockResolvedValue({
    items: [{ id: 3, name: 'Maria Santos', email: 'maria@x.ph', phone: '0912', birth_date: '1998-01-01', gender: 'female', visits: 8, last_visit_at: '2026-07-10T09:00:00+08:00', status: 'active' }],
    meta: { current_page: 1, last_page: 1, per_page: 25, total: 1 },
  });
  renderPage(<ClinicPatientsPage />, 'patients');

  const row = (await screen.findByText('Maria Santos')).closest('tr');
  expect(screen.getByText('1 registered patient')).toBeInTheDocument();
  expect(within(row).getByText(/· Female/)).toBeInTheDocument();
  expect(within(row).getByText('8')).toBeInTheDocument();
  expect(within(row).getByRole('link', { name: 'View Maria Santos' })).toHaveAttribute('href', '/clinic/7/patients/3');
  expect(screen.queryByRole('columnheader', { name: 'Conditions' })).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'inactive' } });
  await waitFor(() => expect(api.getClinicPatients).toHaveBeenLastCalledWith('7', expect.objectContaining({ status: 'inactive', page: 1 })));
});

test('ageFrom counts whole years', () => {
  expect(ageFrom('2000-11-03', '2026-11-02')).toBe(25);
  expect(ageFrom('2000-11-02', '2026-11-02')).toBe(26);
  expect(ageFrom(null)).toBeNull();
});

const item = (over) => ({ id: 1, name: 'Dental Gloves', brand: 'Medicom', category: 'PPE', category_id: 2, unit: 'pairs', unit_cost: 180, minimum_stock: 50, quantity_usable: 45, is_active: true, next_expiry: '2027-12-01', ...over });

test('stockStatus: critical at half the minimum or none, low at the minimum', () => {
  expect(stockStatus(item({ quantity_usable: 0, minimum_stock: 0 }))).toBe('critical');
  expect(stockStatus(item({ quantity_usable: 25 }))).toBe('critical');
  expect(stockStatus(item({ quantity_usable: 50 }))).toBe('low');
  expect(stockStatus(item({ quantity_usable: 51 }))).toBe('good');
});

test('inventory: figures, alerts, filter, archive and stock history', async () => {
  api.getInventoryItems.mockResolvedValue([item(), item({ id: 2, name: 'Masks', brand: '3M', quantity_usable: 150, minimum_stock: 100, unit_cost: 15 }), item({ id: 3, name: 'Resin', quantity_usable: 2, minimum_stock: 10, unit_cost: null })]);
  api.getInventoryAlerts.mockResolvedValue({ low_stock: [], near_expiry: [], expired: [{ batch_id: 1 }] });
  api.updateInventoryItem.mockResolvedValue({});
  api.getStockHistory.mockResolvedValue({ items: [{ id: 5, item: 'Masks', unit: 'pcs', type: 'receipt', quantity: 100, balance_after: 150, performed_by: 'Ana', at: '2026-11-01T09:00:00+08:00' }], meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 } });
  renderPage(<ClinicInventoryPage />, 'inventory');

  expect(await screen.findByText('Total Items')).toBeInTheDocument();
  expect(screen.getByText('₱10,350')).toBeInTheDocument(); // 45×180 + 150×15
  expect(screen.getByText('1 item(s) critically low.')).toBeInTheDocument();
  expect(screen.getByText(/1 batch\(es\) expired/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Masks' })).toHaveAttribute('href', '/clinic/7/inventory/2');
  expect(within(screen.getByRole('link', { name: 'Masks' }).closest('tr')).getByText('Dec 2027')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'critical' } });
  expect(screen.queryByRole('link', { name: 'Masks' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Resin' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: '' } });

  fireEvent.click(screen.getByRole('button', { name: 'Archive Masks' }));
  expect(api.updateInventoryItem).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Archive Masks?' })).getByRole('button', { name: 'Archive item' }));
  await waitFor(() => expect(api.updateInventoryItem).toHaveBeenCalledWith('7', 2, { is_active: false }));

  fireEvent.click(screen.getByRole('button', { name: 'Stock History' }));
  const history = screen.getByRole('dialog', { name: 'Stock history' });
  expect(await within(history).findByText('Received +100 pcs')).toBeInTheDocument();
});

const ANALYTICS = {
  year: 2026,
  currency: 'PHP',
  months: [
    { month: '2026-01', total: 100, confirmed: 90, cancelled: 10, revenue: 40000, completed_visits: 40, new_patients: 5 },
    { month: '2026-02', total: 98, confirmed: 88, cancelled: 10, revenue: 50000, completed_visits: 50, new_patients: 7 },
  ],
  totals: { appointments: 198, confirmed: 178, cancelled: 20, active_days: 40, revenue: 90000, completed_visits: 90, new_patients: 12, patients: 300 },
  treatments: [{ service: 'Dental Cleaning', total: 60, revenue: 48000 }],
};

test('reports: tabs show the right figures and exports work', async () => {
  api.getReportAnalytics.mockResolvedValue(ANALYTICS);
  api.getAppointmentReport.mockResolvedValue({ from: '2026-11-01', to: '2026-11-30', by_status: {}, by_service: [], by_dentist: [], new_patients: 0, reviews: { count: 0, average: 0 } });
  api.getInventoryItems.mockResolvedValue([item()]);
  const print = jest.spyOn(window, 'print').mockImplementation(() => {});
  renderPage(<ClinicReportsPage />, 'reports');

  expect(await screen.findByText('198')).toBeInTheDocument();
  expect(screen.getByText('89.9% rate')).toBeInTheDocument();
  expect(screen.getByText('5.0')).toBeInTheDocument(); // avg / day
  expect(screen.getByRole('heading', { name: 'Monthly Appointment Trend (2026)' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Revenue' }));
  expect(screen.getByText('₱90,000')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Treatments' }));
  expect(screen.getByText('60 · ₱48,000')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Patients' }));
  expect(screen.getByText('300')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Inventory' }));
  expect(await screen.findByText('Items to Restock')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Export PDF' }));
  expect(print).toHaveBeenCalled();
  print.mockRestore();
});

test('report rows follow the open tab', () => {
  expect(reportRows('appointments', ANALYTICS)[1]).toEqual(['2026-01', 100, 90, 10]);
  expect(reportRows('revenue', ANALYTICS)[2]).toEqual(['2026-02', 50000, 50]);
  expect(reportRows('treatments', ANALYTICS)[1]).toEqual(['Dental Cleaning', 60, 48000]);
  expect(reportRows('inventory', ANALYTICS, [item()])[1][8]).toBe('low');
});

test('the calendar grid starts on Monday', () => {
  const cells = monthCells('2026-11'); // 1 November 2026 is a Sunday
  expect(cells.slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-11-01']);
  expect(cells.at(-1)).toBe('2026-11-30');
});
