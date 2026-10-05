// Offline-first versions of the patient endpoints.
//
// They keep the axios-like `{ data: { data } }` response shape the screens already
// consume, and add `offline` / `queued` flags so a screen can tell the user that what
// they see is saved data or that their change will be sent later.
import AsyncStorage from '@react-native-async-storage/async-storage';
import api, { isNetworkError } from '../http';
import { isOnline } from './network';
import { deleteCacheByPrefix, readCache, writeCache } from './database';
import { clearQueue, enqueue, getQueued, MutationKind, QueuedMutation, removeQueued } from './syncQueue';
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
    const raw = await AsyncStorage.getItem('user');
    const user = raw ? JSON.parse(raw) : null;
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

/** Sends a write now when possible, otherwise stores it in the sync queue. */
const sendOrQueue = async (
  kind: MutationKind,
  method: QueuedMutation['method'],
  url: string,
  payload: Record<string, unknown>,
): Promise<OfflineResponse<any>> => {
  if (isOnline()) {
    try {
      return await api.request({ method, url, data: payload });
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
  const queueId = await enqueue({ ownerId, kind, method, url, payload });
  return respond({ ...payload, id: `${LOCAL_ID_PREFIX}${queueId}` }, { queued: true });
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
      const clinic = payload.clinic_id ? await getClinicSummary(payload.clinic_id as number) : null;
      return {
        ...payload,
        id: `${LOCAL_ID_PREFIX}${item.id}`,
        status: 'pending',
        sync_status: item.status, // 'pending' | 'failed'
        sync_error: item.last_error,
        clinic: clinic ? { id: clinic.id, name: clinic.name, address: clinic.fullAddress } : null,
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

const createAppointment = (data: Record<string, unknown>) =>
  sendOrQueue('appointment.create', 'POST', '/patient/appointments', data);

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

const submitFeedback = (data: Record<string, unknown>) => {
  if (isLocalId(data.appointment_id)) {
    return Promise.reject(new Error('This appointment has not been synced yet.'));
  }
  return sendOrQueue('feedback.create', 'POST', '/patient/feedback', data);
};

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
  cancelAppointment,
  submitFeedback,
  getProfile,
  updateProfile,
};

/** Removes everything stored for a user (called on logout). */
export const clearUserOfflineData = async (ownerId: string) => {
  await Promise.all([deleteCacheByPrefix(userKey(ownerId, '')), clearQueue(ownerId)]);
};
