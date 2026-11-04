import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAvailability, getAvailableDates } from '../services/publicApi';
import { businessTodayKey, dateFromKey } from '../utils/dateTime';
import { toDateKey } from '../utils/bookingCalendar';

// Days shown in the calendar (today plus the next four weeks).
const CALENDAR_DAYS = 28;

/**
 * Date and time picking shared by booking and rescheduling, backed by the
 * clinic availability API. Shows a 4-week calendar; dates the dentist does
 * not work are disabled, and the selected date's open slots are fetched
 * live. Picking a new date clears the time, since slots depend on the date.
 *
 * target: { clinicId, serviceRateId, dentistId } — nothing loads until all set.
 */
export function useScheduleSelection(target = {}) {
  const { clinicId, serviceRateId, dentistId } = target;
  const isReady = Boolean(clinicId && serviceRateId && dentistId);

  const dates = useMemo(() => {
    const first = dateFromKey(businessTodayKey());
    return Array.from({ length: CALENDAR_DAYS }, (_, offset) => {
      const date = new Date(first);
      date.setDate(first.getDate() + offset);
      return date;
    });
  }, []);

  const [dateKey, setDateKey] = useState(null);
  const [time, setTime] = useState(null);

  const availableDates = useQuery({
    queryKey: ['availability', 'dates', clinicId, serviceRateId, dentistId],
    queryFn: () =>
      getAvailableDates({
        clinicId,
        serviceRateId,
        dentistId,
        from: toDateKey(dates[0]),
        to: toDateKey(dates[dates.length - 1]),
      }),
    enabled: isReady,
  });

  const slots = useQuery({
    queryKey: ['availability', 'slots', clinicId, serviceRateId, dentistId, dateKey],
    queryFn: () => getAvailability({ clinicId, serviceRateId, dentistId, date: dateKey }),
    enabled: isReady && Boolean(dateKey),
    staleTime: 30 * 1000,
  });

  const openDateKeys = new Set(availableDates.data ?? []);
  const selectedSlot = slots.data?.find((slot) => slot.label === time) ?? null;

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
    isDateOpen: (date) => openDateKeys.has(toDateKey(date)),
    isLoadingDates: availableDates.isPending && isReady,
    datesError: availableDates.error,
    timeSlots: (slots.data ?? []).map((slot) => slot.label),
    isLoadingSlots: slots.isFetching,
    slotsError: slots.error,
    dateKey,
    selectedDate: dateKey ? dateFromKey(dateKey) : null,
    time,
    selectedSlot,
    isComplete: Boolean(dateKey && selectedSlot),
    selectDate,
    selectTime: setTime,
    clear,
    refreshSlots: slots.refetch,
  };
}
