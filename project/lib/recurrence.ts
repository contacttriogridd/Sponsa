import { daysBetweenDates, isSameMonthDay, toDateOnlyIST } from '@/lib/dateHelpers';

/**
 * Whether an event happens on a date. Pure and free of Supabase, so the
 * dashboard, calendar, reminder engine and cron job all share one answer.
 * Dates are YYYY-MM-DD in IST.
 */

export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: 'Does not repeat',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface RecurringEvent {
  /** The one-time date, also the default start. */
  date?: string | null;
  recurrence?: Recurrence | null;
  /** 0 (Sunday) to 6, for weekly. Empty means the weekday of the start date. */
  weekdays?: number[] | null;
  /** 1 to 31, for monthly. Empty means the day of the start date. */
  day_of_month?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  active?: boolean | null;
}

export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

function lastDayOfMonth(date: string): number {
  return new Date(Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0)).getUTCDate();
}

export function occursOn(event: RecurringEvent, dateIST: string): boolean {
  const date = toDateOnlyIST(dateIST);
  if (event.active === false) return false;
  const recurrence = event.recurrence || 'none';
  const start = toDateOnlyIST(event.start_date || event.date);

  if (recurrence === 'none') return toDateOnlyIST(event.date || event.start_date) === date;
  if (start && date < start) return false;
  const end = toDateOnlyIST(event.end_date);
  if (end && date > end) return false;

  switch (recurrence) {
    case 'daily':
      return true;
    case 'weekly': {
      const days = event.weekdays?.length ? event.weekdays : start ? [weekdayOf(start)] : [];
      return days.includes(weekdayOf(date));
    }
    case 'monthly': {
      const wanted = event.day_of_month ?? (start ? Number(start.slice(8, 10)) : null);
      if (wanted == null) return false;
      // Day 31 in a 30-day month falls on the last day.
      return Number(date.slice(8, 10)) === Math.min(wanted, lastDayOfMonth(date));
    }
    case 'yearly':
      return !!start && isSameMonthDay(start, date);
    default:
      return false;
  }
}

/** First date on or after `from` the event occurs, or null if it never does again. */
export function nextOccurrence(event: RecurringEvent, from: string): string | null {
  const end = toDateOnlyIST(event.end_date);
  // A little over a year covers every pattern, including 29 Feb moved to 28 Feb.
  for (let i = 0, d = from; i <= 370; i += 1, d = shiftDate(d, 1)) {
    if (end && event.recurrence !== 'none' && d > end) return null;
    if (occursOn(event, d)) return d;
  }
  return null;
}

/** Every date from `from` to `to` (inclusive) the event occurs. */
export function occurrencesBetween(event: RecurringEvent, from: string, to: string): string[] {
  const out: string[] = [];
  const days = daysBetweenDates(from, to);
  for (let i = 0, d = from; i <= days; i += 1, d = shiftDate(d, 1)) {
    if (occursOn(event, d)) out.push(d);
  }
  return out;
}

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
}

/** "🔁 Daily", "🔁 Every Sunday", "🔁 Monthly (5th)", "🔁 Yearly"; null for one-time events. */
export function recurrenceBadge(event: RecurringEvent): string | null {
  const start = toDateOnlyIST(event.start_date || event.date);
  switch (event.recurrence) {
    case 'daily':
      return '🔁 Daily';
    case 'weekly': {
      const days = event.weekdays?.length ? event.weekdays : start ? [weekdayOf(start)] : [];
      return days.length ? `🔁 Every ${[...days].sort().map((d) => WEEKDAY_NAMES[d]).join(', ')}` : '🔁 Weekly';
    }
    case 'monthly': {
      const day = event.day_of_month ?? (start ? Number(start.slice(8, 10)) : null);
      return day ? `🔁 Monthly (${ordinal(day)})` : '🔁 Monthly';
    }
    case 'yearly':
      return '🔁 Yearly';
    default:
      return null;
  }
}

/** A special occasion as a recurring event. No recurrence saved means it follows recurring_yearly. */
export function occasionEvent(o: {
  occasion_date: string; recurring_yearly: boolean; active?: boolean | null; recurrence?: Recurrence | null;
  weekdays?: number[] | null; day_of_month?: number | null; start_date?: string | null; end_date?: string | null;
}): RecurringEvent {
  return {
    date: o.occasion_date,
    recurrence: o.recurrence || (o.recurring_yearly ? 'yearly' : 'none'),
    weekdays: o.weekdays,
    day_of_month: o.day_of_month,
    start_date: o.start_date || o.occasion_date,
    end_date: o.end_date,
    active: o.active,
  };
}

/** A sponsorship request as a recurring event. */
export function sponsorshipEvent(r: {
  special_date: string | null; active?: boolean | null; recurrence?: Recurrence | null;
  weekdays?: number[] | null; day_of_month?: number | null; start_date?: string | null; end_date?: string | null;
}): RecurringEvent {
  return {
    date: r.special_date,
    recurrence: r.recurrence || 'none',
    weekdays: r.weekdays,
    day_of_month: r.day_of_month,
    start_date: r.start_date || r.special_date,
    end_date: r.end_date,
    active: r.active,
  };
}

/** A monthly sponsor's donation day, from their payment day. */
export function monthlySponsorEvent(m: { payment_day: number | null; start_date: string | null; status: string }): RecurringEvent {
  return {
    recurrence: 'monthly',
    day_of_month: m.payment_day,
    start_date: m.start_date,
    active: m.status === 'active' && m.payment_day != null,
  };
}
