import apiClient, { getData, getPage } from './apiClient';
import { toAppointment } from './adapters';

// Clinic portal: everything under /manage/clinics/{clinicId}. The server
// checks the member's permissions and scopes every record to the clinic.

const base = (clinicId) => `/manage/clinics/${clinicId}`;
const send = async (method, url, body) => (await apiClient[method](url, body)).data;

// Clinic profile, dashboard, reports
export const getClinicOverview = (clinicId) => getData(base(clinicId));
export const updateClinicProfile = (clinicId, body) => send('put', base(clinicId), body);
export const setClinicPublished = (clinicId, isPublished) => send('put', `${base(clinicId)}/publish`, { is_published: isPublished });
export const getClinicDashboard = (clinicId) => getData(`${base(clinicId)}/dashboard`);
export const getAppointmentReport = (clinicId, params) => getData(`${base(clinicId)}/reports/appointments`, params);

// Appointments
export async function getClinicAppointments(clinicId, params) {
  const { items, meta } = await getPage(`${base(clinicId)}/appointments`, params);
  return { appointments: items.map(toAppointment), meta };
}
export const getClinicAppointment = async (clinicId, id) => toAppointment(await getData(`${base(clinicId)}/appointments/${id}`));
export const appointmentAction = (clinicId, id, action, body) =>
  send('post', `${base(clinicId)}/appointments/${id}/${action}`, body);
export const bookForPatient = (clinicId, body) => send('post', `${base(clinicId)}/appointments`, body);

// Patients and clinical records
export const getClinicPatients = (clinicId, params) => getPage(`${base(clinicId)}/patients`, params);
export const registerPatient = (clinicId, body) => send('post', `${base(clinicId)}/patients`, body);
export const getClinicPatient = (clinicId, id) => getData(`${base(clinicId)}/patients/${id}`);
export const updateClinicPatient = (clinicId, id, body) => send('put', `${base(clinicId)}/patients/${id}`, body);
export const getPatientMedicalHistory = (clinicId, id) => getData(`${base(clinicId)}/patients/${id}/medical-history`);
export const addMedicalHistory = (clinicId, id, body) => send('post', `${base(clinicId)}/patients/${id}/medical-history`, body);
export const getPatientRecords = (clinicId, id, includeSuperseded = false) =>
  getData(`${base(clinicId)}/patients/${id}/records`, includeSuperseded ? { include_superseded: 1 } : undefined);
export const createRecord = (clinicId, patientId, body) => send('post', `${base(clinicId)}/patients/${patientId}/records`, body);
export const amendRecord = (clinicId, patientId, recordId, body) =>
  send('post', `${base(clinicId)}/patients/${patientId}/records/${recordId}/amend`, body);

// Inventory
export const getInventoryItems = (clinicId, params) => getData(`${base(clinicId)}/inventory/items`, params);
export const getInventoryItem = (clinicId, id) => getData(`${base(clinicId)}/inventory/items/${id}`);
export const createInventoryItem = (clinicId, body) => send('post', `${base(clinicId)}/inventory/items`, body);
export const updateInventoryItem = (clinicId, id, body) => send('put', `${base(clinicId)}/inventory/items/${id}`, body);
export const recordMovement = (clinicId, id, body) => send('post', `${base(clinicId)}/inventory/items/${id}/movements`, body);
export const getInventoryAlerts = (clinicId) => getData(`${base(clinicId)}/inventory/alerts`);
export const getInventoryCategories = (clinicId) => getData(`${base(clinicId)}/inventory/categories`);
export const createInventoryCategory = (clinicId, name) => send('post', `${base(clinicId)}/inventory/categories`, { name });
export const getSuppliers = (clinicId) => getData(`${base(clinicId)}/inventory/suppliers`);
export const createSupplier = (clinicId, body) => send('post', `${base(clinicId)}/inventory/suppliers`, body);

// Services, dentists, branches, schedules
export const getClinicServices = (clinicId) => getData(`${base(clinicId)}/services`);
export const createClinicService = (clinicId, body) => send('post', `${base(clinicId)}/services`, body);
export const updateClinicService = (clinicId, id, body) => send('put', `${base(clinicId)}/services/${id}`, body);
export const getClinicDentists = (clinicId) => getData(`${base(clinicId)}/dentists`);
export const updateDentist = (clinicId, id, body) => send('put', `${base(clinicId)}/dentists/${id}`, body);
export const updateDentistSchedules = (clinicId, id, schedules) => send('put', `${base(clinicId)}/dentists/${id}/schedules`, { schedules });
export const getBranches = (clinicId) => getData(`${base(clinicId)}/branches`);
export const createBranch = (clinicId, body) => send('post', `${base(clinicId)}/branches`, body);
export const updateBranch = (clinicId, id, body) => send('put', `${base(clinicId)}/branches/${id}`, body);
export const updateBranchHours = (clinicId, id, hours) => send('put', `${base(clinicId)}/branches/${id}/hours`, { hours });
export const getHolidays = (clinicId) => getData(`${base(clinicId)}/holidays`);
export const createHoliday = (clinicId, body) => send('post', `${base(clinicId)}/holidays`, body);
export const deleteHoliday = (clinicId, id) => send('delete', `${base(clinicId)}/holidays/${id}`);
export const getScheduleBlocks = (clinicId) => getData(`${base(clinicId)}/schedule-blocks`);
export const createScheduleBlock = (clinicId, body) => send('post', `${base(clinicId)}/schedule-blocks`, body);
export const deleteScheduleBlock = (clinicId, id) => send('delete', `${base(clinicId)}/schedule-blocks/${id}`);

// Staff and reviews
export const getMembers = (clinicId) => getData(`${base(clinicId)}/members`);
export const inviteMember = (clinicId, body) => send('post', `${base(clinicId)}/members`, body);
export const updateMember = (clinicId, id, body) => send('put', `${base(clinicId)}/members/${id}`, body);
export const getClinicReviews = (clinicId, params) => getPage(`${base(clinicId)}/reviews`, params);
export const reportReview = (clinicId, reviewId, reason) => send('post', `${base(clinicId)}/reviews/${reviewId}/report`, { reason });

// Shared lookups
export const getSpecializationOptions = () => getData('/specializations');
export const getServiceCategories = () => getData('/services');

// Invitations addressed to the signed-in user
export const getMyInvitations = () => getData('/my/invitations');
export const respondToInvitation = (id, accept) => send('post', `/my/invitations/${id}/${accept ? 'accept' : 'decline'}`);
