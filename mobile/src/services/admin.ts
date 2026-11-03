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
  clinics: { total: number; listed: number; suspended: number; new_this_month: number };
  applications: { pending: number; under_review: number; approved: number; rejected: number };
  queue: QueueItem[];
  users: Record<string, number>;
  open_review_reports: number;
  security: { failed_logins_24h: number; blocked_logins_24h: number; failed_password_confirmations_24h: number; suspended_users: number };
  activity_by_day: { date: string; total: number }[];
  recent_activity: ActivityItem[];
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
  reviewed_at: string | null;
  history?: HistoryEntry[];
  // Admin lists (Verification): REG-00012, document status and review priority.
  reference?: string;
  document_status?: DocumentStatus;
  priority?: 'high' | 'medium' | 'standard' | null;
  clinic_status?: string | null;
};

export type DocumentStatus = 'verified' | 'under_review' | 'pending' | 'missing_info' | 'returned' | 'suspended';

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
  created_at: string | null;
  suspended_at: string | null;
};

// Labels, categories and outcomes come from the API (App\Support\AuditPresenter).
export type AuditEntry = {
  id: number;
  action: string;
  label: string;
  category: string | null;
  outcome: 'success' | 'failed' | 'blocked';
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

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: 'Pending',
  under_review: 'Reviewing',
  approved: 'Approved',
  rejected: 'Returned',
};

export const DOCUMENT_LABELS: Record<string, string> = {
  business_permit: "Mayor's / business permit",
  doh_license: 'DOH license to operate',
  prc_id: "Dentist's PRC ID",
  bir_registration: 'BIR registration',
  other: 'Other supporting document',
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  patient: 'Patient',
  clinic_admin: 'Clinic Admin',
  dentist: 'Dentist',
  staff: 'Clinic Staff',
  system_admin: 'System Admin',
};

export const DOCUMENT_STATUS: Record<DocumentStatus, { label: string; tone: 'success' | 'info' | 'neutral' | 'danger' | 'warning' }> = {
  verified: { label: 'Verified', tone: 'success' },
  under_review: { label: 'Under review', tone: 'info' },
  pending: { label: 'Pending', tone: 'neutral' },
  missing_info: { label: 'Missing info', tone: 'danger' },
  returned: { label: 'More info requested', tone: 'warning' },
  suspended: { label: 'Suspended', tone: 'danger' },
};

export const PRIORITY_LABELS = { high: 'High priority', medium: 'Medium priority', standard: 'Standard' } as const;

export const AUDIT_RANGES = [
  { id: '24h', label: 'Last 24 hours' },
  { id: '7d', label: 'Last 7 days' },
  { id: '30d', label: 'Last 30 days' },
  { id: 'all', label: 'All time' },
];

export const AUDIT_CATEGORIES = [
  { id: '', label: 'All actions' },
  { id: 'security', label: 'Security / Sign-in' },
  { id: 'verification', label: 'Clinic verification' },
  { id: 'clinics', label: 'Clinic management' },
  { id: 'accounts', label: 'Account administration' },
  { id: 'records', label: 'Patient records' },
  { id: 'appointments', label: 'Appointments' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'audit', label: 'Audit log' },
];

export const AUDIT_OUTCOMES = {
  success: { label: 'Success', tone: 'success' },
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

export const fetchAdminClinics = (params: Record<string, unknown>) => getPage<AdminClinic>('/admin/clinics', params);
export const suspendClinic = (id: number, reason: string) => api.post(`/admin/clinics/${id}/suspend`, { reason });
export const reactivateClinic = (id: number) => api.post(`/admin/clinics/${id}/reactivate`);

export const fetchUsers = (params: Record<string, unknown>) => getPage<AdminUser>('/admin/users', params);
export const updateUser = (id: number, body: { role?: UserRole; status?: string; reason?: string }) => api.put(`/admin/users/${id}`, body);

export const fetchAuditLogs = (params: Record<string, unknown>) => getPage<AuditEntry>('/admin/audit-logs', params);
export const fetchAuditSummary = (params: Record<string, unknown>) => getData<AuditSummary>('/admin/audit-logs/summary', params);
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

/** "+20% from the previous 24 hours" for the Total Events card. */
export function auditTrend(summary: AuditSummary, rangeLabel: string): string {
  const { total_events: total, previous_total: previous } = summary;
  if (previous == null) return 'All recorded events';
  if (previous === 0) return total > 0 ? `None in the previous ${rangeLabel}` : 'No events yet';
  const change = Math.round(((total - previous) / previous) * 100);
  return `${change >= 0 ? '+' : ''}${change}% from the previous ${rangeLabel}`;
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
      return `${subject}: returned to the applicant${by}.`;
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

// ---------------------------------------------------------------- Summary cards
export type MetricCardData = { label: string; value: string; note?: string; icon?: string; tone?: 'default' | 'primary' | 'danger' | 'success' };

const pad = (n?: number | null) => (n == null ? '—' : String(n).padStart(2, '0'));

/** The four cards of the design, from GET /admin/clinic-applications/summary. */
export function verificationMetrics(s: ApplicationSummary | null): MetricCardData[] {
  return [
    {
      label: 'Total pending',
      value: pad(s?.pending),
      note: s ? (s.submitted_this_week > 0 ? `+${s.submitted_this_week} submitted this week` : 'None submitted this week') : undefined,
      icon: 'trending-up-outline',
    },
    {
      label: 'In review',
      value: pad(s?.under_review),
      note: s ? (s.average_decision_hours == null ? 'No decisions in 30 days' : `Avg. decision: ${s.average_decision_hours} hrs`) : undefined,
      icon: 'hourglass-outline',
    },
    {
      label: 'Critical action',
      value: pad(s?.needs_attention),
      note: s ? `Waiting ${s.attention_days}+ days or missing documents` : undefined,
      icon: 'warning-outline',
      tone: s?.needs_attention ? ('danger' as const) : ('default' as const),
    },
    {
      label: 'Verified today',
      value: pad(s?.verified_today),
      note: s ? `${s.decisions_last_30_days} decisions in 30 days` : undefined,
      icon: 'checkmark-circle-outline',
      tone: 'success' as const,
    },
  ];
}

const RANGE_WORDS: Record<string, string> = { '24h': '24 hours', '7d': '7 days', '30d': '30 days' };

/** The four cards of the design, from GET /admin/audit-logs/summary. */
export function auditMetrics(s: AuditSummary | null, range: string): MetricCardData[] {
  const report = s?.integrity.last_report;
  return [
    { label: 'Total events', value: s ? s.total_events.toLocaleString() : '—', note: s ? auditTrend(s, RANGE_WORDS[range] ?? 'period') : undefined, icon: 'trending-up-outline', tone: 'primary' as const },
    {
      label: 'Failed logins',
      value: s ? s.failed_logins.toLocaleString() : '—',
      note: s ? `${s.blocked_logins} blocked · from ${s.failed_login_ips} ${s.failed_login_ips === 1 ? 'IP' : 'IPs'}` : undefined,
      icon: 'shield-outline',
      tone: s?.failed_logins ? ('danger' as const) : ('default' as const),
    },
    { label: 'Critical actions', value: s ? s.critical_actions.toLocaleString() : '—', note: 'Approvals, suspensions, role changes, exports', icon: 'information-circle-outline' },
    {
      label: 'Log integrity',
      value: report ? (report.status === 'verified' ? 'Verified' : 'Problems') : 'Not checked',
      note: s ? `${s.integrity.unsealed} awaiting seal` : undefined,
      icon: report?.status === 'failed' ? 'warning-outline' : 'shield-checkmark-outline',
      tone: report ? (report.status === 'verified' ? ('success' as const) : ('danger' as const)) : ('default' as const),
    },
  ];
}
