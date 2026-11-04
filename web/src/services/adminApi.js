import apiClient, { getData, getPage } from './apiClient';
import { API_ORIGIN } from '../config/api';

// System administration (/admin, role system_admin) and clinic applications.

const send = async (method, url, body) => (await apiClient[method](url, body)).data;

export const getAdminDashboard = () => getData('/admin/dashboard');
export const getSystemHealth = () => getData('/admin/system/health');

// High-impact actions answer 423 until the password is re-entered (15 minutes, this sign-in only).
export const confirmAdminPassword = (password) => send('post', '/admin/confirm-password', { password });
export const needsPasswordConfirmation = (error) =>
  error?.response?.status === 423 && error.response.data?.code === 'password_confirmation_required';

export const getApplications = (params) => getPage('/admin/clinic-applications', params);
export const getApplicationSummary = () => getData('/admin/clinic-applications/summary');
export const exportApplicationsCsv = (params) => downloadCsv('/admin/clinic-applications/export', params, 'clinic-registrations');
export const getApplication = (id) => getData(`/admin/clinic-applications/${id}`);
export const startApplicationReview = (id) => send('post', `/admin/clinic-applications/${id}/start-review`);
export const approveApplication = (id, notes) => send('post', `/admin/clinic-applications/${id}/approve`, { notes });
export const rejectApplication = (id, notes) => send('post', `/admin/clinic-applications/${id}/reject`, { notes });
export const requestApplicationDocuments = (id, notes) => send('post', `/admin/clinic-applications/${id}/request-documents`, { notes });
export const addApplicationNote = (id, note) => send('post', `/admin/clinic-applications/${id}/notes`, { note });

export const getAdminClinics = (params) => getPage('/admin/clinics', params);
export const getClinicDirectory = (params) => getPage('/admin/clinics/directory', params);
export const getAdminClinic = (id) => getData(`/admin/clinics/${id}`);
export const suspendClinic = (id, reason) => send('post', `/admin/clinics/${id}/suspend`, { reason });
export const reactivateClinic = (id) => send('post', `/admin/clinics/${id}/reactivate`);

export const getUsers = (params) => getPage('/admin/users', params);
export const updateUser = (id, body) => send('put', `/admin/users/${id}`, body);

export const getAuditLogs = (params) => getPage('/admin/audit-logs', params);
export const getAuditSummary = (params) => getData('/admin/audit-logs/summary', params);
// Seals new entries and re-checks the hash chain; resolves to the report.
export const checkAuditIntegrity = async () => (await send('post', '/admin/audit-logs/integrity')).data;
export const exportAuditCsv = (params) => downloadCsv('/admin/audit-logs/export', params, 'audit-log');

/**
 * Saves a CSV export. Exports need the signed-in session cookie, so they are
 * fetched and saved rather than linked. Error bodies arrive as Blobs: they
 * are parsed so a 423 still asks for the password and messages still show.
 */
async function downloadCsv(url, params, baseName) {
  let response;
  try {
    response = await apiClient.get(url, { params, responseType: 'blob' });
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
  const href = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = href;
  link.download = `${baseName}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export const getReports = (params) => getData('/admin/reports', params);
export const exportReportCsv = (params) => downloadCsv('/admin/reports/export', params, 'platform-report');

export const getAnnouncements = (params) => getPage('/admin/announcements', params);
export const getAnnouncement = (id) => getData(`/admin/announcements/${id}`);
export const createAnnouncement = (body) => send('post', '/admin/announcements', body);
export const updateAnnouncement = (id, body) => send('put', `/admin/announcements/${id}`, body);
export const publishAnnouncement = (id) => send('post', `/admin/announcements/${id}/publish`);
export const archiveAnnouncement = (id) => send('post', `/admin/announcements/${id}/archive`);

export const getPlatformSettings = () => getData('/admin/settings');
// High impact: asks for the password again. Resolves to the saved settings.
export const updatePlatformSettings = async (body) => (await send('put', '/admin/settings', body)).data;

export const getModerationQueue = (params) => getPage('/admin/reviews', params);
export const moderateReview = (id, status, note) => send('post', `/admin/reviews/${id}/moderate`, { status, note });

// ---- Clinic applications (the applicant's side)
export const getMyApplications = () => getData('/clinic-applications');
export const createApplication = (body) => send('post', '/clinic-applications', body);
export const updateApplication = (id, body) => send('put', `/clinic-applications/${id}`, body);
export const submitApplication = (id) => send('post', `/clinic-applications/${id}/submit`);
export const deleteApplicationDocument = (id, documentId) => send('delete', `/clinic-applications/${id}/documents/${documentId}`);

export async function uploadApplicationDocument(id, documentType, file) {
  const form = new FormData();
  form.append('document_type', documentType);
  form.append('file', file);
  return send('post', `/clinic-applications/${id}/documents`, form);
}

/**
 * Opens a private document through a short-lived signed link (5 minutes).
 * scope: 'admin' or 'applicant'. download (admin only): save the file instead of opening it.
 */
export async function openApplicationDocument(scope, applicationId, documentId, { download = false } = {}) {
  // Open the tab during the click (popup blockers allow that), then point it
  // at the signed link once it arrives.
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  try {
    const prefix = scope === 'admin' ? '/admin/clinic-applications' : '/clinic-applications';
    const { url } = await getData(`${prefix}/${applicationId}/documents/${documentId}/link`, download ? { download: 1 } : undefined);
    const href = `${API_ORIGIN}${url}`;
    if (tab) tab.location.href = href;
    else window.location.assign(href);
  } catch (error) {
    tab?.close();
    throw error;
  }
}

// Subscriptions and payment proofs
export const getAdminSubscriptions = (params) => getPage('/admin/subscriptions', params);
export const getAdminSubscription = (clinicId) => getData(`/admin/subscriptions/${clinicId}`);
export const changeSubscriptionPlan = (clinicId, plan) => send('put', `/admin/subscriptions/${clinicId}/plan`, { plan });
export const getSubscriptionPayments = (params) => getPage('/admin/subscription-payments', params);
export const verifySubscriptionPayment = (id) => apiClient.post(`/admin/subscription-payments/${id}/verify`);
export const rejectSubscriptionPayment = (id, note) => apiClient.post(`/admin/subscription-payments/${id}/reject`, { note });
// Saves the proof, through the signed-in session.
export async function downloadPaymentProof(id, baseName) {
  const { data } = await apiClient.get(`/admin/subscription-payments/${id}/proof`, { responseType: 'blob' });
  const extension = { 'application/pdf': 'pdf', 'image/png': 'png', 'image/jpeg': 'jpg' }[data.type] ?? 'bin';
  const href = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = href;
  link.download = `${baseName}.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
// Opens the proof in a new tab through the signed-in session.
export async function openPaymentProof(id) {
  const { data } = await apiClient.get(`/admin/subscription-payments/${id}/proof`, { responseType: 'blob' });
  const href = window.URL.createObjectURL(data);
  window.open(href, '_blank', 'noopener');
  window.setTimeout(() => window.URL.revokeObjectURL(href), 60 * 1000);
}
