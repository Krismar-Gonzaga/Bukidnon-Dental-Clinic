import apiClient, { getData, getPage } from './apiClient';
import { API_ORIGIN } from '../config/api';

// System administration (/admin, role system_admin) and clinic applications.

const send = async (method, url, body) => (await apiClient[method](url, body)).data;

export const getAdminDashboard = () => getData('/admin/dashboard');

export const getApplications = (params) => getPage('/admin/clinic-applications', params);
export const getApplication = (id) => getData(`/admin/clinic-applications/${id}`);
export const startApplicationReview = (id) => send('post', `/admin/clinic-applications/${id}/start-review`);
export const approveApplication = (id, notes) => send('post', `/admin/clinic-applications/${id}/approve`, { notes });
export const rejectApplication = (id, notes) => send('post', `/admin/clinic-applications/${id}/reject`, { notes });

export const getAdminClinics = (params) => getPage('/admin/clinics', params);
export const suspendClinic = (id, reason) => send('post', `/admin/clinics/${id}/suspend`, { reason });
export const reactivateClinic = (id) => send('post', `/admin/clinics/${id}/reactivate`);

export const getUsers = (params) => getPage('/admin/users', params);
export const updateUser = (id, body) => send('put', `/admin/users/${id}`, body);

export const getAuditLogs = (params) => getPage('/admin/audit-logs', params);

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
 * scope: 'admin' or 'applicant'.
 */
export async function openApplicationDocument(scope, applicationId, documentId) {
  // Open the tab during the click (popup blockers allow that), then point it
  // at the signed link once it arrives.
  const tab = window.open('', '_blank');
  if (tab) tab.opener = null;
  try {
    const prefix = scope === 'admin' ? '/admin/clinic-applications' : '/clinic-applications';
    const { url } = await getData(`${prefix}/${applicationId}/documents/${documentId}/link`);
    const href = `${API_ORIGIN}${url}`;
    if (tab) tab.location.href = href;
    else window.location.assign(href);
  } catch (error) {
    tab?.close();
    throw error;
  }
}
