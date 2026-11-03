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
export const addApplicationNote = (id, note) => send('post', `/admin/clinic-applications/${id}/notes`, { note });

export const getAdminClinics = (params) => getPage('/admin/clinics', params);
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
