// MOCK booking availability: every remaining day of the current month,
// with the same slots every day. Past days are excluded, and today is
// excluded once its last slot has passed. When no days are left in the
// month, the whole next month shows. Real open dates and slots should come
// from the selected dentist's schedule via the API.
import { getOpenTimeSlots } from '../utils/bookingCalendar';

export const BOOKING_TIME_SLOTS = [
  '8:00 AM',
  '9:00 AM',
  '10:00 AM',
  '11:00 AM',
  '1:00 PM',
  '2:00 PM',
  '3:00 PM',
  '4:00 PM',
];

function getDaysFrom(year, month, firstDay) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return Array.from(
    { length: lastDay - firstDay + 1 },
    (_, offset) => new Date(year, month, firstDay + offset)
  );
}

export function getBookingAvailableDates(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const hasSlotsToday = getOpenTimeSlots(BOOKING_TIME_SLOTS, now, now).length > 0;
  const firstDay = now.getDate() + (hasSlotsToday ? 0 : 1);

  const dates = getDaysFrom(year, month, firstDay);
  return dates.length > 0 ? dates : getDaysFrom(year, month + 1, 1);
}
