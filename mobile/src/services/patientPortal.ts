// What the patient screens need on top of offlinePatientService: the profile in the shape
// the screens use, the health details, consents and photo, and small display helpers.
//
// Health details are sensitive: they are never written to the device's offline copy or
// the sync queue, so they load and save only with a connection.
import api, { patientService } from './api';
import { API_BASE_URL } from './config';
import { readToken } from './session';
import { formatClockTime, formatDateKey } from './booking';

export type Allergy = { name: string; type: string; severity: string; reaction?: string | null };
export type Medication = { name: string; dosage?: string | null; purpose?: string | null; note?: string | null };
export type Procedure = { name: string; detail?: string | null; date?: string | null; note?: string | null };
export type Vital = { value?: string | null; note?: string | null };

export type Health = {
  conditions: string[];
  procedures: Procedure[];
  vitals: Record<string, Vital>;
  allergies: Allergy[];
  medications: Medication[];
  anxiety: { level?: number | null; sedation?: string | null; notes?: string | null };
};

export type Profile = {
  name: string;
  email: string;
  phone: string;
  address: string;
  birthDate: string;
  gender: string;
  civilStatus: string;
  bloodType: string;
  city: string;
  province: string;
  zipCode: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelationship: string;
  emergencyContactAddress: string;
  photoVersion: string | null;
  health: Health;
  /** False when this came from the offline copy, which holds no health details. */
  healthAvailable: boolean;
  consents: Record<string, boolean>;
  emailNotifications: boolean;
};

const titleCase = (value: unknown) => {
  const text = typeof value === 'string' ? value : '';
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : '';
};

const text = (value: unknown) => (typeof value === 'string' ? value : '');

export const toHealth = (raw: any): Health => ({
  conditions: Array.isArray(raw?.conditions) ? raw.conditions : [],
  procedures: Array.isArray(raw?.procedures) ? raw.procedures : [],
  vitals: raw?.vitals && !Array.isArray(raw.vitals) ? raw.vitals : {},
  allergies: Array.isArray(raw?.allergies) ? raw.allergies : [],
  medications: Array.isArray(raw?.medications) ? raw.medications : [],
  anxiety: raw?.anxiety && !Array.isArray(raw.anxiety) ? raw.anxiety : {},
});

export const toProfile = (raw: any): Profile => ({
  name: text(raw?.name),
  email: text(raw?.email),
  phone: text(raw?.phone),
  address: text(raw?.address),
  birthDate: text(raw?.birth_date),
  gender: titleCase(raw?.gender),
  civilStatus: titleCase(raw?.civil_status),
  bloodType: text(raw?.blood_type),
  city: text(raw?.city),
  province: text(raw?.province),
  zipCode: text(raw?.zip_code),
  emergencyContactName: text(raw?.emergency_contact_name),
  emergencyContactPhone: text(raw?.emergency_contact_phone),
  emergencyContactRelationship: text(raw?.emergency_contact_relationship),
  emergencyContactAddress: text(raw?.emergency_contact_address),
  photoVersion: raw?.photo_version ?? null,
  health: toHealth(raw?.health),
  healthAvailable: raw?.health !== undefined,
  consents: raw?.consents ?? {},
  emailNotifications: raw?.notification_preferences?.email !== false,
});

export const fetchProfile = async (): Promise<Profile> => toProfile((await patientService.getProfile()).data.data);

/** Saved now, or queued on the device when offline (returns whether it was queued). */
export const saveProfile = async (form: Profile): Promise<boolean> => {
  const response = await patientService.updateProfile({
    name: form.name,
    email: form.email,
    phone: form.phone,
    address: form.address,
    birth_date: form.birthDate || null,
    gender: form.gender ? form.gender.toLowerCase() : null,
    civil_status: form.civilStatus ? form.civilStatus.toLowerCase() : null,
    blood_type: form.bloodType || null,
    city: form.city || null,
    province: form.province || null,
    zip_code: form.zipCode || null,
    emergency_contact_name: form.emergencyContactName || null,
    emergency_contact_phone: form.emergencyContactPhone || null,
    emergency_contact_relationship: form.emergencyContactRelationship || null,
    emergency_contact_address: form.emergencyContactAddress || null,
  });
  return Boolean(response.data?.queued);
};

export const saveHealth = (health: Health) => api.put('/patient/profile/health', health);

/** The first switch is the existing email preference; the rest are stored consents. */
export const saveConsent = (id: string, value: boolean) =>
  id === 'emailReminders'
    ? api.put('/notification-preferences', { email: value })
    : api.put('/patient/profile', { consents: { [id]: value } });

export const uploadPhoto = (asset: { uri: string; mimeType?: string | null; fileName?: string | null }) => {
  const body = new FormData();
  const type = asset.mimeType ?? 'image/jpeg';
  body.append('photo', { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type } as any);
  return api.post('/patient/profile/photo', body, { headers: { 'Content-Type': 'multipart/form-data' } });
};

/** The photo is private: the image request has to carry the session token. */
export const photoSource = async (version: string) => {
  const token = await readToken();
  return {
    uri: `${API_BASE_URL}/patient/profile/photo?v=${version}`,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  };
};

export const changePassword = (currentPassword: string, newPassword: string) =>
  api.post('/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
    new_password_confirmation: newPassword,
  });

export const fetchClinicRecorded = async () => {
  const [history, records] = await Promise.all([api.get('/patient/medical-history'), api.get('/patient/records')]);
  return { history: (history.data?.data ?? []) as any[], records: (records.data?.data ?? []) as any[] };
};

// ---------------------------------------------------------------------------
// Names, labels and alerts
// ---------------------------------------------------------------------------

/** One stored name, shown as two fields: joining them again gives back the same name. */
export const splitName = (name = '') => {
  const [firstName = '', ...rest] = name.trim().split(/\s+/);
  return { firstName, lastName: rest.join(' ') };
};

export const joinName = (firstName: string, lastName: string) => `${firstName.trim()} ${lastName.trim()}`.trim();

/** The small labels under the patient's name. */
export const profileChips = ({ bloodType, health }: Pick<Profile, 'bloodType' | 'health'>) => {
  const allergy = health.allergies.find(({ severity }) => severity === 'severe') ?? health.allergies[0];
  const chips: Array<{ label: string; tone: 'danger' | 'warning' }> = [];
  if (bloodType) {
    chips.push({ label: bloodType, tone: 'danger' });
  }
  if (health.conditions[0]) {
    chips.push({ label: health.conditions[0], tone: 'warning' });
  }
  if (allergy) {
    chips.push({ label: `${allergy.name} Allergy`, tone: 'danger' });
  }
  return chips;
};

/** The alert banner's sentence, or '' when there is nothing to warn a dentist about. */
export const medicalAlerts = ({ health }: Pick<Profile, 'health'>) => {
  const parts = [
    ...(health.allergies.length > 0 ? [`Allergic to ${health.allergies.map(({ name }) => name).join(', ')}`] : []),
    ...health.medications.map(
      ({ name, dosage, purpose }) =>
        `Taking ${name}${dosage ? ` (${dosage})` : ''}${purpose ? ` for ${purpose.toLowerCase()}` : ''}`,
    ),
    ...health.conditions,
  ];
  return parts.length > 0 ? `${parts.join(' · ')} — inform your dentist before any procedure.` : '';
};

export const ageFrom = (birthDate: string, today = new Date()) => {
  const [year, month, day] = birthDate.split('-').map(Number);
  const hadBirthday = today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  return today.getFullYear() - year - (hadBirthday ? 0 : 1);
};

export const passwordStrength = (password: string) => {
  const rules: Array<[boolean, string]> = [
    [password.length >= 8, 'use at least 8 characters'],
    [/[^A-Za-z0-9]/.test(password), 'add a symbol'],
    [/\d/.test(password), 'add a number'],
    [/[a-z]/.test(password) && /[A-Z]/.test(password), 'mix uppercase and lowercase letters'],
  ];
  const score = rules.filter(([met]) => met).length;
  const hint = rules.find(([met]) => !met)?.[1] ?? '';
  const label = score <= 1 ? 'Weak' : score === 2 ? 'Medium' : score === 3 ? 'Good' : 'Strong';
  return { score, label, hint };
};

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

export type Appointment = {
  id: number | string;
  status: string;
  starts_at?: string;
  appointment_date?: string;
  appointment_time?: string;
  clinic?: { id?: number; name?: string; address?: string };
  dentist?: { id?: number; name?: string };
  service?: { id?: number; name?: string; price?: number; currency?: string };
  cancellation_reason?: string | null;
  requested_starts_at?: string | null;
  has_review?: boolean;
  sync_status?: string;
  sync_error?: string | null;
};

export type AppointmentGroup = 'pending' | 'upcoming' | 'completed' | 'cancelled';

const GROUP_BY_STATUS: Record<string, AppointmentGroup> = {
  pending: 'pending',
  confirmed: 'upcoming',
  reschedule_requested: 'upcoming',
  checked_in: 'upcoming',
  in_progress: 'upcoming',
  completed: 'completed',
  cancelled: 'cancelled',
  rejected: 'cancelled',
  no_show: 'cancelled',
};

export const appointmentGroup = (status: string): AppointmentGroup => GROUP_BY_STATUS[status] ?? 'cancelled';

export const canCancel = (status: string) => ['pending', 'confirmed', 'reschedule_requested'].includes(status);
export const canReschedule = (appointment: Appointment) =>
  ['pending', 'confirmed'].includes(appointment.status) &&
  !String(appointment.id).startsWith('local-') &&
  Boolean(appointment.service?.id && appointment.dentist?.id);

const dateKeyOf = (appointment: Appointment) => appointment.starts_at?.slice(0, 10) ?? appointment.appointment_date?.slice(0, 10);

export const appointmentDate = (appointment: Appointment) => {
  const key = dateKeyOf(appointment);
  return key ? formatDateKey(key, { month: 'long', day: 'numeric', year: 'numeric' }) : 'Date to be confirmed';
};

export const appointmentTime = (appointment: Appointment) => formatClockTime(appointment.appointment_time) || 'Time to be confirmed';

export const appointmentReference = (id: number | string) => String(id).padStart(6, '0');
