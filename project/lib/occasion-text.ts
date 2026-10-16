import type { SpecialOccasion } from './types';

// Plain-English wording for a special occasion, shared by every screen that
// lists occasions (and safe for the server cron, as it has no browser imports).

type OccasionLike = Pick<SpecialOccasion, 'person_name' | 'relationship' | 'occasion_type' | 'occasion_date'>;

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parses `YYYY-MM-DD` without the UTC shift `new Date(string)` applies. */
function parts(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return { y, m, d };
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th'}`;
}

function isSelf(o: OccasionLike, sponsorName?: string): boolean {
  const rel = (o.relationship || '').trim();
  if (!rel || rel.toLowerCase() === 'self') return true;
  return !!sponsorName && o.person_name.trim().toLowerCase() === sponsorName.trim().toLowerCase();
}

/**
 * Whose day it is, e.g. "Death Anniversary of Lakshmi" or, for the sponsor's
 * own day, "Kiran's Wedding Anniversary".
 */
export function occasionHeadline(o: OccasionLike, sponsorName?: string): string {
  const type = o.occasion_type === 'Other' ? 'Special Day' : o.occasion_type;
  if (isSelf(o, sponsorName)) return `${o.person_name}'s ${type}`;
  return `${type} of ${o.person_name}`;
}

/** How the person is related to the sponsor, e.g. "yokash's grandma"; null for the sponsor's own day. */
export function occasionRelation(o: OccasionLike, sponsorName: string): string | null {
  if (isSelf(o, sponsorName)) return null;
  return `${sponsorName}'s ${(o.relationship || '').trim().toLowerCase()}`;
}

/**
 * What the original date means plus the milestone on the next occurrence,
 * e.g. "Passed away on 12 Nov 2008 · 18th year of remembrance".
 */
export function occasionDateLine(o: OccasionLike, nextYear?: number): string {
  const { y, m, d } = parts(o.occasion_date);
  const date = `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
  const years = nextYear ? nextYear - y : 0;

  switch (o.occasion_type) {
    case 'Birthday':
      return `Born on ${date}${years > 0 ? ` · turns ${years}` : ''}`;
    case 'Wedding Anniversary':
      return `Married on ${date}${years > 0 ? ` · ${ordinal(years)} anniversary` : ''}`;
    case 'Death Anniversary':
      return `Passed away on ${date}${years > 0 ? ` · ${ordinal(years)} year of remembrance` : ''}`;
    case 'Business Anniversary':
      return `Started on ${date}${years > 0 ? ` · ${years} year${years === 1 ? '' : 's'}` : ''}`;
    default:
      return `Date: ${date}`;
  }
}
