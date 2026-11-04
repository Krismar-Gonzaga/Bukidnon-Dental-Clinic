// Figures of the clinic admin dashboard (web: pages/clinic/ClinicAdminOverview.jsx).
// Revenue is an estimate: the listed price of completed visits.
import api from './http';

export type ChartDay = { date: string; confirmed: number; pending: number; cancelled: number };

export type ClinicActivity = {
  id: number;
  action: string;
  kind: string;
  title: string;
  subject: string | null;
  actor: string | null;
  created_at: string;
};

export type ClinicInsights = {
  today: { date: string; appointments: number; yesterday: number; pending_requests: number };
  patients: { total: number; new_this_month: number };
  dentists: { total: number; active: number; inactive: number };
  staff: { total: number; active: number; inactive: number };
  appointments_by_day: ChartDay[];
  revenue: { year: number; currency: string; this_month: number; last_month: number; by_month: { month: string; total: number }[] };
  activity: ClinicActivity[];
};

const base = (clinicId: number) => `/manage/clinics/${clinicId}`;

export const fetchClinicInsights = async (clinicId: number): Promise<ClinicInsights> => (await api.get(`${base(clinicId)}/dashboard/insights`)).data?.data;

export const fetchAppointmentCalendar = async (clinicId: number, month: string): Promise<{ month: string; days: { date: string; total: number }[] }> =>
  (await api.get(`${base(clinicId)}/appointments/calendar`, { params: { month } })).data?.data;

/** Greeting for a time of day in minutes since midnight, Philippine time. */
export function greetingFor(minutes: number) {
  if (minutes < 12 * 60) return 'Good morning,';
  return minutes < 18 * 60 ? 'Good afternoon,' : 'Good evening,';
}

/** Minutes since midnight now, in Philippine time (UTC+8), whatever the device zone. */
export function businessMinutesNow(now = new Date()) {
  return (now.getUTCHours() * 60 + now.getUTCMinutes() + 8 * 60) % (24 * 60);
}

export function todayNote(today: number, yesterday: number) {
  const difference = today - yesterday;
  if (difference === 0) return 'Same as yesterday';
  return `${difference > 0 ? '+' : ''}${difference} from yesterday`;
}

/** "12% vs last month" with a direction, or null when there is nothing to compare. */
export function revenueChange(current: number, previous: number) {
  if (!previous) return null;
  const pct = Math.round(((current - previous) / previous) * 100);
  return { up: pct >= 0, text: `${Math.abs(pct)}% vs last month` };
}

/** Day cells for a month grid starting on Monday; null fills the leading gap. */
export function monthCells(month: string): (string | null)[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const total = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const lead = (firstDay + 6) % 7;
  return [...Array<null>(lead).fill(null), ...Array.from({ length: total }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
}

export function moveMonth(month: string, by: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + by, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
