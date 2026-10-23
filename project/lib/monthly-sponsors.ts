import type { MonthlyPayment, MonthlySponsor } from '@/lib/types';
import { RAASIS, STARS, raasisOfStar } from '@/lib/natchathiram';
import { addDays, starDaysFor, type StarCalendarDay, type StarDayOccurrence } from '@/lib/star-days';
import { formatCurrency } from '@/lib/constants';

// Pure helpers (no Supabase) shared by pages, the reminder engine and the cron job.

export const DEFAULT_STAR_REMINDER_DAYS = 2;

export const MONTHLY_STATUS_LABELS: Record<MonthlySponsor['status'], string> = {
  active: 'Active',
  paused: 'Paused',
  stopped: 'Stopped',
};

/** Today's date in IST as YYYY-MM-DD. */
export function todayIst(): string {
  return new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}

export function monthKey(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 10);
}

/** Payment due date in a month, moving day 29–31 to the month's last day when needed. */
export function paymentDueDate(paymentDay: number, month: string): string {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month.slice(0, 8)}${String(Math.min(paymentDay, last)).padStart(2, '0')}`;
}

/** e.g. "Sat, 31 Oct 2026". */
export function formatStarDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** e.g. "7:12 am, 31 Oct" in IST. */
export function formatIstTime(iso: string, withDate = true): string {
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true,
    ...(withDate ? { day: 'numeric', month: 'short' } : {}),
  });
}

/** Raasi to show for a sponsor: the stored one, else the star's Raasi when it has only one. */
export function effectiveRaasi(sponsor: Pick<MonthlySponsor, 'raasi' | 'star'>): number | null {
  if (sponsor.raasi != null) return sponsor.raasi;
  if (sponsor.star == null) return null;
  const r = raasisOfStar(sponsor.star);
  return r.length === 1 ? r[0] : null;
}

export interface UpcomingStarDay {
  sponsor: MonthlySponsor;
  occurrence: StarDayOccurrence;
  daysUntil: number;
}

/**
 * Star days of active sponsors from `from` for `days` days. `rows` should
 * start a day before `from` so a star that also covered the previous sunrise
 * isn't counted twice.
 */
export function upcomingStarDays(sponsors: MonthlySponsor[], rows: StarCalendarDay[], from: string, days: number): UpcomingStarDay[] {
  const to = addDays(from, days - 1);
  const out: UpcomingStarDay[] = [];
  for (const sponsor of sponsors) {
    if (sponsor.status !== 'active' || sponsor.star == null) continue;
    for (const occurrence of starDaysFor(sponsor.star, rows)) {
      if (occurrence.date >= from && occurrence.date <= to) {
        out.push({ sponsor, occurrence, daysUntil: daysBetween(from, occurrence.date) });
      }
    }
  }
  return out.sort((a, b) => a.occurrence.date.localeCompare(b.occurrence.date) || a.sponsor.name.localeCompare(b.sponsor.name));
}

export interface PaymentDue {
  sponsor: MonthlySponsor;
  month: string;
  dueDate: string;
  /** Negative when overdue. */
  daysUntil: number;
}

/**
 * Unpaid contributions that are due within `leadDays` days or already overdue
 * this month, for active sponsors with a payment day.
 */
export function paymentsDue(sponsors: MonthlySponsor[], payments: MonthlyPayment[], today: string, leadDays: number): PaymentDue[] {
  const paid = new Set(payments.filter((p) => p.status === 'paid').map((p) => `${p.monthly_sponsor_id}|${p.month}`));
  const out: PaymentDue[] = [];
  for (const sponsor of sponsors) {
    if (sponsor.status !== 'active' || !sponsor.payment_day) continue;
    for (const month of [monthKey(today), shiftMonth(monthKey(today), 1)]) {
      const dueDate = paymentDueDate(sponsor.payment_day, month);
      const daysUntil = daysBetween(today, dueDate);
      const relevant = month === monthKey(today) ? daysUntil <= leadDays : daysUntil <= leadDays && daysUntil >= 0;
      if (relevant && !paid.has(`${sponsor.id}|${month}`)) out.push({ sponsor, month, dueDate, daysUntil });
    }
  }
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

/** Variables for the Star Day Wish template. */
export function starWishVariables(sponsor: MonthlySponsor, starDate: string): Record<string, string> {
  const raasi = effectiveRaasi(sponsor);
  return {
    sponsor_name: sponsor.name,
    star_name: sponsor.star != null ? STARS[sponsor.star].ta : '',
    raasi_name: raasi != null ? RAASIS[raasi].ta : '',
    star_date: formatStarDate(starDate),
    monthly_amount: sponsor.monthly_amount != null ? formatCurrency(Number(sponsor.monthly_amount)) : '',
  };
}

export function whenLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  if (daysUntil < 0) return `${-daysUntil} day${daysUntil === -1 ? '' : 's'} overdue`;
  return `In ${daysUntil} days`;
}
