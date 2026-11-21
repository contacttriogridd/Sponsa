/**
 * Donations are the single source of truth for money received: every screen
 * computes its totals from donation rows with these helpers. No section keeps
 * its own running total. Kept free of Supabase so it can be tested.
 */

export const DONATION_CATEGORIES = [
  'Monthly', 'Birthday', 'Star Birthday', 'Wedding Anniversary', 'Memorial (Thithi)', 'General', 'Annadhanam', 'Other',
] as const;
export type DonationCategory = (typeof DONATION_CATEGORIES)[number];

export const CATEGORY_META: Record<DonationCategory, { ta: string; icon: string }> = {
  Monthly: { ta: 'மாதாந்திர', icon: '🗓️' },
  Birthday: { ta: 'பிறந்தநாள்', icon: '🎂' },
  'Star Birthday': { ta: 'நட்சத்திர பிறந்தநாள்', icon: '⭐' },
  'Wedding Anniversary': { ta: 'திருமண நாள்', icon: '💍' },
  'Memorial (Thithi)': { ta: 'நினைவு நாள் (திதி)', icon: '🪔' },
  General: { ta: 'பொது', icon: '🙏' },
  Annadhanam: { ta: 'அன்னதானம்', icon: '🍛' },
  Other: { ta: 'பிற', icon: '✨' },
};

/** Payment modes offered when recording a donation. */
export const PAYMENT_MODES = ['Cash', 'UPI', 'Bank Transfer', 'Cheque'] as const;

interface DonationLike {
  amount: number | string | null;
  sponsor_category?: string | null;
  sponsor_type?: string | null;
  monthly_sponsor_id?: string | null;
  type?: string | null;
  donation_date: string;
  occasion_date?: string | null;
}

/** The donation's category; rows from before migration 00027 are classified the same way the migration does. */
export function categoryOf(d: DonationLike): DonationCategory {
  if (d.sponsor_category && (DONATION_CATEGORIES as readonly string[]).includes(d.sponsor_category)) return d.sponsor_category as DonationCategory;
  if (d.sponsor_type === 'monthly' || d.monthly_sponsor_id) return 'Monthly';
  return d.type === 'Food' ? 'Annadhanam' : 'General';
}

export const amountOf = (d: Pick<DonationLike, 'amount'>): number => {
  const n = Number(d.amount);
  return Number.isFinite(n) ? n : 0;
};

export function sumDonations(list: Pick<DonationLike, 'amount'>[]): number {
  return list.reduce((a, d) => a + amountOf(d), 0);
}

/** Amount and count per category, every category listed, plus the total. */
export function totalsByCategory(list: DonationLike[]): { rows: { category: DonationCategory; count: number; amount: number }[]; total: number; count: number } {
  const rows = DONATION_CATEGORIES.map((category) => ({ category, count: 0, amount: 0 }));
  for (const d of list) {
    const row = rows.find((r) => r.category === categoryOf(d))!;
    row.count++;
    row.amount += amountOf(d);
  }
  return { rows, total: sumDonations(list), count: list.length };
}

/** The month a donation counts towards: the sponsored month (occasion_date) when set, else the date received. */
export function donationMonth(d: Pick<DonationLike, 'donation_date' | 'occasion_date'>): string {
  return `${(d.occasion_date || d.donation_date).slice(0, 7)}-01`;
}

/** Donations received in the calendar month of `month` (YYYY-MM-01), by date received. */
export function receivedInMonth<T extends Pick<DonationLike, 'donation_date'>>(list: T[], month: string): T[] {
  return list.filter((d) => d.donation_date.slice(0, 7) === month.slice(0, 7));
}

/** Donation total per sponsor id (sponsor_id or monthly_sponsor_id). */
export function totalsBySponsor(list: (DonationLike & { sponsor_id?: string | null })[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of list) {
    const id = d.sponsor_id || d.monthly_sponsor_id;
    if (id) out.set(id, (out.get(id) || 0) + amountOf(d));
  }
  return out;
}
