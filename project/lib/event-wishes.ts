/**
 * "Monthly Event" sponsorship: monthly sponsors who give on a recurring Tamil
 * calendar event (Pournami, Pradosham, …) instead of, or as well as, their
 * star day. The events are the Star Calendar's (lib/observances.ts), with the
 * same keys, so both stay in sync. Kept free of Supabase so it can be tested.
 */

import { dropMissingAmounts } from '@/lib/amount';
import { OBSERVANCE_KEYS, OBSERVANCE_META, PAKSHA_EVENTS, type ObservanceKey, type ObservanceView, type Paksha } from '@/lib/observances';
import type { OrganizationNames } from '@/lib/organization';

export type EventPaksha = 'both' | Paksha;

/** One entry of monthly_sponsors.sponsor_events. */
export interface SponsorEvent {
  event_key: ObservanceKey;
  /** ₹ for this event; null falls back to the sponsor's monthly amount. */
  amount: number | null;
  /** Only for Ekadashi, Pradosham and Sashti. */
  paksha: EventPaksha;
}

export const PAKSHA_OPTIONS: { value: EventPaksha; ta: string; en: string }[] = [
  { value: 'both', ta: 'இரண்டும்', en: 'Both' },
  { value: 'valarpirai', ta: 'வளர்பிறை', en: 'Valarpirai' },
  { value: 'theipirai', ta: 'தேய்பிறை', en: 'Theipirai' },
];

export function hasPaksha(key: ObservanceKey): boolean {
  return PAKSHA_EVENTS.includes(key);
}

/** The saved array, cleaned: unknown keys dropped, one entry per event, legend order. */
export function sponsorEventsOf(sponsor: { sponsor_events?: unknown }): SponsorEvent[] {
  const raw = Array.isArray(sponsor.sponsor_events) ? sponsor.sponsor_events : [];
  const byKey = new Map<ObservanceKey, SponsorEvent>();
  for (const e of raw as Partial<SponsorEvent>[]) {
    if (!e || !OBSERVANCE_KEYS.includes(e.event_key as ObservanceKey) || byKey.has(e.event_key as ObservanceKey)) continue;
    const key = e.event_key as ObservanceKey;
    const amount = e.amount == null || e.amount === ('' as unknown) || !Number.isFinite(Number(e.amount)) || Number(e.amount) < 0 ? null : Number(e.amount);
    const paksha: EventPaksha = hasPaksha(key) && (e.paksha === 'valarpirai' || e.paksha === 'theipirai') ? e.paksha : 'both';
    byKey.set(key, { event_key: key, amount, paksha });
  }
  return OBSERVANCE_KEYS.filter((k) => byKey.has(k)).map((k) => byKey.get(k)!);
}

/** True when the sponsor's event entry covers this calendar event (and its paksha, when set). */
export function matchesEvent(entry: SponsorEvent, event: Pick<ObservanceView, 'event_key' | 'label'>): boolean {
  if (entry.event_key !== event.event_key) return false;
  if (entry.paksha === 'both' || !hasPaksha(entry.event_key)) return true;
  // Phase unknown (edge of the data): don't drop the sponsor.
  return event.label.paksha == null || event.label.paksha === entry.paksha;
}

interface EligibleSponsor {
  id: string;
  status: string;
  start_date: string | null;
  monthly_amount: number | null;
  sponsor_events?: unknown;
  family_of?: unknown;
}

/** Active, already started on that date, and a sponsor in their own right (not a family member's star entry). */
export function isEligibleOn(sponsor: EligibleSponsor, date: string): boolean {
  return sponsor.status === 'active' && !sponsor.family_of && (!sponsor.start_date || sponsor.start_date <= date);
}

export interface EventWish<S extends EligibleSponsor> {
  sponsor: S;
  /** The day's events this sponsor gives on (one message lists them all). */
  events: ObservanceView[];
  /** Sum of each event's amount (or the monthly amount); null when none is set. */
  amount: number | null;
}

/** Amount for one event entry: its own amount, else the sponsor's monthly amount. */
export function entryAmount(entry: SponsorEvent, sponsor: Pick<EligibleSponsor, 'monthly_amount'>): number | null {
  if (entry.amount != null) return entry.amount;
  return sponsor.monthly_amount != null ? Number(sponsor.monthly_amount) : null;
}

/** Sponsors to wish on `date`, given that day's calendar events. Each sponsor appears once. */
export function eventWishesOn<S extends EligibleSponsor>(sponsors: S[], dayEvents: ObservanceView[], date: string): EventWish<S>[] {
  const today = dayEvents.filter((e) => e.on === date && !e.is_hidden);
  const out: EventWish<S>[] = [];
  for (const sponsor of sponsors) {
    if (!isEligibleOn(sponsor, date)) continue;
    const entries = sponsorEventsOf(sponsor);
    const events: ObservanceView[] = [];
    let amount: number | null = null;
    for (const event of today) {
      const entry = entries.find((e) => matchesEvent(e, event));
      if (!entry) continue;
      events.push(event);
      const a = entryAmount(entry, sponsor);
      if (a != null) amount = (amount ?? 0) + a;
    }
    if (events.length) out.push({ sponsor, events, amount });
  }
  return out;
}

/** The sponsor's next event on or after `from`, from a date-sorted list of calendar events. */
export function nextSponsorEvent(sponsor: EligibleSponsor, events: ObservanceView[], from: string): ObservanceView | null {
  const entries = sponsorEventsOf(sponsor);
  if (!entries.length) return null;
  return events.find((e) => e.on >= from && !e.is_hidden && (!sponsor.start_date || e.on >= sponsor.start_date) && entries.some((x) => matchesEvent(x, e))) || null;
}

/** Events grouped by date, for "next event day" and the Upcoming list. */
export function eventDays(events: ObservanceView[]): { date: string; events: ObservanceView[] }[] {
  const map = new Map<string, ObservanceView[]>();
  for (const e of events) if (!e.is_hidden) map.set(e.on, [...(map.get(e.on) || []), e]);
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([date, list]) => ({ date, events: list }));
}

// ---------------------------------------------------------------- message

export const EVENT_WISH_PLACEHOLDERS = ['{{sponsor_name}}', '{{event_name_ta}}', '{{event_name_en}}', '{{date}}', '{{amount}}', '{{organization_name}}'] as const;

export const DEFAULT_EVENT_WISH_TA = `வணக்கம் {{sponsor_name}} அவர்களே 🙏
இன்று {{event_name_ta}} ({{event_name_en}}) – {{date}}.
உங்கள் அன்பான அன்னதான நன்கொடைக்கு நன்றி. வள்ளலார் அருளால் உங்கள் குடும்பம் எல்லா நலமும் பெற வாழ்த்துகிறோம்.
– {{organization_name}}`;

export const DEFAULT_EVENT_WISH_EN = `Vanakkam {{sponsor_name}} 🙏
Today is {{event_name_en}} ({{event_name_ta}}) – {{date}}.
Thank you for your kind Annadhanam donation. By Vallalar's grace, we wish your family every happiness and good health.
– {{organization_name}}`;

export interface EventWishTemplate {
  event_key: ObservanceKey;
  body_ta: string;
  body_en: string;
}

/** Saved templates (event_wish_templates rows) with the defaults for any missing or empty one. */
export function eventWishTemplatesFrom(rows: Partial<EventWishTemplate>[] | null | undefined): Record<ObservanceKey, EventWishTemplate> {
  const out = {} as Record<ObservanceKey, EventWishTemplate>;
  for (const key of OBSERVANCE_KEYS) {
    const row = (rows || []).find((r) => r.event_key === key);
    out[key] = {
      event_key: key,
      body_ta: row?.body_ta?.trim() ? row.body_ta : DEFAULT_EVENT_WISH_TA,
      body_en: row?.body_en?.trim() ? row.body_en : DEFAULT_EVENT_WISH_EN,
    };
  }
  return out;
}

/** "VP TRUST – வள்ளலார் பசியாற்றும் அறக்கட்டளை" */
export function eventOrganizationName(names: OrganizationNames): string {
  return [names.org_name_en, names.org_name_ta].map((n) => n.trim()).filter(Boolean).join(' – ');
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "24 Nov 2026" */
export function eventDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** ₹ in Indian style, no decimals; empty when there is no amount. */
export function eventAmount(amount: number | null): string {
  if (amount == null || !Number.isFinite(amount) || amount <= 0) return '';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

/** Fills the placeholders; one with no value becomes empty, so a raw {{…}} never goes out. */
export function fillEventTemplate(body: string, data: Record<string, string>): string {
  return dropMissingAmounts(body, data).replace(/\r\n?/g, '\n').replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => data[key] ?? '');
}

/**
 * The wish for one sponsor on one day: the Tamil text, a blank line, then the
 * English text. Two events on the day make one message: the first event's
 * template (legend order), with both names and the amounts added up.
 */
export function buildEventWishMessage(
  templates: Record<ObservanceKey, EventWishTemplate>,
  sponsorName: string,
  events: Pick<ObservanceView, 'event_key' | 'label'>[],
  date: string,
  amount: number | null,
  organization: OrganizationNames,
): string {
  if (!events.length) return '';
  const template = templates[events[0].event_key];
  const data = {
    sponsor_name: sponsorName.trim(),
    event_name_ta: events.map((e) => e.label.ta).join(' & '),
    event_name_en: events.map((e) => e.label.en).join(' & '),
    date: eventDate(date),
    amount: eventAmount(amount),
    organization_name: eventOrganizationName(organization),
  };
  return [fillEventTemplate(template.body_ta, data), fillEventTemplate(template.body_en, data)].map((t) => t.trim()).filter(Boolean).join('\n\n');
}

/** Short label for chips and filters: "🌕 பௌர்ணமி · Pournami". */
export function eventChipLabel(key: ObservanceKey): string {
  const m = OBSERVANCE_META[key];
  return `${m.icon} ${m.ta} · ${m.short}`;
}
