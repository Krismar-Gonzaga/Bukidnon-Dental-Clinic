import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import ClinicDashboardPage from './ClinicDashboardPage';
import DentalChartPage from './dentist/DentalChartPage';
import ClinicalNotesPage, { ClinicalNoteFormPage } from './dentist/ClinicalNotesPage';
import DentalCertificatesPage from './dentist/DentalCertificatesPage';
import DentistAppointmentDetail from './dentist/DentistAppointmentDetail';
import DentistPatientProfile from './dentist/DentistPatientProfile';
import DentistSchedulePage from './dentist/DentistSchedulePage';
import FollowUpsPage from './dentist/FollowUpsPage';
import PrescriptionsPage, { PrescriptionFormPage } from './dentist/PrescriptionsPage';
import * as dentistApi from '../../services/dentistApi';
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
jest.mock('../../services/dentistApi');
jest.mock('../../services/notificationApi');
jest.mock('../../services/publicApi');

// Dentist portal: dashboard, chart, notes, documents and follow-ups.

const DENTIST = ['clinic.view', 'appointments.view_assigned', 'appointments.review_assigned', 'appointments.progress', 'patients.view', 'records.view', 'records.write', 'documents.issue'];
const STAFF = ['clinic.view', 'appointments.view_all', 'appointments.manage', 'patients.view', 'patients.manage'];

const todayAt = (time) => `${businessTodayKey()}T${time}:00+08:00`;
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

const render = (element, { permissions = DENTIST, role = 'dentist', route = '/clinic/7/dashboard', path = '/clinic/:clinicId/dashboard' } = {}) =>
  renderWithProviders(element, { user: clinicUser(permissions, role), route, path });

beforeEach(() => {
  getNotifications.mockResolvedValue(emptyNotifications);
  dentistApi.getDentistPatients.mockResolvedValue({ items: [{ id: 3, name: 'Juan Dela Cruz', phone: '0917' }], meta: { total: 1 } });
  api.getClinicRecords.mockResolvedValue({ items: [], meta: { last_page: 1 } });
  api.getClinicPatients.mockResolvedValue({ items: [{ id: 3, name: 'Juan Dela Cruz', phone: '0917', email: null }], meta: {} });
  api.getClinicAppointments.mockResolvedValue({ appointments: [], meta: {} });
});

const overview = {
  today: [
    apiAppointment({ id: 21, status: 'in_progress', starts_at: todayAt('09:00'), ends_at: todayAt('09:30'), patient: { id: 3, name: 'Juan Dela Cruz' } }),
  ],
  counts: { today: 1, today_confirmed: 0, pending: 2, active_patients: 8, upcoming: 4 },
  upcoming_range: { from: '2026-11-05', to: '2026-11-07' },
  pending_requests: [apiAppointment({ id: 22, status: 'pending', starts_at: todayAt('11:00'), ends_at: todayAt('11:30'), patient: { id: 4, name: 'Rosa Lim' } })],
  upcoming_patients: [],
  follow_ups_due: [{ id: 5, patient: 'Ana Lim', due_on: '2026-12-01', priority: 'high' }],
  week: [1, 2, 3, 4, 5, 6, 7].map((day) => ({ date: `2026-11-0${day}`, total: day === 2 ? 5 : 0 })),
};

test('dashboard: the design sidebar, real counts, queue, requests and follow-ups', async () => {
  dentistApi.getDentistOverview.mockResolvedValue(overview);
  render(<ClinicDashboardPage />);

  const nav = screen.getByRole('navigation', { name: 'Clinic' });
  expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
    'Dashboard', 'Appointments', 'My Patients', 'Dental Chart', 'Clinical Notes', 'Treatment Records', 'Prescriptions',
    'Dental Certificates', 'Imaging & Files', 'Follow-up', 'Notifications', 'My Schedule', 'My Profile',
  ]);

  expect(await screen.findByRole('heading', { name: /Dr\. Ana Reyes/ })).toBeInTheDocument();
  expect(screen.getByText('2 requests')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Juan Dela Cruz.*Ongoing/ })).toHaveAttribute('href', '/clinic/7/appointments/21');
  expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute('href', '/clinic/7/appointments/22');
  expect(screen.getByText('Ana Lim')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: /Appointments this week:.*5/ })).toBeInTheDocument();
});

test('appointment details: clinical alerts, and a visit in progress can be completed after asking', async () => {
  dentistApi.getDentistAppointment.mockResolvedValue({
    ...apiAppointment({ id: 12, status: 'in_progress', starts_at: todayAt('09:00'), ends_at: todayAt('09:30'), patient: { id: 3, name: 'Juan Dela Cruz', age: 32, gender: 'male' } }),
    treatment_notes: 'Upper arch wire',
    patient_snapshot: { blood_type: 'A+', allergies: 'Penicillin', conditions: 'Hypertension', medications: null, visits: 6 },
  });
  api.appointmentAction.mockResolvedValue({});
  render(<DentistAppointmentDetail />, { route: '/clinic/7/appointments/12', path: '/clinic/:clinicId/appointments/:appointmentId' });

  expect(await screen.findByText('Medical Alerts')).toBeInTheDocument();
  expect(screen.getByText('Allergies: Penicillin')).toBeInTheDocument();
  expect(screen.getByLabelText('Notes on this visit')).toHaveValue('Upper arch wire');
  expect(screen.getByRole('link', { name: 'Prescribe' })).toHaveAttribute('href', '/clinic/7/prescriptions/new?patient=3');

  fireEvent.click(screen.getByRole('button', { name: 'Mark as Completed' }));
  expect(api.appointmentAction).not.toHaveBeenCalled();
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark as Completed' }));
  await waitFor(() => expect(api.appointmentAction).toHaveBeenCalledWith('7', '12', 'complete'));
});

test('dental chart: choosing a tooth opens it, and saving sends its status and notes', async () => {
  const teeth = Array.from({ length: 32 }, (_, i) => ({ number: i + 1, status: i === 9 ? 'caries' : 'healthy', notes: i === 9 ? 'Early caries, monitor' : null, charted: i === 9 }));
  dentistApi.getDentalChart.mockResolvedValue({ teeth, summary: { healthy: 31, caries: 1, filled: 0, crown: 0, missing: 0, planned: 0 }, last_updated_at: todayAt('08:00') });
  dentistApi.saveTooth.mockResolvedValue({});
  render(<DentalChartPage />, { route: '/clinic/7/dental-chart?patient=3', path: '/clinic/:clinicId/dental-chart' });

  expect(await screen.findByText('Select a tooth')).toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: /^Tooth \d+/ })).toHaveLength(32);

  fireEvent.click(screen.getByRole('button', { name: 'Tooth 10, Caries' }));
  expect(screen.getByLabelText('Clinical Notes')).toHaveValue('Early caries, monitor');
  fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'filled' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  await waitFor(() => expect(dentistApi.saveTooth).toHaveBeenCalledWith('7', 3, 10, { status: 'filled', notes: 'Early caries, monitor' }));
});

test('a new clinical note needs a patient and content, and can be a draft or final', async () => {
  dentistApi.saveNewRecord.mockResolvedValue({});
  render(<ClinicalNoteFormPage />, { route: '/clinic/7/clinical-notes/new', path: '/clinic/:clinicId/clinical-notes/new' });

  const draft = await screen.findByRole('button', { name: 'Save as Draft' });
  expect(draft).toBeDisabled();
  await screen.findByRole('option', { name: 'Juan Dela Cruz' });
  fireEvent.change(screen.getByLabelText(/Patient/), { target: { value: '3' } });
  expect(draft).toBeDisabled();

  fireEvent.change(screen.getByLabelText('Diagnosis'), { target: { value: 'Gingivitis' } });
  fireEvent.click(draft);
  await waitFor(() => expect(dentistApi.saveNewRecord).toHaveBeenCalledWith('7', '3', expect.objectContaining({ status: 'draft', diagnosis: 'Gingivitis', record_type: 'examination' })));
});

test('a final note is corrected with a reason, while a draft is simply edited', async () => {
  const note = { id: 9, patient_id: 3, patient: { name: 'Juan Dela Cruz' }, record_type: 'examination', status: 'final', chief_complaint: 'Pain', diagnosis: 'Caries', created_at: todayAt('08:00') };
  dentistApi.getRecordsOfKind.mockResolvedValue({ items: [note, { ...note, id: 10, status: 'draft' }], meta: { total: 2, last_page: 1 } });
  dentistApi.correctRecord.mockResolvedValue({});
  render(<ClinicalNotesPage />, { route: '/clinic/7/clinical-notes', path: '/clinic/:clinicId/clinical-notes' });

  expect(await screen.findByText('Finalized')).toBeInTheDocument();
  expect(screen.getByText('Draft')).toBeInTheDocument();

  fireEvent.click(screen.getAllByRole('button', { name: 'View Full Note' })[0]);
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Correct Note' }));
  const editor = screen.getByRole('dialog', { name: 'Correct Note' });
  const save = within(editor).getByRole('button', { name: 'Save Correction' });
  expect(save).toBeDisabled();
  fireEvent.change(within(editor).getByLabelText(/Reason for correction/), { target: { value: 'Wrong tooth' } });
  fireEvent.click(save);
  await waitFor(() => expect(dentistApi.correctRecord).toHaveBeenCalledWith('7', 3, 9, expect.objectContaining({ amendment_reason: 'Wrong tooth', status: 'final' })));
});

test('the pre-procedure checklist starts unticked: nothing shows as reviewed until it is', async () => {
  dentistApi.getDentistPatient.mockResolvedValue({ id: 3, name: 'Juan Dela Cruz', status: 'active', visits: 2, medical_summary: { blood_type: 'O+' } });
  dentistApi.getPatientRecordList.mockResolvedValue([]);
  dentistApi.getMedicalHistory.mockResolvedValue({ current: null });
  dentistApi.getChecklist.mockResolvedValue({ items: { allergies_reviewed: false, conditions_assessed: false, medications_reviewed: false, blood_pressure_normal: false, blood_sugar_safe: false, latex_free_required: false }, reviewed_at: null });
  dentistApi.saveChecklist.mockResolvedValue({});
  render(<DentistPatientProfile />, { route: '/clinic/7/patients/3', path: '/clinic/:clinicId/patients/:patientId' });

  fireEvent.click(await screen.findByRole('button', { name: 'Medical History' }));
  const item = await screen.findByRole('button', { name: 'Patient allergies reviewed' });
  expect(item).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByText(/Not reviewed yet/)).toBeInTheDocument();
  fireEvent.click(item);
  await waitFor(() => expect(dentistApi.saveChecklist).toHaveBeenCalledWith('7', 3, expect.objectContaining({ allergies_reviewed: true, latex_free_required: false })));
});

test('certificates: preview issues nothing, and a missing licence blocks printing', async () => {
  const document = (license) => ({
    title: 'Treatment Certificate', clinic: { name: 'Braganza', address: 'Valencia' }, patient: { name: 'Juan Dela Cruz', description: '24 years of age, male' },
    statement: 'has undergone the following dental treatment:', purpose: 'Cleaning', dentist: { name: 'Dr. Reyes', license_number: license }, issued_at: todayAt('08:00'),
  });
  dentistApi.previewCertificate.mockResolvedValue(document(null));
  render(<DentalCertificatesPage />, { route: '/clinic/7/certificates', path: '/clinic/:clinicId/certificates' });

  await screen.findByRole('option', { name: 'Juan Dela Cruz' });
  fireEvent.click(screen.getByRole('button', { name: /Treatment Certificate/ }));
  fireEvent.change(screen.getByLabelText(/Patient/), { target: { value: '3' } });
  fireEvent.change(screen.getByLabelText(/Treatment Summary/), { target: { value: 'Cleaning' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview Certificate' }));

  expect(await screen.findByText(/licence number is not on file/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Print Certificate' })).toBeDisabled();
  expect(dentistApi.printNewCertificate).not.toHaveBeenCalled();

  // Changing anything clears the preview: what is printed is what was seen.
  fireEvent.change(screen.getByLabelText(/Treatment Summary/), { target: { value: 'Filling' } });
  expect(screen.queryByRole('button', { name: 'Print Certificate' })).not.toBeInTheDocument();
});

test('prescribing needs every required field and opens with the patient already chosen', async () => {
  dentistApi.issuePrescription.mockResolvedValue({});
  render(<PrescriptionFormPage />, { route: '/clinic/7/prescriptions/new?patient=3', path: '/clinic/:clinicId/prescriptions/new' });

  const save = await screen.findByRole('button', { name: 'Save Prescription' });
  expect(save).toBeDisabled();
  ['Medication', 'Dosage', 'Frequency', 'Duration'].forEach((label) => fireEvent.change(screen.getByLabelText(new RegExp(label)), { target: { value: 'x' } }));
  fireEvent.click(save);
  await waitFor(() => expect(dentistApi.issuePrescription).toHaveBeenCalledWith('7', expect.objectContaining({ patient_id: '3', medication: 'x' })));
});

test('clinic admins read prescriptions but are not offered issuing them', async () => {
  dentistApi.getPrescriptions.mockResolvedValue({ items: [], meta: { total: 0, last_page: 1 } });
  render(<PrescriptionsPage />, { permissions: ['clinic.view', 'records.view', 'records.write'], role: 'clinic_admin', route: '/clinic/7/prescriptions', path: '/clinic/:clinicId/prescriptions' });

  expect(await screen.findByText('No prescriptions issued yet.')).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: /New Prescription/ })).not.toBeInTheDocument();
});

test('follow-ups show the server summary and open for editing', async () => {
  dentistApi.getFollowUps.mockResolvedValue({
    items: [{ id: 5, patient: { id: 3, name: 'Juan Dela Cruz' }, purpose: 'Retainer check', due_on: '2026-12-01', priority: 'high', status: 'scheduled', notes: 'Bring retainer' }],
    meta: { total: 1, last_page: 1, summary: { total: 1, high_priority: 1, confirmed: 0 } },
  });
  dentistApi.updateFollowUp.mockResolvedValue({});
  render(<FollowUpsPage />, { route: '/clinic/7/follow-ups', path: '/clinic/:clinicId/follow-ups' });

  expect(await screen.findByText('Retainer check')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit follow-up for Juan Dela Cruz' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.change(within(dialog).getByLabelText('Status'), { target: { value: 'completed' } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Save Changes' }));
  await waitFor(() => expect(dentistApi.updateFollowUp).toHaveBeenCalledWith('7', 5, expect.objectContaining({ status: 'completed' })));
});

const scheduleData = (extra = {}) => ({
  days: [1, 2, 3, 4, 5],
  starts_at: '08:00',
  ends_at: '17:00',
  week: [],
  branches: [{ id: 2, name: 'Main Branch', days: [1, 2, 3, 4, 5], starts_at: '08:00', ends_at: '17:00' }],
  summary: { working_days: 5, max_daily_slots: 18, clinic: 'Demo Clinic', status: 'active' },
  pending_change: null,
  last_decision: null,
  ...extra,
});
const openSchedule = () => render(<DentistSchedulePage />, { route: '/clinic/7/my-schedule', path: '/clinic/:clinicId/my-schedule' });

test('a dentist submits new hours for approval instead of saving them', async () => {
  dentistApi.getDentistSchedule.mockResolvedValue(scheduleData());
  dentistApi.submitScheduleChange.mockResolvedValue({});
  openSchedule();

  fireEvent.click(await screen.findByRole('button', { name: 'Edit Schedule' }));
  fireEvent.click(screen.getByRole('button', { name: 'Fri' }));
  fireEvent.change(screen.getByLabelText('Note to your administrator'), { target: { value: 'Teaching on Fridays' } });
  expect(screen.queryByRole('button', { name: 'Save Schedule' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Submit for Approval' }));

  await waitFor(() =>
    expect(dentistApi.submitScheduleChange).toHaveBeenCalledWith('7', { days: [1, 2, 3, 4], starts_at: '08:00', ends_at: '17:00', note: 'Teaching on Fridays', branch_id: 2 })
  );
});

test('with two branches the form edits one of them, not the merged week', async () => {
  dentistApi.getDentistSchedule.mockResolvedValue(
    scheduleData({
      days: [1, 2, 3],
      branches: [
        { id: 2, name: 'Main Branch', days: [1, 3], starts_at: '08:00', ends_at: '17:00' },
        { id: 3, name: 'Valencia Branch', days: [2], starts_at: '09:00', ends_at: '16:00' },
      ],
    })
  );
  dentistApi.submitScheduleChange.mockResolvedValue({});
  openSchedule();

  expect(await screen.findByText('Valencia Branch')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit Schedule' }));
  expect(screen.getByRole('button', { name: 'Mon' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Tue' })).toHaveAttribute('aria-pressed', 'false');

  fireEvent.change(screen.getByLabelText('Branch'), { target: { value: '3' } });
  expect(screen.getByRole('button', { name: 'Tue' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Mon' })).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(screen.getByRole('button', { name: 'Thu' }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit for Approval' }));

  await waitFor(() =>
    expect(dentistApi.submitScheduleChange).toHaveBeenCalledWith('7', expect.objectContaining({ branch_id: 3, days: [2, 4], starts_at: '09:00', ends_at: '16:00' }))
  );
});

test('while a change waits, the dentist cannot edit again but can cancel it', async () => {
  dentistApi.getDentistSchedule.mockResolvedValue(
    scheduleData({ pending_change: { id: 4, days: [1, 2], starts_at: '08:00', ends_at: '12:00', status: 'pending', created_at: todayAt('08:00') } })
  );
  dentistApi.cancelScheduleChange.mockResolvedValue({});
  openSchedule();

  expect(await screen.findByText('Waiting for approval')).toBeInTheDocument();
  expect(screen.getByText(/Your current hours stay in effect/)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Edit Schedule' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel Request' }));
  await waitFor(() => expect(dentistApi.cancelScheduleChange).toHaveBeenCalledWith('7', 4));
});

test('a declined change shows the reason, and the dentist can try again', async () => {
  dentistApi.getDentistSchedule.mockResolvedValue(
    scheduleData({ last_decision: { id: 4, days: [1, 2], starts_at: '08:00', ends_at: '12:00', status: 'rejected', review_note: 'Short-staffed', created_at: todayAt('08:00') } })
  );
  openSchedule();

  expect(await screen.findByText('Your last change was not approved')).toBeInTheDocument();
  expect(screen.getByText('Reason: Short-staffed')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Edit Schedule' })).toBeInTheDocument();
});

test("dentist schedule: week calendar, today's agenda and month view", async () => {
  const visit = apiAppointment({ id: 31, status: 'confirmed', starts_at: todayAt('09:00'), ends_at: todayAt('10:00'), patient: { id: 3, name: 'Juan Dela Cruz' } });
  api.getClinicAppointmentsInRange.mockResolvedValue({ appointments: [toAppointment(visit)], complete: true });
  render(<ClinicSchedulePage />, { route: '/clinic/7/schedule', path: '/clinic/:clinicId/schedule' });

  const nav = screen.getByRole('navigation', { name: 'Clinic' });
  expect(within(nav).getByRole('link', { name: 'My Schedule' })).toHaveAttribute('aria-current', 'page');

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

  expect(await screen.findByRole('link', { name: /Back to Schedule/ })).toHaveAttribute('href', '/clinic/7/schedule');
  fireEvent.click((await screen.findAllByRole('button', { name: 'Start Visit' }))[0]);
  expect(api.appointmentAction).not.toHaveBeenCalled();

  const dialog = screen.getByRole('dialog', { name: 'Start Visit' });
  expect(dialog).toHaveTextContent('Start the visit with Juan Dela Cruz?');
  fireEvent.click(within(dialog).getByRole('button', { name: 'Start Visit' }));
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
