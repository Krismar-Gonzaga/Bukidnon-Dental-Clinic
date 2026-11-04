import { formatClock } from '../../utils/format';

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type WeeklyHours = { day: number; start: string; end: string };
export type HoursRow = { days: string; text: string };

/** "Mon–Fri / 9:00 AM – 5:00 PM" rows from weekly hours; every day of the week is shown. */
export const workingHours = (hours: WeeklyHours[]): HoursRow[] => {
  const byDay: Record<number, { start: string; end: string }> = {};
  hours.forEach(({ day, start, end }) => {
    const current = byDay[day];
    byDay[day] = {
      start: current && current.start < start ? current.start : start,
      end: current && current.end > end ? current.end : end,
    };
  });

  const rows: Array<{ from: number; to: number; text: string }> = [];
  WEEK_ORDER.forEach((day) => {
    const today = byDay[day];
    const text = today ? `${formatClock(today.start)} – ${formatClock(today.end)}` : 'Closed';
    const last = rows[rows.length - 1];
    if (last && last.text === text) {
      last.to = day;
    } else {
      rows.push({ from: day, to: day, text });
    }
  });

  return rows.map(({ from, to, text }) => ({
    days: from === to ? DAY_NAMES[from] : `${DAY_NAMES[from]}–${DAY_NAMES[to]}`,
    text,
  }));
};

/** One line for the open days only: "Mon–Sat 8:00 AM – 5:00 PM". */
export const openDaysSummary = (hours: WeeklyHours[]) =>
  workingHours(hours)
    .filter((row) => row.text !== 'Closed')
    .map((row) => `${row.days} ${row.text}`)
    .join(', ');
