// Calendar helpers for the booking schedule step. Dates are local Date
// objects; keys use local YYYY-MM-DD to avoid UTC day shifts.

export function toDateKey(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

// Monday-first column (0-6) of a date in the week grid.
export function getMondayFirstWeekday(date) {
  return (date.getDay() + 6) % 7;
}

export function formatMonthYear(date) {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function formatFullDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatLongDate(date) {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function isSameDay(a, b) {
  return toDateKey(a) === toDateKey(b);
}

// Minutes after midnight for a slot label like '1:00 PM'.
export function parseTimeSlot(label) {
  const [, hours, minutes, period] = label.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  const hour12 = Number(hours) % 12;
  const isPm = period.toUpperCase() === 'PM';
  return (isPm ? hour12 + 12 : hour12) * 60 + Number(minutes);
}

// Slots still bookable on `date`: on today, only those that start after now.
export function getOpenTimeSlots(slots, date, now) {
  if (!isSameDay(date, now)) return slots;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return slots.filter((slot) => parseTimeSlot(slot) > nowMinutes);
}
