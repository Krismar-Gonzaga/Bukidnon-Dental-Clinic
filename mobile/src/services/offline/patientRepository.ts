// Offline-first versions of the patient endpoints.
//
// They keep the axios-like `{ data: { data } }` response shape the screens already
// consume, and add `offline` / `queued` flags so a screen can tell the user that what
// they see is saved data or that their change will be sent later.
import api, { isNetworkError } from '../http';
import { readUser } from '../session';
import { isOnline } from './network';
import { deleteCacheByPrefix, readCache, writeCache } from './database';
import {
  clearQueue,
  enqueue,
  getQueued,
  MutationKind,
  QueuedMutation,
  removeQueued,
  splitLocalFields,
} from './syncQueue';
import { getClinicSummary } from './publicRepository';

/** Ids of records that only exist locally until their queued create is synced. */
export const LOCAL_ID_PREFIX = 'local-';

export const isLocalId = (id: unknown) => String(id).startsWith(LOCAL_ID_PREFIX);

export type OfflineResponse<T> = {
  data: {
    success: boolean;
    data: T;
    /** Served from the local copy because the server couldn't be reached. */
    offline?: boolean;
    /** Saved on the device and waiting to be sent to the server. */
    queued?: boolean;
    cachedAt?: number | null;
  };
};

const respond = <T>(data: T, extra: Omit<OfflineResponse<T>['data'], 'success' | 'data'> = {}) => ({
  data: { success: true, data, ...extra },
});

export const getCurrentUserId = async (): Promise<string | null> => {
  try {
    const user = await readUser<{ id?: number | string }>();
    return user?.id != null ? String(user.id) : null;
  } catch {
    return null;
  }
};

const userKey = (ownerId: string, name: string) => `patient:${ownerId}:${name}`;

/** Network-first read that falls back to (and refreshes) the local copy. */
const readThrough = async <T>(key: string, url: string, fallback: T) => {
  if (isOnline()) {
    try {
      const response = await api.get(url);
      const value = (response.data?.data ?? fallback) as T;
      await writeCache(key, value);
      return { value, offline: false, cachedAt: Date.now() };
    } catch (error) {
      if (!isNetworkError(error)) {
        throw error;
      }
    }
  }
  const cached = await readCache<T>(key);
  return { value: cached?.value ?? fallback, offline: true, cachedAt: cached?.updatedAt ?? null };
};

/**
 * Sends a write now when possible, otherwise stores it in the sync queue.
 * `headers` (e.g. Idempotency-Key) are kept with a queued write and sent
 * again when it is replayed, so a retry can never be applied twice.
 */
const sendOrQueue = async (
  kind: MutationKind,
  method: QueuedMutation['method'],
  url: string,
  payload: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<OfflineResponse<any>> => {
  if (isOnline()) {
    try {
      return await api.request({ method, url, data: splitLocalFields(payload).body, headers });
    } catch (error) {
      // A real server answer (validation error etc.) goes back to the screen as usual.
      if (!isNetworkError(error)) {
        throw error;
      }
    }
  }

  const ownerId = await getCurrentUserId();
  if (!ownerId) {
    throw new Error('Please sign in again to save this change.');
  }
  // Keys starting with "__" stay on the device (see syncQueue.splitLocalFields).
  const queueId = await enqueue({ ownerId, kind, method, url, payload: { ...payload, __headers: headers ?? null } });
  return respond({ ...payload, id: `${LOCAL_ID_PREFIX}${queueId}` }, { queued: true });
};

/** A fresh key per booking attempt; retries of the same attempt reuse it. */
export const newIdempotencyKey = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;

const toLocalDateAndTime = (iso: unknown) => {
  if (typeof iso !== 'string') {
    return {};
  }
  // Business times arrive as "2026-11-03T09:00:00+08:00"; keep the local part.
  const [date, time] = iso.split('T');
  return { appointment_date: date, appointment_time: time?.slice(0, 5) };
};

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

/** Bookings made offline, shaped like server appointments so lists can render them. */
const queuedAppointments = async (ownerId: string) => {
  const queued = await getQueued(ownerId, { kind: 'appointment.create' });
  return Promise.all(
    queued.map(async (item) => {
      const payload = item.payload ?? {};
      const display = (payload.__display ?? {}) as { service?: string; dentist?: string };
      const clinic = payload.clinic_id ? await getClinicSummary(payload.clinic_id as number) : null;
      return {
        ...payload,
        ...toLocalDateAndTime(payload.starts_at),
        id: `${LOCAL_ID_PREFIX}${item.id}`,
        status: 'pending',
        sync_status: item.status, // 'pending' | 'failed'
        sync_error: item.last_error,
        clinic: clinic ? { id: clinic.id, name: clinic.name, address: clinic.fullAddress } : null,
        service: display.service ? { name: display.service } : null,
        dentist: display.dentist ? { name: display.dentist } : null,
        created_at: new Date(item.created_at).toISOString(),
      };
    }),
  );
};

const withQueuedCancellations = async (ownerId: string, appointments: any[]) => {
  const cancellations = await getQueued(ownerId, { kind: 'appointment.cancel' });
  const cancelledIds = new Set(cancellations.map((item) => String(item.payload?.appointment_id)));
  return appointments.map((appointment) =>
    cancelledIds.has(String(appointment.id))
      ? { ...appointment, status: 'cancelled', sync_status: 'pending' }
      : appointment,
  );
};

const getAppointments = async (): Promise<OfflineResponse<any[]>> => {
  const ownerId = await getCurrentUserId();
  if (!ownerId) {
    return api.get('/patient/appointments');
  }
  const result = await readThrough<any[]>(userKey(ownerId, 'appointments'), '/patient/appointments', []);
  const fromServer = Array.isArray(result.value) ? result.value : [];
  const merged = [
    ...(await queuedAppointments(ownerId)),
    ...(await withQueuedCancellations(ownerId, fromServer)),
  ];
  return respond(merged, { offline: result.offline, cachedAt: result.cachedAt });
};

/**
 * Requests an appointment for a slot chosen from live availability.
 * data: { clinic_id, service_rate_id, dentist_id, branch_id, starts_at, reason?, notes? }
 * The server re-checks the slot; if the request is queued offline it is
 * revalidated on replay and parked as failed if the slot is gone.
 * `display` (service/dentist names) is kept only on the device.
 */
const createAppointment = (
  data: Record<string, unknown>,
  idempotencyKey: string,
  display: { service?: string; dentist?: string } = {},
) =>
  sendOrQueue(
    'appointment.create',
    'POST',
    '/patient/appointments',
    { ...data, __display: display },
    { 'Idempotency-Key': idempotencyKey },
  );

/**
 * Moves a pending request, or asks the clinic to move a confirmed one.
 * Needs a connection: the new slot must be checked against live availability.
 */
const rescheduleAppointment = (id: number | string, startsAt: string) =>
  api.put(`/patient/appointments/${id}`, { starts_at: startsAt });

const cancelAppointment = async (id: number | string) => {
  // Not on the server yet: cancelling just drops the queued booking.
  if (isLocalId(id)) {
    await removeQueued(Number(String(id).slice(LOCAL_ID_PREFIX.length)));
    return respond(null);
  }
  return sendOrQueue('appointment.cancel', 'DELETE', `/patient/appointments/${id}`, {
    appointment_id: id,
  });
};

// ---------------------------------------------------------------------------
// Feedback & profile
// ---------------------------------------------------------------------------

/** Reviews are allowed once per completed appointment (checked by the server). */
const submitFeedback = (data: { appointment_id: number | string; rating: number; comment?: string }) => {
  if (isLocalId(data.appointment_id)) {
    return Promise.reject(new Error('This appointment has not been synced yet.'));
  }
  return sendOrQueue('feedback.create', 'POST', `/patient/appointments/${data.appointment_id}/review`, {
    rating: data.rating,
    comment: data.comment,
  });
};

/** Completed appointments still waiting for a review (online only). */
const getReviewableAppointments = () => api.get('/patient/reviews/eligible');

const getProfile = async (): Promise<OfflineResponse<Record<string, any>>> => {
  const ownerId = await getCurrentUserId();
  if (!ownerId) {
    return api.get('/patient/profile');
  }
  const result = await readThrough<Record<string, any>>(userKey(ownerId, 'profile'), '/patient/profile', {});
  return respond(result.value ?? {}, { offline: result.offline, cachedAt: result.cachedAt });
};

const updateProfile = async (data: Record<string, unknown>) => {
  const response = await sendOrQueue('profile.update', 'PUT', '/patient/profile', data);
  const ownerId = await getCurrentUserId();
  if (ownerId) {
    // Keep the local copy in step so the edit survives an offline restart.
    const key = userKey(ownerId, 'profile');
    const cached = await readCache<Record<string, unknown>>(key);
    await writeCache(key, { ...(cached?.value ?? {}), ...data });
  }
  return response;
};

export const offlinePatientService = {
  getAppointments,
  createAppointment,
  rescheduleAppointment,
  cancelAppointment,
  submitFeedback,
  getReviewableAppointments,
  getProfile,
  updateProfile,
};

/** Removes everything stored for a user (called on logout). */
export const clearUserOfflineData = async (ownerId: string) => {
  await Promise.all([deleteCacheByPrefix(userKey(ownerId, '')), clearQueue(ownerId)]);
};
