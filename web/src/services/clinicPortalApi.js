import apiClient, { getData, getPage } from './apiClient';
import { toAppointment } from './adapters';

// Clinic portal: everything under /manage/clinics/{clinicId}. The server
// checks the member's permissions and scopes every record to the clinic.

const base = (clinicId) => `/manage/clinics/${clinicId}`;
const send = async (method, url, body) => (await apiClient[method](url, body)).data;

// Saves a protected file through the signed-in session. An error comes back as
// a blob, so it is read as JSON first to keep its message.
async function saveBlob(url, fileName) {
  let response;
  try {
    response = await apiClient.get(url, { responseType: 'blob' });
  } catch (error) {
    if (typeof Blob !== 'undefined' && error.response?.data instanceof Blob) {
      try {
        error.response.data = JSON.parse(await error.response.data.text());
      } catch {
        // Not JSON: keep the original error.
      }
    }
    throw error;
  }
  const href = window.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(href);
}

// Clinic profile, dashboard, reports
export const getClinicOverview = (clinicId) => getData(base(clinicId));
export const updateClinicProfile = (clinicId, body) => send('put', base(clinicId), body);
export const setClinicPublished = (clinicId, isPublished) => send('put', `${base(clinicId)}/publish`, { is_published: isPublished });
export const getClinicDashboard = (clinicId) => getData(`${base(clinicId)}/dashboard`);
export const getClinicInsights = (clinicId) => getData(`${base(clinicId)}/dashboard/insights`);
export const getReportAnalytics = (clinicId, year) => getData(`${base(clinicId)}/reports/analytics`, { year });
export const getAppointmentCalendar = (clinicId, month) => getData(`${base(clinicId)}/appointments/calendar`, { month });
export const getAppointmentReport = (clinicId, params) => getData(`${base(clinicId)}/reports/appointments`, params);

// Appointments
export async function getClinicAppointments(clinicId, params) {
  const { items, meta } = await getPage(`${base(clinicId)}/appointments`, params);
  return { appointments: items.map(toAppointment), meta };
}
// Every appointment in a date range (calendar views): follows the pages up
// to MAX_CALENDAR_PAGES × 100 appointments.
const MAX_CALENDAR_PAGES = 5;
export async function getClinicAppointmentsInRange(clinicId, params) {
  const appointments = [];
  for (let page = 1; page <= MAX_CALENDAR_PAGES; page += 1) {
    const { items, meta } = await getPage(`${base(clinicId)}/appointments`, { ...params, page, per_page: 100 });
    appointments.push(...items.map(toAppointment));
    if (page >= (meta?.last_page ?? 1)) return { appointments, complete: true };
  }
  return { appointments, complete: false };
}
export const getClinicAppointment = async (clinicId, id) => toAppointment(await getData(`${base(clinicId)}/appointments/${id}`));
export const appointmentAction = (clinicId, id, action, body) =>
  send('post', `${base(clinicId)}/appointments/${id}/${action}`, body);
export const bookForPatient = (clinicId, body) => send('post', `${base(clinicId)}/appointments`, body);
export const getCheckInQueue = (clinicId) => getData(`${base(clinicId)}/appointments/queue`);
export const saveFrontDeskNotes = (clinicId, id, notes) => send('put', `${base(clinicId)}/appointments/${id}/front-desk-notes`, { notes });
export const getMyClinicDetails = (clinicId) => getData(`${base(clinicId)}/me`);
export const updateMyClinicDetails = (clinicId, body) => send('put', `${base(clinicId)}/me`, body);
export const reassignAppointment = (clinicId, id, dentistId) => send('post', `${base(clinicId)}/appointments/${id}/reassign`, { dentist_id: dentistId });

// Patients and clinical records
export const getClinicPatients = (clinicId, params) => getPage(`${base(clinicId)}/patients`, params);
export const registerPatient = (clinicId, body) => send('post', `${base(clinicId)}/patients`, body);
export const getClinicPatient = (clinicId, id) => getData(`${base(clinicId)}/patients/${id}`);
export const updateClinicPatient = (clinicId, id, body) => send('put', `${base(clinicId)}/patients/${id}`, body);
export const getPatientMedicalHistory = (clinicId, id) => getData(`${base(clinicId)}/patients/${id}/medical-history`);
export const addMedicalHistory = (clinicId, id, body) => send('post', `${base(clinicId)}/patients/${id}/medical-history`, body);
export const getPatientRecords = (clinicId, id, includeSuperseded = false) =>
  getData(`${base(clinicId)}/patients/${id}/records`, includeSuperseded ? { include_superseded: 1 } : undefined);
// Current records across the clinic (dentists: their patients only). Reads are audit-logged.
export const getClinicRecords = (clinicId, params) => getPage(`${base(clinicId)}/records`, params);
export const createRecord =(clinicId, patientId, body) => send('post', `${base(clinicId)}/patients/${patientId}/records`, body);
export const amendRecord = (clinicId, patientId, recordId, body) =>
  send('post', `${base(clinicId)}/patients/${patientId}/records/${recordId}/amend`, body);
export const getPatientFiles = (clinicId, patientId) => getData(`${base(clinicId)}/patients/${patientId}/files`);
export const uploadPatientFile = (clinicId, patientId, file) => {
  const body = new FormData();
  body.append('file', file);
  return send('post', `${base(clinicId)}/patients/${patientId}/files`, body);
};
export const downloadPatientFile = (clinicId, patientId, file) =>
  saveBlob(`${base(clinicId)}/patients/${patientId}/files/${file.id}`, file.name);

// Inventory
export const getInventoryItems = (clinicId, params) => getData(`${base(clinicId)}/inventory/items`, params);
export const getInventoryItem = (clinicId, id) => getData(`${base(clinicId)}/inventory/items/${id}`);
export const createInventoryItem = (clinicId, body) => send('post', `${base(clinicId)}/inventory/items`, body);
export const updateInventoryItem = (clinicId, id, body) => send('put', `${base(clinicId)}/inventory/items/${id}`, body);
export const recordMovement = (clinicId, id, body) => send('post', `${base(clinicId)}/inventory/items/${id}/movements`, body);
export const getInventoryAlerts = (clinicId) => getData(`${base(clinicId)}/inventory/alerts`);
export const getStockHistory = (clinicId, params) => getPage(`${base(clinicId)}/inventory/movements`, params);
export const getInventoryCategories = (clinicId) => getData(`${base(clinicId)}/inventory/categories`);
export const createInventoryCategory = (clinicId, name) => send('post', `${base(clinicId)}/inventory/categories`, { name });
export const getSuppliers = (clinicId) => getData(`${base(clinicId)}/inventory/suppliers`);
export const createSupplier = (clinicId, body) => send('post', `${base(clinicId)}/inventory/suppliers`, body);

// Services, dentists, branches, schedules
export const getClinicServices = (clinicId) => getData(`${base(clinicId)}/services`);
export const createClinicService = (clinicId, body) => send('post', `${base(clinicId)}/services`, body);
export const updateClinicService = (clinicId, id, body) => send('put', `${base(clinicId)}/services/${id}`, body);
export const archiveClinicService = (clinicId, id) => send('delete', `${base(clinicId)}/services/${id}`);
export const getClinicDentists = (clinicId) => getData(`${base(clinicId)}/dentists`);
export const getClinicDentist = (clinicId, id) => getData(`${base(clinicId)}/dentists/${id}`);
export const updateDentist = (clinicId, id, body) => send('put', `${base(clinicId)}/dentists/${id}`, body);
export const updateDentistSchedules = (clinicId, id, schedules) => send('put', `${base(clinicId)}/dentists/${id}/schedules`, { schedules });
export const getBranches = (clinicId) => getData(`${base(clinicId)}/branches`);
export const createBranch = (clinicId, body) => send('post', `${base(clinicId)}/branches`, body);
export const updateBranch = (clinicId, id, body) => send('put', `${base(clinicId)}/branches/${id}`, body);
export const removeBranch = (clinicId, id) => send('delete', `${base(clinicId)}/branches/${id}`);
export const updateBranchHours = (clinicId, id, hours) => send('put', `${base(clinicId)}/branches/${id}/hours`, { hours });
export const getHolidays = (clinicId) => getData(`${base(clinicId)}/holidays`);
export const createHoliday = (clinicId, body) => send('post', `${base(clinicId)}/holidays`, body);
export const deleteHoliday = (clinicId, id) => send('delete', `${base(clinicId)}/holidays/${id}`);
// Dentists' schedule changes waiting for a decision.
export const getScheduleChanges = (clinicId, params) => getData(`${base(clinicId)}/schedule-changes`, params);
export const approveScheduleChange = (clinicId, id) => send('post', `${base(clinicId)}/schedule-changes/${id}/approve`);
export const rejectScheduleChange = (clinicId, id, reason) => send('post', `${base(clinicId)}/schedule-changes/${id}/reject`, { reason });
export const getScheduleBlocks = (clinicId) => getData(`${base(clinicId)}/schedule-blocks`);
export const createScheduleBlock = (clinicId, body) => send('post', `${base(clinicId)}/schedule-blocks`, body);
export const deleteScheduleBlock = (clinicId, id) => send('delete', `${base(clinicId)}/schedule-blocks/${id}`);

// Staff and reviews
export const getMembers = (clinicId) => getData(`${base(clinicId)}/members`);
export const inviteMember = (clinicId, body) => send('post', `${base(clinicId)}/members`, body);
export const updateMember = (clinicId, id, body) => send('put', `${base(clinicId)}/members/${id}`, body);
export const resetMemberPassword = (clinicId, id) => send('post', `${base(clinicId)}/members/${id}/reset-password`);
export const getClinicReviews = (clinicId, params) => getPage(`${base(clinicId)}/reviews`, params);
export const reportReview = (clinicId, reviewId, reason) => send('post', `${base(clinicId)}/reviews/${reviewId}/report`, { reason });
export const replyToReview = (clinicId, reviewId, reply) => send('post', `${base(clinicId)}/reviews/${reviewId}/reply`, { reply });

// Clinic settings, role permissions and the clinic's audit log
export const getClinicSettings = (clinicId) => getData(`${base(clinicId)}/settings`);
export const updateClinicSettings = (clinicId, body) => send('put', `${base(clinicId)}/settings`, body);
export const getRolePermissions = (clinicId) => getData(`${base(clinicId)}/role-permissions`);
export const updateRolePermissions = (clinicId, positions) => send('put', `${base(clinicId)}/role-permissions`, { positions });
export const getClinicAuditLogs = (clinicId, params) => getPage(`${base(clinicId)}/audit-logs`, params);
export const exportClinicAuditLogs = (clinicId) => saveBlob(`${base(clinicId)}/audit-logs/export`, 'clinic-audit-log.csv');

// Subscription (payment is made outside the app; proof is reviewed by a system administrator)
export const getSubscription = (clinicId) => getData(`${base(clinicId)}/subscription`);
export const submitPaymentProof = (clinicId, { method, reference, proof }) => {
  const body = new FormData();
  body.append('method', method);
  if (reference) body.append('reference', reference);
  body.append('proof', proof);
  return send('post', `${base(clinicId)}/subscription/payments`, body);
};
export const requestRenewal = (clinicId) => send('post', `${base(clinicId)}/subscription/renewal-request`);
export const downloadInvoice = (clinicId, payment) =>
  saveBlob(`${base(clinicId)}/subscription/payments/${payment.id}/invoice`, `${payment.invoice_number ?? 'invoice'}.pdf`);

// Shared lookups
export const getSpecializationOptions = () => getData('/specializations');
export const getServiceCategories = () => getData('/services');

// Invitations addressed to the signed-in user
export const getMyInvitations = () => getData('/my/invitations');
export const respondToInvitation = (id, accept) => send('post', `/my/invitations/${id}/${accept ? 'accept' : 'decline'}`);
