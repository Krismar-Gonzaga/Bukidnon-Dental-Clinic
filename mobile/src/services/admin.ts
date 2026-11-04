// System administration (/admin, role system_admin), as on the web admin
// portal (web/src/services/adminApi.js). The server checks the role on every
// call; high-impact actions also need the password re-entered (423 until
// POST /admin/confirm-password succeeds, for 15 minutes on this sign-in).
import api from './http';
import { API_BASE_URL } from './config';
import { Page } from './clinicPortal';

export type HealthCheck = { key: string; label: string; status: 'ok' | 'warn' | 'fail'; detail: string };
export type SystemHealth = { status: 'healthy' | 'degraded' | 'down'; environment: string; checked_at: string; checks: HealthCheck[] };

export type QueueItem = {
  id: number;
  clinic_name: string;
  city: string | null;
  province: string | null;
  status: ApplicationStatus;
  submitted_at: string | null;
};

export type ActivityItem = {
  id: number;
  action: string;
  actor: string | null;
  subject_type: string | null;
  subject_id: number | null;
  subject_label: string | null;
  created_at: string;
};

export type AdminDashboard = {
  clinics: { total: number; listed: number; verified: number; suspended: number; new_this_month: number };
  applications: { pending: number; under_review: number; approved: number; rejected: number };
  queue: QueueItem[];
  users: Record<string, number>;
  open_review_reports: number;
  security: { failed_logins_24h: number; blocked_logins_24h: number; failed_password_confirmations_24h: number; suspended_users: number };
  activity_by_day: { date: string; total: number }[];
  recent_activity: ActivityItem[];
  total_appointments: number;
  active_subscriptions: number;
  active_announcements: number;
  pending_payments: { total: number; items: { id: number; clinic_id: number; clinic_name: string | null; submitted_at: string }[] };
  platform_growth: { month: string; label: string; total: number }[];
  recent_audit: { id: number; label: string; module: string | null; outcome: string; user_name: string | null; subject_label: string | null; created_at: string }[];
};

export type ApplicationStatus = 'pending' | 'under_review' | 'approved' | 'rejected';

export type HistoryEntry = { id: number; action: string; actor: string | null; note: string | null; document_type: string | null; at: string };

export type ClinicApplication = QueueItem & {
  description: string | null;
  address: string | null;
  contact_number: string | null;
  email: string | null;
  representative_name: string | null;
  representative_position: string | null;
  review_notes: string | null;
  clinic_id: number | null;
  applicant?: { id: number; name: string; email: string } | null;
  documents: { id: number; document_type: string; original_name: string; mime_type: string; size: number | null; uploaded_at: string }[];
  missing_documents: string[];
  documents_requested?: boolean;
  documents_required?: number;
  documents_submitted?: number;
  reviewed_at: string | null;
  history?: HistoryEntry[];
  // Admin lists (Verification): REG-00012, document status and review priority.
  reference?: string;
  document_status?: DocumentStatus;
  priority?: 'high' | 'medium' | 'standard' | null;
  clinic_status?: string | null;
};

export type DocumentStatus = 'verified' | 'under_review' | 'pending' | 'missing_info' | 'returned' | 'documents_requested' | 'suspended';

export type ApplicationSummary = {
  pending: number;
  under_review: number;
  submitted_this_week: number;
  submitted_last_week: number;
  missing_info: number;
  overdue: number;
  needs_attention: number;
  returned: number;
  verified_today: number;
  returned_today: number;
  average_decision_hours: number | null;
  decisions_last_30_days: number;
  oldest_open_id: number | null;
  attention_days: number;
  required_documents: string[];
};

export type IntegrityReport = {
  status: 'verified' | 'failed';
  checked: number;
  sealed_through_id: number | null;
  pending: number;
  problems: { id: number; type: string; message: string }[];
  checked_at: string;
};

export type AuditSummary = {
  total_events: number;
  previous_total: number | null;
  failed_logins: number;
  blocked_logins: number;
  failed_login_ips: number;
  critical_actions: number;
  integrity: { last_report: IntegrityReport | null; unsealed: number };
};

export type AdminClinic = {
  id: number;
  name: string;
  city?: string | null;
  status: 'pending' | 'approved' | 'suspended';
  is_published: boolean;
  members_count: number;
  branches_count: number;
  suspension_reason: string | null;
};

export type UserRole = 'patient' | 'clinic_admin' | 'dentist' | 'staff' | 'system_admin';
export type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'suspended';
  clinic_memberships: number;
  clinic_name: string | null;
  created_at: string | null;
  suspended_at: string | null;
};

// Labels, categories and outcomes come from the API (App\Support\AuditPresenter).
export type AuditEntry = {
  id: number;
  action: string;
  label: string;
  category: string | null;
  module: string | null;
  outcome: 'success' | 'pending' | 'failed' | 'blocked';
  user_id: number | null;
  user_name: string | null;
  user_role: UserRole | null;
  clinic_id: number | null;
  subject_type: string | null;
  subject_id: number | null;
  subject_label: string | null;
  detail: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  sealed: boolean;
  created_at: string;
};

export type ModerationReview = {
  id: number;
  rating: number;
  comment: string | null;
  status: string;
  clinic_name: string;
  patient_name: string;
  date: string;
  open_reports: number;
  reports?: { id: number; reason: string }[];
  moderation_note?: string | null;
};

export type DirectoryRow = {
  kind: 'clinic' | 'application';
  id: number;
  name: string;
  city: string | null;
  status: string;
  admin: string | null;
  plan: string | null;
  application_id: number | null;
  missing_documents?: number;
};

export type AdminClinicDetail = {
  id: number;
  name: string;
  city: string | null;
  status: string;
  admin: string | null;
  plan: string;
  since: string | null;
  renews_at: string | null;
  subscription_status: string;
  application_id: number | null;
  suspension_reason: string | null;
  activity: { id: number; label: string; at: string }[];
};

export type SubscriptionRow = {
  clinic_id: number;
  clinic_name: string;
  plan_key: string;
  plan: string;
  amount: number;
  due_at: string | null;
  status: string;
  payment_status: string | null;
  payment_id: number | null;
};

export type SubscriptionDetail = SubscriptionRow & {
  payment: {
    id: number;
    status: string;
    amount: number;
    method: string;
    reference: string | null;
    submitted_by: string | null;
    submitted_at: string;
    review_note: string | null;
    invoice_number: string | null;
  } | null;
  history: { id: number; status: string; amount: number; method: string; submitted_at: string; invoice_number: string | null }[];
  plans: { key: string; name: string; price: number }[];
};

export type ReportRow = { metric: string; current: number; previous: number; change: number };
export type PlatformReports = {
  month: string;
  month_label: string;
  previous_label: string;
  overview: { clinic_growth: { month: string; label: string; total: number }[]; plans: { key: string; name: string; total: number }[] };
  clinics: ReportRow[];
  users: ReportRow[];
  subscriptions: ReportRow[];
};

export type Announcement = {
  id: number;
  title: string;
  content: string;
  audience: string;
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  created_at: string;
};

export type PlatformSettings = {
  platform_name: string;
  support_email: string;
  maintenance_mode: boolean;
  allow_self_registration: boolean;
  session_timeout_minutes: number;
  require_verification: boolean;
  required_documents: string[];
  payment_grace_days: number;
  document_types: string[];
  plans: { key: string; name: string; price: number; limits: string | null }[];
};

type Tone = 'success' | 'info' | 'neutral' | 'danger' | 'warning';

export const CLINIC_STATUS: Record<string, { label: string; tone: Tone }> = {
  approved: { label: 'Verified', tone: 'success' },
  suspended: { label: 'Suspended', tone: 'danger' },
  pending: { label: 'Pending', tone: 'warning' },
  under_review: { label: 'Under-Review', tone: 'warning' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

export const CLINIC_STATUS_FILTERS = [
  { id: '', label: 'All' },
  { id: 'approved', label: 'Verified' },
  { id: 'pending', label: 'Pending' },
  { id: 'under_review', label: 'Under-Review' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'suspended', label: 'Suspended' },
];

export const SUBSCRIPTION_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'success' },
  pending_payment: { label: 'Pending-Payment', tone: 'warning' },
  grace: { label: 'In Grace Period', tone: 'warning' },
  expired: { label: 'Expired', tone: 'danger' },
  none: { label: 'No Payment Yet', tone: 'neutral' },
};

export const PAYMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: 'Submitted', tone: 'warning' },
  verified: { label: 'Verified', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
};
export const NO_PAYMENT = { label: 'None', tone: 'neutral' as Tone };

export const ANNOUNCEMENT_AUDIENCES = [
  { id: 'all', label: 'All Users' },
  { id: 'patients', label: 'Patients' },
  { id: 'dentists', label: 'Dentists' },
  { id: 'staff', label: 'Clinic Staff' },
  { id: 'clinic_admins', label: 'Clinic Admins' },
];

export const ANNOUNCEMENT_STATUS: Record<string, { label: string; tone: Tone }> = {
  published: { label: 'Published', tone: 'success' },
  draft: { label: 'Draft', tone: 'warning' },
  archived: { label: 'Archived', tone: 'neutral' },
};

export const formatMonthly = (amount: number) => `₱${Number(amount ?? 0).toLocaleString('en-PH')}/mo`;

const MONTH_YEAR = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric', timeZone: 'Asia/Manila' });
export const formatMonthYear = (iso?: string | null) => (iso ? MONTH_YEAR.format(new Date(iso)) : '—');

/** "2026-11" moved by whole months. */
export function shiftMonth(month: string, by: number): string {
  const [year, number] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, number - 1 + by, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

export const DOCUMENT_LABELS: Record<string, string> = {
  business_permit: 'Business Permit',
  doh_license: 'DOH License to Operate',
  prc_id: 'PRC License',
  bir_registration: 'BIR Registration',
  other: 'Other Supporting Document',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  patient: 'Patient',
  clinic_admin: 'Clinic Admin',
  dentist: 'Dentist',
  staff: 'Clinic Staff',
  system_admin: 'System Admin',
};

export const AUDIT_CATEGORIES = [
  { id: '', label: 'All' },
  { id: 'security', label: 'Security / Sign-in' },
  { id: 'verification', label: 'Clinic Verification' },
  { id: 'clinics', label: 'Clinic Management' },
  { id: 'accounts', label: 'User Management' },
  { id: 'subscription', label: 'Subscriptions' },
  { id: 'notifications', label: 'System Notifications' },
  { id: 'settings', label: 'System Settings' },
  { id: 'records', label: 'Patient Records' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'audit', label: 'Audit Log' },
];

export const AUDIT_OUTCOMES = {
  success: { label: 'Success', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  failed: { label: 'Failed', tone: 'danger' },
  blocked: { label: 'Blocked', tone: 'danger' },
} as const;

/** Rows a phone export shares: Android refuses share text much over 1 MB. */
export const MOBILE_EXPORT_ROWS = 1000;

const getData = async <T,>(url: string, params?: Record<string, unknown>): Promise<T> => (await api.get(url, { params })).data?.data;
const getPage = async <T,>(url: string, params?: Record<string, unknown>): Promise<Page<T>> => {
  const response = await api.get(url, { params });
  return { items: response.data?.data ?? [], meta: response.data?.meta ?? { current_page: 1, last_page: 1, total: 0 } };
};

export const fetchAdminDashboard = () => getData<AdminDashboard>('/admin/dashboard');
export const fetchSystemHealth = () => getData<SystemHealth>('/admin/system/health');

export const confirmAdminPassword = (password: string) => api.post('/admin/confirm-password', { password });
export const needsPasswordConfirmation = (error: any) =>
  error?.response?.status === 423 && error.response.data?.code === 'password_confirmation_required';

export const fetchApplications = (params: Record<string, unknown>) => getPage<ClinicApplication>('/admin/clinic-applications', params);
export const fetchApplicationSummary = () => getData<ApplicationSummary>('/admin/clinic-applications/summary');
export const exportApplicationsCsv = (params: Record<string, unknown>) => fetchCsv('/admin/clinic-applications/export', params);
export const fetchApplication = (id: number) => getData<ClinicApplication>(`/admin/clinic-applications/${id}`);
export const startReview = (id: number) => api.post(`/admin/clinic-applications/${id}/start-review`);
export const approveApplication = (id: number, notes?: string) => api.post(`/admin/clinic-applications/${id}/approve`, { notes });
export const returnApplication = (id: number, notes: string) => api.post(`/admin/clinic-applications/${id}/reject`, { notes });
export const requestDocuments = (id: number, notes: string) => api.post(`/admin/clinic-applications/${id}/request-documents`, { notes });
export const addApplicationNote = async (id: number, note: string): Promise<HistoryEntry[]> =>
  (await api.post(`/admin/clinic-applications/${id}/notes`, { note })).data?.data ?? [];

/** Full URL of a 5-minute signed document link; every request is audit-logged. */
export const documentUrl = async (applicationId: number, documentId: number, download = false) => {
  const { url } = await getData<{ url: string }>(
    `/admin/clinic-applications/${applicationId}/documents/${documentId}/link`,
    download ? { download: 1 } : undefined,
  );
  return `${API_BASE_URL.replace(/\/api\/?$/, '')}${url}`;
};

export const fetchClinicDirectory = (params: Record<string, unknown>) => getPage<DirectoryRow>('/admin/clinics/directory', params);
export const fetchAdminClinic = (id: number) => getData<AdminClinicDetail>(`/admin/clinics/${id}`);
export const suspendClinic = (id: number, reason: string) => api.post(`/admin/clinics/${id}/suspend`, { reason });
export const reactivateClinic = (id: number) => api.post(`/admin/clinics/${id}/reactivate`);

export const fetchUsers = (params: Record<string, unknown>) => getPage<AdminUser>('/admin/users', params);
export const updateUser = (id: number, body: { role?: UserRole; status?: string; reason?: string }) => api.put(`/admin/users/${id}`, body);

export const fetchSubscriptions = (params: Record<string, unknown>) => getPage<SubscriptionRow>('/admin/subscriptions', params);
export const fetchSubscription = (clinicId: number) => getData<SubscriptionDetail>(`/admin/subscriptions/${clinicId}`);
export const changePlan = (clinicId: number, plan: string) => api.put(`/admin/subscriptions/${clinicId}/plan`, { plan });
export const verifyPayment = (id: number) => api.post(`/admin/subscription-payments/${id}/verify`);
export const rejectPayment = (id: number, note: string) => api.post(`/admin/subscription-payments/${id}/reject`, { note });
/** Full URL of a 5-minute signed link to a payment proof. */
export const proofUrl = async (paymentId: number) => {
  const { url } = await getData<{ url: string }>(`/admin/subscription-payments/${paymentId}/proof-link`);
  return `${API_BASE_URL.replace(/\/api\/?$/, '')}${url}`;
};

export const fetchReports = (month?: string) => getData<PlatformReports>('/admin/reports', { month });
export const exportReportCsv = (params: Record<string, unknown>) => fetchCsv('/admin/reports/export', params);

export const fetchAnnouncements = (params: Record<string, unknown>) => getPage<Announcement>('/admin/announcements', params);
export const fetchAnnouncement = (id: number) => getData<Announcement>(`/admin/announcements/${id}`);
export const saveAnnouncement = (id: number | null, body: { title: string; content: string; audience: string; publish: boolean }) =>
  id ? api.put(`/admin/announcements/${id}`, body) : api.post('/admin/announcements', body);
export const publishAnnouncement = (id: number) => api.post(`/admin/announcements/${id}/publish`);
export const archiveAnnouncement = (id: number) => api.post(`/admin/announcements/${id}/archive`);

export const fetchPlatformSettings = () => getData<PlatformSettings>('/admin/settings');
export const savePlatformSettings = async (body: Partial<PlatformSettings>): Promise<PlatformSettings> => (await api.put('/admin/settings', body)).data?.data;

export const fetchAuditLogs = (params: Record<string, unknown>) => getPage<AuditEntry>('/admin/audit-logs', params);
/** Seals new entries and re-checks the whole hash chain. */
export const checkAuditIntegrity = async (): Promise<IntegrityReport> => (await api.post('/admin/audit-logs/integrity')).data?.data;
export const exportAuditCsv = (params: Record<string, unknown>) => fetchCsv('/admin/audit-logs/export', params);

/**
 * CSV export as text, for the share sheet (newest MOBILE_EXPORT_ROWS rows).
 * Needs the password re-entered (423). Error bodies arrive as text: parse
 * them so needsPasswordConfirmation and the server message still work.
 */
async function fetchCsv(url: string, params: Record<string, unknown>): Promise<string> {
  try {
    // Keep the JSON Accept header: errors (423, 422) must come back as JSON.
    const response = await api.get(url, { params: { ...params, limit: MOBILE_EXPORT_ROWS }, responseType: 'text' });
    return String(response.data ?? '').replace(/^﻿/, '');
  } catch (error: any) {
    if (typeof error?.response?.data === 'string') {
      try {
        error.response.data = JSON.parse(error.response.data);
      } catch {
        // Not JSON: keep the original error.
      }
    }
    throw error;
  }
}

export const fetchModerationQueue = (params: Record<string, unknown>) => getPage<ModerationReview>('/admin/reviews', params);
export const moderateReview = (id: number, status: 'approved' | 'rejected', note: string) =>
  api.post(`/admin/reviews/${id}/moderate`, { status, note });

/** Plain-language summary of an account change, confirmed before saving. */
export function describeUserChange(user: AdminUser, form: { role: UserRole; status: string }) {
  const changes: string[] = [];
  if (form.role !== user.role) {
    changes.push(`Change account type from ${USER_ROLE_LABELS[user.role] ?? user.role} to ${USER_ROLE_LABELS[form.role] ?? form.role}.`);
    if (form.role === 'system_admin') changes.push('They will be able to approve clinics, suspend accounts and read the audit log.');
  }
  if (form.status !== user.status) {
    changes.push(form.status === 'suspended' ? 'Suspend the account and sign them out on every device.' : 'Reactivate the account so they can sign in again.');
  }
  return changes;
}

/** Feed sentence for a dashboard activity entry. */
export function activityText(item: ActivityItem) {
  const by = item.actor ? ` by ${item.actor}` : '';
  const subject = item.subject_label ?? 'A clinic';
  switch (item.action) {
    case 'clinic_application.submitted':
      return `${subject} submitted a clinic registration.`;
    case 'clinic_application.document_uploaded':
      return `${subject} uploaded verification documents.`;
    case 'clinic_application.review_started':
      return `${subject}: review started${by}.`;
    case 'clinic_application.approved':
      return `${subject}: verification approved${by}.`;
    case 'clinic_application.rejected':
      return `${subject}: rejected${by}.`;
    case 'clinic_application.documents_requested':
      return `${subject}: more documents requested${by}.`;
    case 'clinic.suspended':
      return `${subject} suspended${by}.`;
    case 'clinic.reactivated':
      return `${subject} reactivated${by}.`;
    case 'admin.user_updated':
      return `${item.subject_label ?? 'An account'}: account updated${by}.`;
    case 'review.moderated':
      return `A review was moderated${by}.`;
    default:
      return item.action;
  }
}
