import apiClient, { getData, getPage } from './apiClient';
import { API_ORIGIN } from '../config/api';

// Dentist portal: what a dentist works from under /manage/clinics/{clinicId}. The server scopes
// all of it to the signed-in dentist's own patients and logs every clinical read.

const base = (clinicId) => `/manage/clinics/${clinicId}`;
const send = async (method, url, body) => (await apiClient[method](url, body)).data;

// Their day, week and profile
export const getDentistOverview = (clinicId) => getData(`${base(clinicId)}/dentist/overview`);
export const getDentistSchedule = (clinicId) => getData(`${base(clinicId)}/dentist/schedule`);
// Proposed hours apply only once a clinic administrator approves them.
export const submitScheduleChange = (clinicId, body) => send('post', `${base(clinicId)}/dentist/schedule/changes`, body);
export const cancelScheduleChange = (clinicId, id) => send('delete', `${base(clinicId)}/dentist/schedule/changes/${id}`);
export const requestScheduleChange = (clinicId, message) => send('post', `${base(clinicId)}/dentist/schedule/request-change`, { message });
export const getDentistProfile = (clinicId) => getData(`${base(clinicId)}/dentist/profile`);
export const updateDentistProfile = (clinicId, body) => send('put', `${base(clinicId)}/dentist/profile`, body);

// Appointments (the raw record: the detail page also needs the patient snapshot)
export const getDentistAppointment = (clinicId, id) => getData(`${base(clinicId)}/appointments/${id}`);
export const saveTreatmentNotes = (clinicId, id, notes) => send('put', `${base(clinicId)}/appointments/${id}/treatment-notes`, { notes });

// Patients
export const getDentistPatients = (clinicId, params) => getPage(`${base(clinicId)}/patients`, params);
export const getDentistPatient = (clinicId, id) => getData(`${base(clinicId)}/patients/${id}`);
export const getMedicalHistory = (clinicId, id) => getData(`${base(clinicId)}/patients/${id}/medical-history`);
export const addMedicalHistory = (clinicId, id, body) => send('post', `${base(clinicId)}/patients/${id}/medical-history`, body);

// Dental chart and checklist
export const getDentalChart = (clinicId, patientId) => getData(`${base(clinicId)}/patients/${patientId}/dental-chart`);
export const saveTooth = (clinicId, patientId, tooth, body) => send('put', `${base(clinicId)}/patients/${patientId}/dental-chart/${tooth}`, body);
export const getChecklist = (clinicId, patientId) => getData(`${base(clinicId)}/patients/${patientId}/checklist`);
export const saveChecklist = (clinicId, patientId, items) => send('put', `${base(clinicId)}/patients/${patientId}/checklist`, { items });

// Notes and treatment records (both are patient records)
export const getRecordsOfKind = (clinicId, kind, params) => getPage(`${base(clinicId)}/records`, { kind, ...params });
export const getPatientRecordList = (clinicId, patientId) => getData(`${base(clinicId)}/patients/${patientId}/records`);
export const saveNewRecord = (clinicId, patientId, body) => send('post', `${base(clinicId)}/patients/${patientId}/records`, body);
export const updateDraft = (clinicId, patientId, recordId, body) => send('put', `${base(clinicId)}/patients/${patientId}/records/${recordId}`, body);
export const correctRecord = (clinicId, patientId, recordId, body) => send('post', `${base(clinicId)}/patients/${patientId}/records/${recordId}/amend`, body);

// Prescriptions and certificates
export const getPrescriptions = (clinicId, params) => getPage(`${base(clinicId)}/prescriptions`, params);
export const issuePrescription = (clinicId, body) => send('post', `${base(clinicId)}/prescriptions`, body);
export const previewCertificate = (clinicId, body) => getDataFromPost(`${base(clinicId)}/certificates/preview`, body);
export const issueCertificate = (clinicId, body) => getDataFromPost(`${base(clinicId)}/certificates`, body);

async function getDataFromPost(url, body) {
  return (await apiClient.post(url, body)).data.data;
}

/**
 * Opens a printable page in a new tab. The tab has to be opened during the click (browsers
 * block it later), so it starts empty and goes to the signed link once the server gives it.
 */
export async function openPrintPage(getSignedUrl) {
  const tab = window.open('', '_blank');
  try {
    const url = await getSignedUrl();
    if (tab) {
      tab.opener = null;
      tab.location.href = `${API_ORIGIN}${url}`;
    } else {
      window.location.href = `${API_ORIGIN}${url}`;
    }
  } catch (error) {
    tab?.close();
    throw error;
  }
}

export const printPrescription = (clinicId, id) => openPrintPage(async () => (await getData(`${base(clinicId)}/prescriptions/${id}/print-link`)).url);
export const printNewCertificate = (clinicId, body) => openPrintPage(async () => (await issueCertificate(clinicId, body)).url);

// Files
export const getClinicFiles = (clinicId, params) => getPage(`${base(clinicId)}/files`, params);
export const getPatientFileList = (clinicId, patientId) => getData(`${base(clinicId)}/patients/${patientId}/files`);
export async function getFileViewUrl(clinicId, patientId, fileId) {
  const { url } = await getData(`${base(clinicId)}/patients/${patientId}/files/${fileId}/link`);
  return `${API_ORIGIN}${url}`;
}
export function uploadClinicalFile(clinicId, patientId, { file, category, notes }) {
  const body = new FormData();
  body.append('file', file);
  if (category) body.append('category', category);
  if (notes) body.append('notes', notes);
  return send('post', `${base(clinicId)}/patients/${patientId}/files`, body);
}

// Follow-ups
export const getFollowUps = (clinicId, params) => getPage(`${base(clinicId)}/follow-ups`, params);
export const createFollowUp = (clinicId, body) => send('post', `${base(clinicId)}/follow-ups`, body);
export const updateFollowUp = (clinicId, id, body) => send('put', `${base(clinicId)}/follow-ups/${id}`, body);
