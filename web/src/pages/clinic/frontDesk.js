import { formatTime } from '../../utils/dateTime';

// What the front desk screens show for an appointment's backend status.
const STATUS = {
  pending: { label: 'Pending', tone: 'warning' },
  reschedule_requested: { label: 'Reschedule Requested', tone: 'warning' },
  confirmed: { label: 'Confirmed', tone: 'info' },
  checked_in: { label: 'Confirmed', tone: 'info' },
  in_progress: { label: 'Ongoing', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  rejected: { label: 'Rejected', tone: 'danger' },
  no_show: { label: 'No-Show', tone: 'warning' },
};

export const statusOf = (status) => STATUS[status] ?? { label: status, tone: 'neutral' };

/** The patient has arrived: checked in, being seen, or finished. */
export const hasCheckedIn = (status) => ['checked_in', 'in_progress', 'completed'].includes(status);

/** "8:00 AM" split for the hour tile: { hour: '8', period: 'AM' }. */
export function hourParts(startsAt) {
  const [clock = '', period = ''] = formatTime(startsAt).split(' ');
  const [hour, minutes] = clock.split(':');
  return { hour: minutes === '00' ? hour : clock, period };
}

/** Today's counts for the hero, tiles and Today at a Glance. */
export function summarizeToday(appointments) {
  const count = (...statuses) => appointments.filter((a) => statuses.includes(a.backendStatus)).length;
  return {
    total: appointments.length,
    waiting: count('checked_in'),
    ongoing: count('in_progress'),
    checkedIn: count('checked_in', 'in_progress'),
    completed: count('completed'),
    pending: count('pending'),
    noShow: count('no_show'),
  };
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Monday first, as the working week reads.
const WEEK = [1, 2, 3, 4, 5, 6, 0];

/** "Mon – Fri", "Mon, Wed, Fri" or "Not set" from a list of day numbers (0 is Sunday). */
export function workingDaysLabel(days) {
  const order = WEEK.filter((day) => days.includes(day));
  if (order.length === 0) return 'Not set';
  const first = WEEK.indexOf(order[0]);
  const isRun = order.every((day, index) => WEEK.indexOf(day) === first + index);
  if (isRun && order.length > 1) return `${DAY_NAMES[order[0]]} – ${DAY_NAMES[order[order.length - 1]]}`;
  return order.map((day) => DAY_NAMES[day]).join(', ');
}

export const WEEK_DAYS = WEEK.map((day) => ({ day, label: DAY_NAMES[day] }));
