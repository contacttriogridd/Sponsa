import type { SpecialOccasion, Sponsor, UpcomingOccasion } from './types';

/**
 * Calculate the next annual occurrence of a recurring date.
 * Handles Feb 29 leap year birthdays by rolling to Feb 28 on non-leap years.
 */
export function getNextOccurrence(
  occasionDate: string | Date,
  recurring: boolean,
  from: Date = new Date()
): { date: Date; occurrenceYear: number } | null {
  const base = typeof occasionDate === 'string' ? new Date(occasionDate) : occasionDate;
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  if (!recurring) {
    // Non-recurring: only if it's in the future
    const d = new Date(base);
    if (d >= today) return { date: d, occurrenceYear: d.getFullYear() };
    return null;
  }

  // For recurring occasions, find the next occurrence this year or next
  const year = today.getFullYear();
  const month = base.getMonth();
  const day = base.getDate();

  // Handle Feb 29 on non-leap years
  let actualDay = day;
  if (month === 1 && day === 29) {
    const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    if (!isLeap(year)) actualDay = 28;
    if (!isLeap(year + 1)) {
      // next year also not leap, actualDay stays 28 for year+1 check
    }
  }

  let nextDate = new Date(year, month, actualDay);
  if (nextDate < today) {
    // Try next year
    const nextYear = year + 1;
    let nextDay = day;
    if (month === 1 && day === 29) {
      const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      if (!isLeap(nextYear)) nextDay = 28;
    }
    nextDate = new Date(nextYear, month, nextDay);
  }

  return { date: nextDate, occurrenceYear: nextDate.getFullYear() };
}

/**
 * Calculate days until a date (0 = today, 1 = tomorrow, etc.)
 */
export function daysUntil(targetDate: Date, from: Date = new Date()): number {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  const diff = target.getTime() - today.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

/**
 * Get all upcoming occasions within a given number of days.
 */
export function getUpcomingOccasions(
  occasions: SpecialOccasion[],
  sponsors: Sponsor[],
  withinDays: number = 30,
  from: Date = new Date()
): UpcomingOccasion[] {
  const sponsorMap = new Map(sponsors.map((s) => [s.id, s]));
  const results: UpcomingOccasion[] = [];

  for (const occasion of occasions) {
    if (!occasion.active) continue;
    const sponsor = sponsorMap.get(occasion.sponsor_id);
    if (!sponsor || sponsor.status === 'archived') continue;

    const next = getNextOccurrence(occasion.occasion_date, occasion.recurring_yearly, from);
    if (!next) continue;

    const days = daysUntil(next.date, from);
    if (days >= 0 && days <= withinDays) {
      results.push({
        occasion,
        sponsor,
        nextDate: next.date,
        daysUntil: days,
        occurrenceYear: next.occurrenceYear,
      });
    }
  }

  results.sort((a, b) => a.daysUntil - b.daysUntil);
  return results;
}

/**
 * Get occasions for a specific date (matching month and day).
 */
export function getOccasionsOnDate(
  occasions: SpecialOccasion[],
  sponsors: Sponsor[],
  date: Date
): UpcomingOccasion[] {
  const sponsorMap = new Map(sponsors.map((s) => [s.id, s]));
  const results: UpcomingOccasion[] = [];

  for (const occasion of occasions) {
    if (!occasion.active) continue;
    const sponsor = sponsorMap.get(occasion.sponsor_id);
    if (!sponsor) continue;

    const occDate = new Date(occasion.occasion_date);
    if (occDate.getMonth() === date.getMonth() && occDate.getDate() === date.getDate()) {
      const next = getNextOccurrence(occasion.occasion_date, occasion.recurring_yearly, date);
      results.push({
        occasion,
        sponsor,
        nextDate: date,
        daysUntil: 0,
        occurrenceYear: next ? next.occurrenceYear : date.getFullYear(),
      });
    }
  }

  return results;
}

/**
 * Generate reminder dates for an occasion based on intervals.
 */
export function getReminderDates(
  occasionDate: Date,
  intervals: number[]
): { date: Date; daysBefore: number }[] {
  return intervals.map((daysBefore) => {
    const d = new Date(occasionDate);
    d.setDate(d.getDate() - daysBefore);
    return { date: d, daysBefore };
  });
}

/**
 * Check if a date is today.
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if a date is tomorrow.
 */
export function isTomorrow(date: Date): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear()
  );
}

/**
 * Get a relative day label.
 */
export function getRelativeDayLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  if (daysUntil === -1) return 'Yesterday';
  if (daysUntil > 1) return `In ${daysUntil} days`;
  return `${Math.abs(daysUntil)} days ago`;
}
