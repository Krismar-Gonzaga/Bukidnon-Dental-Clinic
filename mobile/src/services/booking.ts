// Live appointment availability. These calls need a connection on purpose:
// open times change as other patients book, so they are never served from
// the offline copy. The server checks the chosen slot again on booking.
import api from './http';

export type Slot = {
  /** ISO time with the clinic's offset, e.g. 2026-11-03T09:00:00+08:00 */
  startsAt: string;
  /** "09:00" in clinic (Philippine) time */
  time: string;
  dentistId: number;
  branchId: number;
};

// The Philippines is UTC+8 all year (no daylight saving), so clinic dates can
// be computed without relying on the device's Intl time zone data.
const PH_OFFSET_MS = 8 * 60 * 60 * 1000;

/** YYYY-MM-DD for a moment, in Philippine time (clinic schedules use it). */
export const toBusinessDateKey = (date: Date) => new Date(date.getTime() + PH_OFFSET_MS).toISOString().slice(0, 10);

/** The next `count` calendar dates in Philippine time, starting today. */
export const upcomingBusinessDates = (count: number, now = new Date()) =>
  Array.from({ length: count }, (_, offset) => toBusinessDateKey(new Date(now.getTime() + offset * 86400000)));

/** "2026-11-03" → "Tue, Nov 3" (computed from the date itself, not the device zone). */
export const formatDateKey = (key: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString('en-US', { ...options, timeZone: 'UTC' });
};

/** Dates within [from, to] when the dentist works and the clinic is open. */
export const fetchAvailableDates = async (params: {
  clinicId: number | string;
  serviceRateId: number;
  dentistId: number;
  from: string;
  to: string;
}): Promise<string[]> => {
  const response = await api.get(`/clinics/${params.clinicId}/available-dates`, {
    params: { service_rate_id: params.serviceRateId, dentist_id: params.dentistId, from: params.from, to: params.to },
  });
  return response.data?.data ?? [];
};

/** Open start times on one date. */
export const fetchSlots = async (params: {
  clinicId: number | string;
  serviceRateId: number;
  dentistId: number;
  date: string;
}): Promise<Slot[]> => {
  const response = await api.get(`/clinics/${params.clinicId}/availability`, {
    params: { service_rate_id: params.serviceRateId, dentist_id: params.dentistId, date: params.date },
  });
  return (response.data?.data ?? []).map((slot: any) => ({
    startsAt: slot.starts_at,
    time: slot.time,
    dentistId: slot.dentist_id,
    branchId: slot.branch_id,
  }));
};

/** "09:00" → "9:00 AM" */
export const formatClockTime = (hhmm?: string | null) => {
  if (!hhmm) {
    return '';
  }
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
