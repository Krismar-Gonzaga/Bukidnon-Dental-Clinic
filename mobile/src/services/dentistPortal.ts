// Dentist portal calls (web: services/dentistApi.js). The server scopes all of it to the
// signed-in dentist's own patients and logs every clinical read.
import api from './http';
import { API_BASE_URL } from './config';
import { ClinicAppointment, PickedFile } from './clinicPortal';

const base = (clinicId: number) => `/manage/clinics/${clinicId}`;
const data = async <T,>(url: string, params?: Record<string, unknown>): Promise<T> => (await api.get(url, { params })).data?.data;
const posted = async <T,>(url: string, body?: unknown): Promise<T> => (await api.post(url, body)).data?.data;
const put = async <T,>(url: string, body?: unknown): Promise<T> => (await api.put(url, body)).data?.data;
const page = async <T, M = Record<string, unknown>>(url: string, params?: Record<string, unknown>) => {
  const response = await api.get(url, { params });
  return { items: (response.data?.data ?? []) as T[], meta: (response.data?.meta ?? {}) as { current_page?: number; last_page?: number; total?: number } & M };
};
const absolute = (url: string) => `${API_BASE_URL.replace(/\/api\/?$/, '')}${url}`;

export type DentistOverviewData = {
  today: ClinicAppointment[];
  counts: { today: number; today_confirmed: number; pending: number; active_patients: number; upcoming: number };
  upcoming_range: { from: string; to: string };
  pending_requests: ClinicAppointment[];
  upcoming_patients: ClinicAppointment[];
  follow_ups_due: { id: number; patient: string | null; due_on: string; priority: string }[];
  week: { date: string; total: number }[];
};
export const fetchDentistOverview = (clinicId: number) => data<DentistOverviewData>(`${base(clinicId)}/dentist/overview`);

export type DentistScheduleData = {
  days: number[];
  starts_at: string | null;
  ends_at: string | null;
  week: { date: string; appointments: { id: number; starts_at: string; patient: string }[] }[];
  branches: { id: number; name: string; days: number[]; starts_at: string | null; ends_at: string | null }[];
  summary: { working_days: number; max_daily_slots: number; clinic: string; status: string };
  pending_change: ScheduleChangeSummary | null;
  last_decision: ScheduleChangeSummary | null;
};
export type ScheduleChangeSummary = { id: number; branch?: string | null; days: number[]; starts_at: string; ends_at: string; note: string | null; status: string; review_note: string | null; created_at: string };
export const fetchDentistSchedule = (clinicId: number) => data<DentistScheduleData>(`${base(clinicId)}/dentist/schedule`);
// Proposed hours apply only once a clinic administrator approves them.
export const submitScheduleChange = (clinicId: number, body: { days: number[]; starts_at: string; ends_at: string; note?: string; branch_id?: number }) => posted(`${base(clinicId)}/dentist/schedule/changes`, body);
export const cancelScheduleChange = (clinicId: number, id: number) => api.delete(`${base(clinicId)}/dentist/schedule/changes/${id}`);
export type ScheduleChange = Omit<ScheduleChangeSummary, 'branch'> & {
  dentist: { id: number; name: string | null };
  branch: { id: number; name: string | null };
  current: { days: number[]; starts_at: string | null; ends_at: string | null };
  outside_hours: number | null;
};
export const fetchScheduleChanges = (clinicId: number, dentistId?: number) => data<ScheduleChange[]>(`${base(clinicId)}/schedule-changes`, dentistId ? { dentist_id: dentistId } : undefined);
export const approveScheduleChange = (clinicId: number, id: number) => posted(`${base(clinicId)}/schedule-changes/${id}/approve`);
export const rejectScheduleChange = (clinicId: number, id: number, reason: string) => posted(`${base(clinicId)}/schedule-changes/${id}/reject`, { reason });
export const requestScheduleChange = (clinicId: number, message: string) => api.post(`${base(clinicId)}/dentist/schedule/request-change`, { message });

export type DentistProfileData = {
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  website: string | null;
  specialization: string | null;
  specialization_id: number | null;
  secondary_specialization: string | null;
  education: string | null;
  years_experience: number | null;
  bio: string | null;
  license_number: string | null;
  ptr_number: string | null;
  s2_number: string | null;
  clinic_name: string;
  status: string;
  specializations: { id: number; name: string }[];
};
export const fetchDentistProfile = (clinicId: number) => data<DentistProfileData>(`${base(clinicId)}/dentist/profile`);
export const updateDentistProfile = (clinicId: number, body: Record<string, unknown>) => put<DentistProfileData>(`${base(clinicId)}/dentist/profile`, body);

export type AppointmentDetail = ClinicAppointment & {
  treatment_notes?: string | null;
  patient_snapshot?: { blood_type: string | null; allergies: string | null; conditions: string | null; medications: string | null; visits: number } | null;
};
export const fetchAppointmentDetail = (clinicId: number, id: number) => data<AppointmentDetail>(`${base(clinicId)}/appointments/${id}`);
export const saveTreatmentNotes = (clinicId: number, id: number, notes: string) => put(`${base(clinicId)}/appointments/${id}/treatment-notes`, { notes });

export type DentistPatient = {
  id: number;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  age?: number | null;
  gender?: string | null;
  allergies?: string | null;
  conditions?: string | null;
  visits: number;
  last_visit_at?: string | null;
  status?: string;
  medical_summary?: { blood_type: string | null; conditions: string | null; allergies: string | null; medications: string | null } | null;
};
export const fetchDentistPatients = (clinicId: number, params: Record<string, unknown>) => page<DentistPatient>(`${base(clinicId)}/patients`, params);
export const fetchDentistPatient = (clinicId: number, id: number) => data<DentistPatient>(`${base(clinicId)}/patients/${id}`);

export type MedicalHistory = { current: { allergies: string | null; medications: string | null; conditions: string | null } | null };
export const fetchMedicalHistory = (clinicId: number, id: number) => data<MedicalHistory>(`${base(clinicId)}/patients/${id}/medical-history`);
export const addMedicalHistory = (clinicId: number, id: number, body: Record<string, string>) => api.post(`${base(clinicId)}/patients/${id}/medical-history`, body);

export type Tooth = { number: number; status: string; notes: string | null; charted: boolean };
export type DentalChart = { teeth: Tooth[]; summary: Record<string, number>; last_updated_at: string | null };
export const fetchDentalChart = (clinicId: number, patientId: number) => data<DentalChart>(`${base(clinicId)}/patients/${patientId}/dental-chart`);
export const saveTooth = (clinicId: number, patientId: number, tooth: number, body: { status: string; notes: string | null }) => put<DentalChart>(`${base(clinicId)}/patients/${patientId}/dental-chart/${tooth}`, body);

export type Checklist = { items: Record<string, boolean>; reviewed_by: string | null; reviewed_at: string | null };
export const fetchChecklist = (clinicId: number, patientId: number) => data<Checklist>(`${base(clinicId)}/patients/${patientId}/checklist`);
export const saveChecklist = (clinicId: number, patientId: number, items: Record<string, boolean>) => put<Checklist>(`${base(clinicId)}/patients/${patientId}/checklist`, { items });

export type ClinicalRecord = {
  id: number;
  patient_id: number;
  patient?: { id: number; name: string | null };
  record_type: string;
  status: string;
  chief_complaint?: string | null;
  findings?: string | null;
  diagnosis?: string | null;
  procedures?: string | null;
  treatment_plan?: string | null;
  follow_up_recommendations?: string | null;
  tooth_numbers?: string | null;
  materials_used?: string | null;
  notes?: string | null;
  performed_on?: string | null;
  dentist?: string | null;
  author?: string | null;
  amendment_reason?: string | null;
  created_at: string;
};
export const fetchRecordsOfKind = (clinicId: number, kind: 'notes' | 'treatments', params: Record<string, unknown>) => page<ClinicalRecord>(`${base(clinicId)}/records`, { kind, ...params });
export const fetchPatientRecords = (clinicId: number, patientId: number) => data<ClinicalRecord[]>(`${base(clinicId)}/patients/${patientId}/records`);
export const saveRecord = (clinicId: number, patientId: number, body: Record<string, unknown>) => posted(`${base(clinicId)}/patients/${patientId}/records`, body);
export const updateDraft = (clinicId: number, patientId: number, id: number, body: Record<string, unknown>) => put(`${base(clinicId)}/patients/${patientId}/records/${id}`, body);
export const correctRecord = (clinicId: number, patientId: number, id: number, body: Record<string, unknown>) => posted(`${base(clinicId)}/patients/${patientId}/records/${id}/amend`, body);

export type Prescription = {
  id: number;
  patient: { id: number; name: string | null };
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
  issued_at: string;
};
export const fetchPrescriptions = (clinicId: number, params: Record<string, unknown>) => page<Prescription>(`${base(clinicId)}/prescriptions`, params);
export const issuePrescription = (clinicId: number, body: Record<string, unknown>) => posted(`${base(clinicId)}/prescriptions`, body);
/** Opens in the phone's browser, which can print or save it, through a 5-minute signed link. */
export const prescriptionPrintUrl = async (clinicId: number, id: number) => absolute((await data<{ url: string }>(`${base(clinicId)}/prescriptions/${id}/print-link`)).url);

export type CertificatePreview = {
  title: string;
  clinic: { name: string; address: string | null };
  patient: { name: string | null; description: string | null };
  statement: string;
  purpose: string;
  dentist: { name: string | null; specialization: string | null; license_number: string | null };
  issued_at: string;
};
export const previewCertificate = (clinicId: number, body: Record<string, unknown>) => posted<CertificatePreview>(`${base(clinicId)}/certificates/preview`, body);
export const issueCertificateUrl = async (clinicId: number, body: Record<string, unknown>) => absolute((await posted<{ url: string }>(`${base(clinicId)}/certificates`, body)).url);

export type ClinicFile = {
  id: number;
  name: string;
  mime_type: string;
  size: number;
  category: string | null;
  notes: string | null;
  uploaded_at: string;
  patient?: { id: number; name: string | null };
};
export const fetchClinicFiles = (clinicId: number, params: Record<string, unknown>) => page<ClinicFile>(`${base(clinicId)}/files`, params);
export const fetchPatientFileList = (clinicId: number, patientId: number) => data<ClinicFile[]>(`${base(clinicId)}/patients/${patientId}/files`);
export const fileViewUrl = async (clinicId: number, patientId: number, fileId: number) => absolute((await data<{ url: string }>(`${base(clinicId)}/patients/${patientId}/files/${fileId}/link`)).url);
export const uploadClinicalFile = (clinicId: number, patientId: number, file: PickedFile, details: { category: string; notes: string }) => {
  const body = new FormData();
  body.append('file', file as unknown as Blob);
  body.append('category', details.category);
  if (details.notes) body.append('notes', details.notes);
  return api.post(`${base(clinicId)}/patients/${patientId}/files`, body, { headers: { 'Content-Type': 'multipart/form-data' } });
};

export type FollowUp = { id: number; patient: { id: number; name: string | null }; purpose: string; due_on: string; priority: string; status: string; notes: string | null };
export type FollowUpSummary = { total: number; high_priority: number; confirmed: number };
export const fetchFollowUps = (clinicId: number, params: Record<string, unknown>) => page<FollowUp, { summary?: FollowUpSummary }>(`${base(clinicId)}/follow-ups`, params);
export const createFollowUp = (clinicId: number, body: Record<string, unknown>) => posted(`${base(clinicId)}/follow-ups`, body);
export const updateFollowUp = (clinicId: number, id: number, body: Record<string, unknown>) => put(`${base(clinicId)}/follow-ups/${id}`, body);

// Account security, for every role.
export type TwoFactorStatus = { enabled: boolean; recovery_codes_left: number };
export const fetchTwoFactorStatus = () => data<TwoFactorStatus>('/two-factor');
export const regenerateRecoveryCodes = (password: string) => posted<{ recovery_codes: string[] }>('/two-factor/recovery-codes', { password });
export type DeviceSession = { id: string; type: 'web' | 'app'; device: string; ip_address: string | null; last_active_at: string; current: boolean };
export const fetchSessions = () => data<DeviceSession[]>('/sessions');
export const revokeSession = (id: string) => api.delete(`/sessions/${encodeURIComponent(id)}`);
export const signOutOtherSessions = (password: string) => api.post('/sessions/sign-out-others', { password });
