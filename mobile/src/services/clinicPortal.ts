// Clinic portal calls (/manage/clinics/{clinicId}/...). Online only: these
// figures change constantly and are not kept in the offline copy. The server
// checks the member's permissions on every request.
import api, { isNetworkError } from './http';
import { formatClockTime } from './booking';

export type Membership = {
  clinic_id: number;
  clinic_name: string;
  role: 'clinic_admin' | 'dentist' | 'staff' | 'inventory_staff';
  permissions: string[];
};

export type BranchOverview = {
  id: number;
  name: string;
  address: string;
  city: string;
  is_main: boolean;
  latitude?: number | null;
  longitude?: number | null;
  appointments_today: number;
  appointments_this_month: number;
  patients_this_month: number;
  revenue_this_month: number;
  revenue_today?: number;
  hours_today: { opens_at: string; closes_at: string } | null;
  open_now: boolean;
};

export type ClinicAlert = {
  type: 'inventory' | 'appointments' | 'reviews';
  severity: 'danger' | 'warning' | 'info';
  title: string;
  message: string;
  /** Inventory alerts: the item to open. */
  item_id?: number;
  /** Appointment alerts: the status to filter by. */
  status?: string;
};

export type TodayAppointment = {
  id: number;
  status: string;
  appointment_time: string | null;
  patient?: { name?: string } | null;
  service?: { name?: string } | null;
  dentist?: { name?: string } | null;
};

export type ClinicDashboard = {
  appointments?: {
    today: TodayAppointment[];
    pending_requests: number;
    upcoming: number;
    completed_this_month: number;
    cancelled_this_month: number;
    same_day_last_week?: number;
  };
  /** Dentists only: patients whose first visit with them falls in the period. */
  my_patients?: { total: number; new_this_month: number; new_today: number };
  active_patients?: number;
  inventory?: { low_stock: number; near_expiry: number; expired: number };
  overview?: {
    appointments: { this_month: number; last_month: number };
    revenue_estimate: { this_month: number; last_month: number };
    staff: { active: number; dentists: number };
    branches: BranchOverview[];
    treatments: { service: string; total: number }[];
  };
  alerts: ClinicAlert[];
};

export type StaffMember = {
  id: number;
  user_id: number;
  name: string;
  email: string;
  role: Membership['role'];
  status: 'active' | 'invited' | 'suspended';
  branches: string[] | null;
  on_leave_today: boolean;
};

export const CLINIC_ROLE_LABELS: Record<Membership['role'], string> = {
  clinic_admin: 'Clinic Administrator',
  dentist: 'Dentist',
  staff: 'Receptionist / Staff',
  inventory_staff: 'Inventory Staff',
};

const base = (clinicId: number) => `/manage/clinics/${clinicId}`;

export const can = (membership: Membership | undefined, ...anyOf: string[]) =>
  Boolean(membership?.permissions?.some((p) => anyOf.includes(p)));

export const fetchClinicDashboard = async (clinicId: number): Promise<ClinicDashboard> => {
  const response = await api.get(`${base(clinicId)}/dashboard`);
  return { alerts: [], ...(response.data?.data ?? {}) };
};

export const fetchStaff = async (clinicId: number): Promise<StaffMember[]> => {
  const response = await api.get(`${base(clinicId)}/members`);
  return response.data?.data ?? [];
};

export const inviteStaff = async (clinicId: number, body: { name: string; email: string; role: string }) => {
  const response = await api.post(`${base(clinicId)}/members`, body);
  return response.data?.message as string | undefined;
};

export const updateStaff = (clinicId: number, membershipId: number, body: { role?: string; status?: string }) =>
  api.put(`${base(clinicId)}/members/${membershipId}`, body);

/** ₱12,345 without relying on Intl currency support in the JS engine. */
export const formatPeso = (amount: number) => {
  const whole = Math.round(amount ?? 0);
  return `₱${String(Math.abs(whole)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`.replace('₱', whole < 0 ? '-₱' : '₱');
};

export const formatCount = (n: number) => String(n ?? 0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** "+12.5% from last month", or a plain note when there is nothing to compare. */
export const monthChange = (current: number, previous: number) => {
  if (!previous) return { text: current ? 'New activity this month' : 'No activity yet this month', direction: 'flat' as const };
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  if (pct === 0) return { text: 'Same as last month', direction: 'flat' as const };
  return { text: `${pct > 0 ? '+' : ''}${pct}% from last month`, direction: pct > 0 ? ('up' as const) : ('down' as const) };
};

export type PatientHit = { id: number; name: string; phone?: string | null; email?: string | null; has_portal_account?: boolean };
export type BranchHit = { id: number; name: string; address: string; city: string; is_main?: boolean; is_active?: boolean; latitude?: number | null; longitude?: number | null };

/** Clinic patients matching a name, phone or email (patients.view). */
export const searchPatients = async (clinicId: number, search: string): Promise<PatientHit[]> => {
  const response = await api.get(`${base(clinicId)}/patients`, { params: { search, per_page: 5 } });
  return response.data?.data ?? [];
};

export const fetchBranches = async (clinicId: number): Promise<BranchHit[]> => {
  const response = await api.get(`${base(clinicId)}/branches`);
  return response.data?.data ?? [];
};

/** Server validation message, or a friendly offline note. */
export const serverMessage = (err: any, fallback: string) => {
  if (isNetworkError(err)) return "You're offline. Try again when you're connected.";
  const data = err?.response?.data;
  const firstFieldError = data?.errors ? (Object.values(data.errors)[0] as string[] | undefined)?.[0] : undefined;
  return firstFieldError ?? data?.message ?? fallback;
};

export type Page<T> = { items: T[]; meta: { current_page: number; last_page: number; total: number } };

const getData = async <T,>(url: string, params?: Record<string, unknown>): Promise<T> => (await api.get(url, { params })).data?.data;
const getPage = async <T,>(url: string, params?: Record<string, unknown>): Promise<Page<T>> => {
  const response = await api.get(url, { params });
  return { items: response.data?.data ?? [], meta: response.data?.meta ?? { current_page: 1, last_page: 1, total: 0 } };
};

// ---------------------------------------------------------------- Clinic profile and reports
export type ClinicProfile = {
  id: number;
  name: string;
  description: string | null;
  address: string;
  city: string;
  province: string;
  contact_number: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  status: string;
  is_published: boolean;
  specializations?: Option[];
};

export type AppointmentReport = {
  from: string;
  to: string;
  by_status: Record<string, number>;
  by_service: { service: string; total: number }[];
  by_dentist: { dentist: string; total: number }[];
  new_patients: number;
  reviews: { count: number; average: number };
};

export const fetchClinicProfile = (clinicId: number) => getData<ClinicProfile>(base(clinicId));
export const updateClinicProfile = (clinicId: number, body: Record<string, unknown>) => api.put(base(clinicId), body);
export const setClinicPublished = (clinicId: number, isPublished: boolean) => api.put(`${base(clinicId)}/publish`, { is_published: isPublished });
/** Without dates the server reports the current month. */
export const fetchAppointmentReport = (clinicId: number, from?: string, to?: string) =>
  getData<AppointmentReport>(`${base(clinicId)}/reports/appointments`, from && to ? { from, to } : undefined);

// ---------------------------------------------------------------- Appointments
export type ClinicAppointment = {
  id: number;
  status: string;
  starts_at: string | null;
  ends_at?: string | null;
  appointment_date?: string | null;
  appointment_time?: string | null;
  requested_starts_at?: string | null;
  reason?: string | null;
  notes?: string | null;
  cancellation_reason?: string | null;
  patient?: { id: number; name: string; email?: string | null; phone?: string | null } | null;
  service?: { id: number; name: string; price?: number | null; duration_minutes?: number | null } | null;
  dentist?: { id: number; name: string } | null;
  branch?: { id: number; name: string; address?: string | null } | null;
  status_history?: { from: string | null; to: string; reason?: string | null; at: string }[];
};

export const CLINIC_APPOINTMENT_STATUSES = [
  { id: 'pending', label: 'Pending' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'reschedule_requested', label: 'Reschedule requested' },
  { id: 'checked_in', label: 'Checked in' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'no_show', label: 'No-show' },
];

export const statusLabel = (status: string) => CLINIC_APPOINTMENT_STATUSES.find((s) => s.id === status)?.label ?? status;

export type AppointmentAction = {
  action: string;
  label: string;
  needs: string[];
  primary?: boolean;
  reason?: boolean;
  slot?: boolean;
  danger?: boolean;
};

/** Next steps by status, as on the web portal. The server enforces the same rules. */
export const APPOINTMENT_ACTIONS: Record<string, AppointmentAction[]> = {
  pending: [
    { action: 'confirm', label: 'Confirm', needs: ['appointments.manage'], primary: true },
    { action: 'reschedule', label: 'Propose another time', needs: ['appointments.manage'], slot: true },
    { action: 'reject', label: 'Decline', needs: ['appointments.manage'], reason: true, danger: true },
  ],
  confirmed: [
    { action: 'check-in', label: 'Check in', needs: ['appointments.manage'], primary: true },
    { action: 'reschedule', label: 'Reschedule', needs: ['appointments.manage'], slot: true },
    { action: 'no-show', label: 'Mark no-show', needs: ['appointments.manage', 'appointments.progress'] },
    { action: 'cancel', label: 'Cancel', needs: ['appointments.manage'], reason: true, danger: true },
  ],
  reschedule_requested: [
    { action: 'approve-reschedule', label: 'Approve requested time', needs: ['appointments.manage'], primary: true },
    { action: 'confirm', label: 'Keep original time', needs: ['appointments.manage'] },
    { action: 'cancel', label: 'Cancel', needs: ['appointments.manage'], reason: true, danger: true },
  ],
  checked_in: [
    { action: 'start', label: 'Start visit', needs: ['appointments.manage', 'appointments.progress'], primary: true },
    { action: 'no-show', label: 'Mark no-show', needs: ['appointments.manage', 'appointments.progress'] },
  ],
  in_progress: [{ action: 'complete', label: 'Complete visit', needs: ['appointments.manage', 'appointments.progress'], primary: true }],
};

export const actionsFor = (membership: Membership | undefined, status: string) =>
  (APPOINTMENT_ACTIONS[status] ?? []).filter((a) => can(membership, ...a.needs));

export const fetchAppointments = (clinicId: number, params: Record<string, unknown>) =>
  getPage<ClinicAppointment>(`${base(clinicId)}/appointments`, params);
/** Every appointment in a date range (calendar), following pages up to 500. */
export const fetchAppointmentsInRange = async (clinicId: number, from: string, to: string) => {
  const all: ClinicAppointment[] = [];
  for (let page = 1; page <= 5; page += 1) {
    const { items, meta } = await fetchAppointments(clinicId, { from, to, page, per_page: 100 });
    all.push(...items);
    if (page >= (meta.last_page ?? 1)) return { appointments: all, complete: true };
  }
  return { appointments: all, complete: false };
};
export const fetchAppointment = (clinicId: number, id: number) => getData<ClinicAppointment>(`${base(clinicId)}/appointments/${id}`);
export const runAppointmentAction = (clinicId: number, id: number, action: string, body?: Record<string, unknown>) =>
  api.post(`${base(clinicId)}/appointments/${id}/${action}`, body ?? {});
export const bookForPatient = (clinicId: number, body: Record<string, unknown>) => api.post(`${base(clinicId)}/appointments`, body);

// ---------------------------------------------------------------- Patients and records
export type ClinicPatient = {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  birth_date: string | null;
  gender: 'male' | 'female' | 'other' | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  has_portal_account: boolean;
};

export type MedicalHistoryEntry = {
  id: number;
  allergies: string | null;
  medications: string | null;
  conditions: string | null;
  notes: string | null;
  recorded_by: string | null;
  recorded_at: string | null;
};

export type PatientRecord = {
  id: number;
  record_type: 'examination' | 'treatment' | 'consultation';
  chief_complaint: string | null;
  findings: string | null;
  procedures: string | null;
  tooth_numbers: string | null;
  notes: string | null;
  care_instructions: string | null;
  is_patient_visible: boolean;
  dentist: string | null;
  author: string | null;
  amends_record_id: number | null;
  amendment_reason: string | null;
  superseded_at: string | null;
  created_at: string | null;
};

export const fetchPatients = (clinicId: number, params: Record<string, unknown>) => getPage<ClinicPatient>(`${base(clinicId)}/patients`, params);
export const registerPatient = async (clinicId: number, body: Record<string, unknown>): Promise<ClinicPatient> =>
  (await api.post(`${base(clinicId)}/patients`, body)).data?.data;
export const fetchPatient = (clinicId: number, id: number) => getData<ClinicPatient>(`${base(clinicId)}/patients/${id}`);
export const updatePatient = (clinicId: number, id: number, body: Record<string, unknown>) => api.put(`${base(clinicId)}/patients/${id}`, body);
export const fetchMedicalHistory = (clinicId: number, id: number) =>
  getData<{ current: MedicalHistoryEntry | null; history: MedicalHistoryEntry[] }>(`${base(clinicId)}/patients/${id}/medical-history`);
export const addMedicalHistory = (clinicId: number, id: number, body: Record<string, unknown>) =>
  api.post(`${base(clinicId)}/patients/${id}/medical-history`, body);
export const fetchRecords = (clinicId: number, id: number, includeSuperseded = false) =>
  getData<PatientRecord[]>(`${base(clinicId)}/patients/${id}/records`, includeSuperseded ? { include_superseded: 1 } : undefined);
/** A record in the clinic-wide list (dentists: their patients only). Reads are audit-logged. */
export type ClinicRecordRow = PatientRecord & { patient_id: number; patient?: { id: number; name: string | null } | null };
export const fetchClinicRecords = (clinicId: number, params: Record<string, unknown>) => getPage<ClinicRecordRow>(`${base(clinicId)}/records`, params);

export const RECORD_TYPES = [
  { id: 'examination', label: 'Examination' },
  { id: 'treatment', label: 'Treatment' },
  { id: 'consultation', label: 'Consultation' },
] as const;
export const recordTypeLabel = (type: string) => RECORD_TYPES.find((t) => t.id === type)?.label ?? type;

export const createRecord = (clinicId: number, id: number, body: Record<string, unknown>) => api.post(`${base(clinicId)}/patients/${id}/records`, body);
export const amendRecord = (clinicId: number, patientId: number, recordId: number, body: Record<string, unknown>) =>
  api.post(`${base(clinicId)}/patients/${patientId}/records/${recordId}/amend`, body);

// ---------------------------------------------------------------- Inventory
export type InventoryBatch = {
  id: number;
  batch_number: string | null;
  expires_on: string | null;
  quantity_on_hand: number;
  supplier: string | null;
  is_expired: boolean;
  is_near_expiry: boolean;
};

export type InventoryMovement = {
  id: number;
  type: 'receipt' | 'usage' | 'adjustment' | 'disposal';
  quantity: number;
  balance_after: number;
  batch_id: number | null;
  reason: string | null;
  performed_by: string | null;
  at: string | null;
};

export type InventoryItem = {
  id: number;
  name: string;
  description: string | null;
  unit: string;
  category: string | null;
  category_id: number | null;
  minimum_stock: number;
  is_active: boolean;
  quantity_usable: number;
  quantity_expired: number;
  is_low_stock: boolean;
  batches?: InventoryBatch[];
  movements?: InventoryMovement[];
};

export type Option = { id: number; name: string };
export type Supplier = Option & { contact_person: string | null; phone: string | null; email: string | null };

export const fetchInventoryItems = (clinicId: number, params: Record<string, unknown>) =>
  getData<InventoryItem[]>(`${base(clinicId)}/inventory/items`, params);
export const fetchInventoryItem = (clinicId: number, id: number) => getData<InventoryItem>(`${base(clinicId)}/inventory/items/${id}`);
export const createInventoryItem = async (clinicId: number, body: Record<string, unknown>): Promise<InventoryItem> =>
  (await api.post(`${base(clinicId)}/inventory/items`, body)).data?.data;
export const updateInventoryItem = (clinicId: number, id: number, body: Record<string, unknown>) =>
  api.put(`${base(clinicId)}/inventory/items/${id}`, body);
export const recordMovement = (clinicId: number, id: number, body: Record<string, unknown>) =>
  api.post(`${base(clinicId)}/inventory/items/${id}/movements`, body);
export type InventoryAlertRow = {
  item_id: number;
  batch_id?: number;
  name: string;
  unit: string;
  quantity: number;
  minimum_stock?: number;
  batch_number?: string | null;
  expires_on?: string | null;
};
export type InventoryAlerts = { low_stock: InventoryAlertRow[]; near_expiry: InventoryAlertRow[]; expired: InventoryAlertRow[] };

export const fetchInventoryAlerts = (clinicId: number) => getData<InventoryAlerts>(`${base(clinicId)}/inventory/alerts`);
export const fetchInventoryCategories =(clinicId: number) => getData<Option[]>(`${base(clinicId)}/inventory/categories`);
export const createInventoryCategory = async (clinicId: number, name: string): Promise<Option> =>
  (await api.post(`${base(clinicId)}/inventory/categories`, { name })).data?.data;
export const fetchSuppliers = (clinicId: number) => getData<Supplier[]>(`${base(clinicId)}/inventory/suppliers`);
export const createSupplier = (clinicId: number, body: Record<string, unknown>) => api.post(`${base(clinicId)}/inventory/suppliers`, body);

// ---------------------------------------------------------------- Services, dentists, branches, schedules
export type ServiceRate = {
  id: number;
  service_id: number;
  category?: string | null;
  name: string;
  description: string | null;
  price: number;
  duration_minutes: number;
  is_available: boolean;
};

export type DentistSchedule = { branch_id: number; day_of_week: number; starts_at: string; ends_at: string };

export type ClinicDentist = {
  id: number;
  user_id?: number;
  name: string;
  email?: string;
  specialization: string | null;
  specialization_id: number | null;
  license_number: string | null;
  years_experience: number | null;
  qualifications: string | null;
  bio: string | null;
  is_active: boolean;
  schedules?: DentistSchedule[];
};

export type OperatingHour = { day_of_week: number; opens_at: string; closes_at: string };

export type ClinicBranch = BranchHit & {
  province?: string | null;
  contact_number?: string | null;
  operating_hours?: OperatingHour[];
};

export type Holiday = { id: number; branch_id: number | null; date: string; name: string };
export type ScheduleBlock = { id: number; branch_id: number | null; dentist_id: number | null; starts_at: string; ends_at: string; reason: string | null };

export const fetchServices = (clinicId: number) => getData<ServiceRate[]>(`${base(clinicId)}/services`);
export const createService = (clinicId: number, body: Record<string, unknown>) => api.post(`${base(clinicId)}/services`, body);
export const updateService = (clinicId: number, id: number, body: Record<string, unknown>) => api.put(`${base(clinicId)}/services/${id}`, body);
export const fetchDentists = (clinicId: number) => getData<ClinicDentist[]>(`${base(clinicId)}/dentists`);
export const updateDentist = (clinicId: number, id: number, body: Record<string, unknown>) => api.put(`${base(clinicId)}/dentists/${id}`, body);
export const updateDentistSchedules = (clinicId: number, id: number, schedules: DentistSchedule[]) =>
  api.put(`${base(clinicId)}/dentists/${id}/schedules`, { schedules });
export const fetchClinicBranches = (clinicId: number) => getData<ClinicBranch[]>(`${base(clinicId)}/branches`);
export const createBranch = (clinicId: number, body: Record<string, unknown>) => api.post(`${base(clinicId)}/branches`, body);
export const updateBranch = (clinicId: number, id: number, body: Record<string, unknown>) => api.put(`${base(clinicId)}/branches/${id}`, body);
export const updateBranchHours = (clinicId: number, id: number, hours: OperatingHour[]) => api.put(`${base(clinicId)}/branches/${id}/hours`, { hours });
export const fetchHolidays = (clinicId: number) => getData<Holiday[]>(`${base(clinicId)}/holidays`);
export const createHoliday = (clinicId: number, body: { date: string; name: string }) => api.post(`${base(clinicId)}/holidays`, body);
export const deleteHoliday = (clinicId: number, id: number) => api.delete(`${base(clinicId)}/holidays/${id}`);
export const fetchScheduleBlocks = (clinicId: number) => getData<ScheduleBlock[]>(`${base(clinicId)}/schedule-blocks`);
export const createScheduleBlock = (clinicId: number, body: Record<string, unknown>) => api.post(`${base(clinicId)}/schedule-blocks`, body);
export const deleteScheduleBlock = (clinicId: number, id: number) => api.delete(`${base(clinicId)}/schedule-blocks/${id}`);

// ---------------------------------------------------------------- Reviews and lookups
export type ClinicReview = {
  id: number;
  rating: number;
  comment: string | null;
  patient_name: string;
  is_verified_visit: boolean;
  status: string;
  date: string | null;
};

export const fetchClinicReviews = (clinicId: number, page: number) => getPage<ClinicReview>(`${base(clinicId)}/reviews`, { page });
export const reportReview = (clinicId: number, id: number, reason: string) => api.post(`${base(clinicId)}/reviews/${id}/report`, { reason });

export const fetchSpecializationOptions = () => getData<Option[]>('/specializations');
export const fetchServiceCatalog = () => getData<Option[]>('/services');

// ---------------------------------------------------------------- Own account
export const updateAccount = async (body: { name?: string; email?: string }) => (await api.put('/profile', body)).data?.data;
export const changePassword = (body: { current_password: string; new_password: string; new_password_confirmation: string }) =>
  api.post('/change-password', body);

// ---------------------------------------------------------------- Dates (Philippine time, UTC+8 all year)
const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-11-03T09:00:00+08:00" → "Nov 3, 2026, 9:00 AM" in clinic time. */
export const formatDateTime = (iso?: string | null) => {
  if (!iso) return '';
  const local = new Date(new Date(iso).getTime() + 8 * 3600000);
  if (Number.isNaN(local.getTime())) return '';
  const day = local.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  return `${day}, ${formatClockTime(`${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`)}`;
};

/** Clinic-time ISO string from a date key and "HH:MM". */
export const toClinicIso = (dateKey: string, hhmm: string) => `${dateKey}T${hhmm}:00+08:00`;

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Monday first, as on the web hours editor. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** "HH:MM" (24-hour) of a timestamp in clinic time. */
export const clinicClock = (iso: string) => {
  const local = new Date(new Date(iso).getTime() + 8 * 3600000);
  return `${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}`;
};

/** YYYY-MM-DD of a timestamp in clinic time. */
export const clinicDateKey = (iso: string) => new Date(new Date(iso).getTime() + 8 * 3600000).toISOString().slice(0, 10);
