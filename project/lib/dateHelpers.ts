/**
 * Calendar dates in India time. Every reminder comparison uses YYYY-MM-DD
 * strings from here, never Date objects with times attached, so results don't
 * depend on the browser's or server's timezone.
 */

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 86400000;

/** Today in IST as YYYY-MM-DD. */
export function getTodayIST(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Any stored date or timestamp as YYYY-MM-DD in IST. A plain date is returned as it is. */
export function toDateOnlyIST(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : getTodayIST(d);
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * True when stored date `a` falls on the same month and day as `b`, ignoring
 * the year. A 29 Feb date counts as 28 Feb in a non-leap year of `b`.
 */
export function isSameMonthDay(a: string, b: string): boolean {
  const ad = toDateOnlyIST(a);
  const bd = toDateOnlyIST(b);
  if (!ad || !bd) return false;
  if (ad.slice(5) === bd.slice(5)) return true;
  return ad.slice(5) === '02-29' && bd.slice(5) === '02-28' && !isLeap(Number(bd.slice(0, 4)));
}

function dayNumber(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / DAY_MS;
}

/** Whole days from `from` to `to` (YYYY-MM-DD). */
export function daysBetweenDates(from: string, to: string): number {
  return Math.round(dayNumber(to) - dayNumber(from));
}

function occurrenceIn(stored: string, year: number): string {
  const md = stored.slice(5);
  return `${year}-${md === '02-29' && !isLeap(year) ? '02-28' : md}`;
}

export type ReminderGroup = 'today' | 'upcoming' | 'past';

export interface ReminderTiming {
  group: ReminderGroup;
  /** The date this classification refers to (the relevant occurrence for yearly dates). */
  date: string;
  /** Days from today: 0 today, positive upcoming, negative past. */
  days: number;
}

/**
 * Puts a date in exactly one group. A yearly date is TODAY on its month/day,
 * PAST for `pastWindow` days afterwards, and otherwise UPCOMING (next occurrence).
 */
export function classifyDate(stored: string, recurring: boolean, today: string, pastWindow = 7): ReminderTiming {
  const date = toDateOnlyIST(stored);
  if (!recurring) {
    const days = daysBetweenDates(today, date);
    return { group: days === 0 ? 'today' : days > 0 ? 'upcoming' : 'past', date, days };
  }
  if (isSameMonthDay(date, today)) return { group: 'today', date: today, days: 0 };
  const year = Number(today.slice(0, 4));
  const thisYear = occurrenceIn(date, year);
  const last = thisYear < today ? thisYear : occurrenceIn(date, year - 1);
  const next = thisYear > today ? thisYear : occurrenceIn(date, year + 1);
  const since = daysBetweenDates(last, today);
  if (since <= pastWindow) return { group: 'past', date: last, days: -since };
  return { group: 'upcoming', date: next, days: daysBetweenDates(today, next) };
}

/** Milliseconds until the next midnight in IST. */
export function msUntilNextMidnightIST(now: Date = new Date()): number {
  const ist = now.getTime() + IST_OFFSET_MS;
  return DAY_MS - (ist % DAY_MS);
}
