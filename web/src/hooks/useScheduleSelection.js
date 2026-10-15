import { useMemo, useState } from 'react';
import { BOOKING_TIME_SLOTS, getBookingAvailableDates } from '../mocks/bookingSchedule';
import { getOpenTimeSlots, toDateKey } from '../utils/bookingCalendar';

// Date and time picking shared by booking and rescheduling. Open dates and
// today's remaining slots are taken from "now" once per visit; picking a new
// date clears the time, since slots depend on the date.
export function useScheduleSelection() {
  const now = useMemo(() => new Date(), []);
  const dates = useMemo(() => getBookingAvailableDates(now), [now]);
  const [dateKey, setDateKey] = useState(null);
  const [time, setTime] = useState(null);

  const selectedDate = dates.find((date) => toDateKey(date) === dateKey);
  const timeSlots = selectedDate
    ? getOpenTimeSlots(BOOKING_TIME_SLOTS, selectedDate, now)
    : BOOKING_TIME_SLOTS;

  const selectDate = (key) => {
    if (key !== dateKey) setTime(null);
    setDateKey(key);
  };

  const clear = () => {
    setDateKey(null);
    setTime(null);
  };

  return {
    dates,
    timeSlots,
    dateKey,
    selectedDate,
    time,
    isComplete: Boolean(dateKey && time),
    selectDate,
    selectTime: setTime,
    clear,
  };
}
