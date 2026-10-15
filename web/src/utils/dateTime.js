import { BUSINESS_TIMEZONE } from '../config/api';

// Formatting for API timestamps (ISO 8601 with offset). Clinic times are
// always shown in Philippine time, whatever the viewer's device timezone.

const format = (iso, options) =>
  iso ? new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TIMEZONE, ...options }).format(new Date(iso)) : '';

/** "July 25, 2026" */
export const formatDate = (iso) => format(iso, { month: 'long', day: 'numeric', year: 'numeric' });

/** "Jul 25, 2026" */
export const formatShortDate = (iso) => format(iso, { month: 'short', day: 'numeric', year: 'numeric' });

/** "9:00 AM" */
export const formatTime = (iso) => format(iso, { hour: 'numeric', minute: '2-digit' });

/** "July 25, 2026 at 9:00 AM" */
export const formatDateTime = (iso) => (iso ? `${formatDate(iso)} at ${formatTime(iso)}` : '');

/** "Jul 25, 9:00 AM" */
export const formatCompactDateTime = (iso) =>
  format(iso, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** "HH:MM" (24-hour) to "9:00 AM". */
export function formatClockTime(hhmm) {
  if (!hhmm) return '';
  const [hours, minutes] = hhmm.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${period}`;
}

/** Calendar date key (YYYY-MM-DD) of a timestamp in Philippine time. */
export function toBusinessDateKey(iso) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
  return parts;
}

/** Today's date key in Philippine time. */
export const businessTodayKey = (now = new Date()) => toBusinessDateKey(now.toISOString());

/** "2 hours ago", "3 days ago", "just now". */
export function formatRelative(iso, now = new Date()) {
  if (!iso) return '';
  const seconds = Math.round((now - new Date(iso)) / 1000);
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    const value = Math.floor(seconds / size);
    if (value >= 1) return `${value} ${unit}${value === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

/** Local Date for a YYYY-MM-DD key (calendar grids work in local dates). */
export function dateFromKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
