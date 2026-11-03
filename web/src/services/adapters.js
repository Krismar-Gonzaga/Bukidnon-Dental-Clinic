import {
  formatClockTime,
  formatDate,
  formatDateTime,
  formatRelative,
  formatTime,
  WEEKDAY_SHORT,
} from '../utils/dateTime';

// API (snake_case) → UI shapes (camelCase) used by the existing components.
// Components never read API responses directly.

const ACCENT_COUNT = 6;
export const accentFor = (id) => ((Number(id) || 0) % ACCENT_COUNT) + 1;

const peso = (amount) =>
  `₱${Number(amount).toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;

export const formatPriceRange = (min, max) => {
  if (min == null) return 'Price on request';
  return min === max || max == null ? peso(min) : `${peso(min)} – ${peso(max)}`;
};

export const formatDurationRange = (min, max) => {
  if (min == null) return '';
  return min === max || max == null ? `${min} min` : `${min}–${max} min`;
};

// ------------------------------------------------------------------ Appointments

// Backend status → the four patient-facing statuses in config/appointments.js.
const PATIENT_STATUS = {
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

export function toAppointment(api) {
  const startsAt = api.starts_at;
  const date = startsAt ? formatDate(startsAt) : api.appointment_date ?? '';
  const time = startsAt ? formatTime(startsAt) : formatClockTime(api.appointment_time);

  return {
    id: String(api.id),
    reference: String(api.id).padStart(6, '0'),
    service: api.service?.name ?? 'Dental appointment',
    serviceRateId: api.service?.id ?? null,
    price: api.service?.price ?? null,
    durationMinutes: api.service?.duration_minutes ?? null,
    dentist: api.dentist?.name ?? 'Assigned dentist',
    dentistId: api.dentist?.id ?? null,
    clinic: api.clinic?.name ?? '',
    clinicId: api.clinic?.id ?? null,
    clinicAddress: api.clinic?.address ?? '',
    clinicPhone: api.clinic?.contact_number ?? '',
    branch: api.branch?.name ?? '',
    branchId: api.branch?.id ?? null,
    branchAddress: api.branch?.address ?? '',
    status: PATIENT_STATUS[api.status] ?? api.status,
    backendStatus: api.status,
    startsAt,
    endsAt: api.ends_at ?? null,
    date,
    time,
    dateTime: startsAt ? formatDateTime(startsAt) : `${date} at ${time}`,
    reason: api.reason ?? '',
    notes: api.notes ?? '',
    cancellationReason: api.cancellation_reason ?? '',
    requestedStartsAt: api.requested_starts_at ?? null,
    requestedDateTime: api.requested_starts_at ? formatDateTime(api.requested_starts_at) : '',
    hasReview: Boolean(api.has_review),
    patient: api.patient
      ? { id: api.patient.id, name: api.patient.name, email: api.patient.email, phone: api.patient.phone, age: api.patient.age ?? null }
      : null,
    type: api.type ?? null,
    history: (api.status_history ?? []).map((entry) => ({
      from: entry.from,
      to: entry.to,
      reason: entry.reason,
      at: entry.at,
    })),
  };
}

// ------------------------------------------------------------------ Clinics

/** Directory/search card shape (see ClinicDirectoryCard). */
export function toClinicSummary(api) {
  return {
    id: String(api.id),
    name: api.name,
    location: api.city,
    province: api.province ?? 'Bukidnon',
    address: api.full_address ?? [api.address, api.city, api.province].filter(Boolean).join(', '),
    rating: Number(api.rating ?? 0),
    reviewCount: api.review_count ?? 0,
    specializations: (api.specializations ?? []).map((s) => (typeof s === 'string' ? s : s.name)),
    verified: Boolean(api.is_verified),
    latitude: api.latitude ?? null,
    longitude: api.longitude ?? null,
    phone: api.contact_number ?? '',
    email: api.email ?? '',
    startingPrice: api.starting_price ?? null,
    accent: accentFor(api.id),
  };
}

/** "Mon–Sat 8:00 AM–5:00 PM" style summary of weekly hours. */
export function summarizeHours(hours = []) {
  if (hours.length === 0) return '';
  const groups = [];
  [...hours]
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .forEach((h) => {
      const range = `${formatClockTime(h.opens_at)}–${formatClockTime(h.closes_at)}`;
      const last = groups[groups.length - 1];
      if (last && last.range === range && last.to === h.day_of_week - 1) {
        last.to = h.day_of_week;
      } else {
        groups.push({ from: h.day_of_week, to: h.day_of_week, range });
      }
    });
  return groups
    .map(({ from, to, range }) =>
      `${WEEKDAY_SHORT[from]}${from === to ? '' : `–${WEEKDAY_SHORT[to]}`} ${range}`
    )
    .join(', ');
}

export function toServiceCard(api, { clinicName } = {}) {
  return {
    id: String(api.id),
    name: api.name,
    category: api.category ?? clinicName ?? 'Dental service',
    priceLabel: formatPriceRange(Number(api.price), Number(api.price)),
    price: Number(api.price),
    durationLabel: api.duration_minutes ? `${api.duration_minutes} min` : '',
    durationMinutes: api.duration_minutes,
    description: api.description ?? '',
  };
}

export function toDentistCard(api, { clinicName } = {}) {
  return {
    id: String(api.id),
    name: api.name ?? 'Dentist',
    specialty: api.specialization ?? 'General Dentistry',
    clinicName: clinicName ?? api.clinics?.map((c) => c.name).join(', ') ?? null,
    clinics: api.clinics ?? [],
    // Published reviews of this dentist's visits; null until there are any.
    rating: typeof api.rating === 'number' ? api.rating : null,
    reviewCount: api.review_count ?? 0,
    yearsExperience: api.years_experience ?? 0,
    schedules: api.schedules ?? [],
    qualifications: api.qualifications ?? '',
    bio: api.bio ?? '',
    available: api.is_available ?? api.is_active !== false,
    accent: accentFor(api.id),
  };
}

export function toReview(api) {
  return {
    id: String(api.id),
    rating: api.rating,
    comment: api.comment ?? '',
    patientName: api.patient_name,
    clinicName: api.clinic_name ?? '',
    isVerifiedVisit: Boolean(api.is_verified_visit),
    status: api.status,
    date: api.date ? formatDate(`${api.date}T12:00:00+08:00`) : '',
  };
}

/** Full clinic page shape (Clinic Details). */
export function toClinicProfile(api) {
  const main = api.branches?.find((b) => b.is_main) ?? api.branches?.[0];
  return {
    ...toClinicSummary(api),
    description: api.description ?? '',
    hours: summarizeHours(main?.operating_hours),
    branches: (api.branches ?? []).map((b) => ({
      id: String(b.id),
      name: b.name,
      address: [b.address, b.city].filter(Boolean).join(', '),
      hours: summarizeHours(b.operating_hours),
      latitude: b.latitude,
      longitude: b.longitude,
    })),
    services: (api.services ?? []).map((s) => toServiceCard(s)),
    dentists: (api.dentists ?? []).map((d) => toDentistCard(d, { clinicName: api.name })),
    reviews: (api.reviews ?? []).map(toReview),
    ratingBreakdown: api.rating_breakdown ?? {},
  };
}

// ------------------------------------------------------------------ Notifications

const NOTIFICATION_TYPE = {
  reminder: 'reminder',
  appointment: 'confirmed',
  clinic_verification: 'confirmed',
};

export function toNotification(api) {
  return {
    id: api.id,
    type: NOTIFICATION_TYPE[api.kind] ?? 'message',
    kind: api.kind,
    title: api.title,
    message: api.message,
    time: formatRelative(api.created_at),
    createdAt: api.created_at,
    unread: !api.read_at,
    resource: api.resource ?? null,
  };
}
