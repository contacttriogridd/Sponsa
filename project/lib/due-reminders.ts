import type { Sponsor, SpecialOccasion } from '@/lib/types';
import { getNextOccurrence } from '@/lib/date-utils';
import { OCCASION_ICONS } from '@/lib/constants';

// Kept free of the browser Supabase client so the server cron route can use it too.

export const DEFAULT_INTERVALS = [7, 3, 1, 0];

export interface DueReminder {
  occasion: SpecialOccasion;
  sponsor: Sponsor;
  daysBefore: number;
  occurrenceYear: number;
  title: string;
  message: string;
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function reminderLabel(daysBefore: number): string {
  if (daysBefore === 0) return 'is today';
  if (daysBefore === 1) return 'is tomorrow';
  return `is in ${daysBefore} days`;
}

/**
 * Returns every active occasion whose next occurrence lands on one of the
 * configured reminder intervals (7/3/1/0 days by default) as of `today`.
 */
export function getDueReminders(
  occasions: SpecialOccasion[],
  sponsors: Sponsor[],
  intervals: number[] = DEFAULT_INTERVALS,
  today: Date = new Date(),
): DueReminder[] {
  const sponsorMap = new Map(sponsors.map((s) => [s.id, s]));
  const todayKey = toDateKey(today);
  const due: DueReminder[] = [];

  for (const occasion of occasions) {
    const sponsor = sponsorMap.get(occasion.sponsor_id);
    if (!sponsor) continue;

    const next = getNextOccurrence(occasion.occasion_date, occasion.recurring_yearly, today);
    if (!next) continue;

    for (const daysBefore of intervals) {
      const reminderDate = new Date(next.date);
      reminderDate.setDate(reminderDate.getDate() - daysBefore);
      if (toDateKey(reminderDate) !== todayKey) continue;

      const icon = OCCASION_ICONS[occasion.occasion_type] || '⭐';
      due.push({
        occasion,
        sponsor,
        daysBefore,
        occurrenceYear: next.occurrenceYear,
        title: `${icon} ${occasion.person_name}'s ${occasion.occasion_type} ${reminderLabel(daysBefore)}`,
        message: `${sponsor.full_name} — consider reaching out about a sponsorship.`,
      });
    }
  }

  return due;
}
