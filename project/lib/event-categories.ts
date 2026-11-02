import { nextOccurrenceOf } from '@/lib/date-utils';
import { occasionKeyOf } from '@/lib/occasion-details';
import type { SpecialOccasion } from '@/lib/types';

// Groups each sponsor's saved occasions into the Sponsors page tabs.

export type EventCategory = 'birthday' | 'child_birthday' | 'wedding_anniversary' | 'death_anniversary' | 'other';
export type EventTab = 'all' | EventCategory;

export const EVENT_TABS: { key: EventTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'birthday', label: 'Birthday' },
  { key: 'child_birthday', label: 'Child Birthday' },
  { key: 'wedding_anniversary', label: 'Wedding Anniversary' },
  { key: 'death_anniversary', label: 'Death Anniversary' },
  { key: 'other', label: 'Other Events' },
];

export const EVENT_LABELS: Record<EventCategory, string> = {
  birthday: 'Birthday',
  child_birthday: 'Child Birthday',
  wedding_anniversary: 'Wedding Anniversary',
  death_anniversary: 'Death Anniversary',
  other: 'Other',
};

const CHILD_RELATIONS = ['son', 'daughter', 'grandson', 'granddaughter', 'child', 'kid'];

/** Free text such as "child bday", "Kid's Birthday" or "anniversary", matched without case. */
export function categoryFromText(text: string | null | undefined): EventCategory | null {
  const t = (text || '').toLowerCase();
  if (!t.trim()) return null;
  if (/death|remembrance|memorial|thithi|neenaivu|நினைவு/.test(t)) return 'death_anniversary';
  if (/anniversary|wedding|marriage|திருமண/.test(t) && !/business|company|shop/.test(t)) return 'wedding_anniversary';
  if (/birth|bday|b'day|பிறந்த/.test(t)) return /child|kid|son|daughter|baby|grand/.test(t) ? 'child_birthday' : 'birthday';
  return null;
}

export function eventCategoryOf(o: SpecialOccasion): EventCategory {
  const key = occasionKeyOf(o);
  if (key === 'self_birthday') return 'birthday';
  if (key === 'family_birthday') {
    return CHILD_RELATIONS.includes((o.relationship || '').trim().toLowerCase()) ? 'child_birthday' : 'birthday';
  }
  if (key === 'wedding_anniversary') return 'wedding_anniversary';
  if (key === 'death_anniversary') return 'death_anniversary';
  // Admin-added types and older free-text events.
  return categoryFromText(o.occasion_name_en) || categoryFromText(o.occasion_type === 'Other' ? o.notes : o.occasion_type) || 'other';
}

export interface SponsorEvent {
  occasion: SpecialOccasion;
  category: EventCategory;
  /** Next date, or null if a one-time event has passed. */
  next: Date | null;
}

/** Each sponsor's active events, nearest first. */
export function eventsBySponsor(occasions: SpecialOccasion[], from: Date = new Date()): Map<string, SponsorEvent[]> {
  const map = new Map<string, SponsorEvent[]>();
  for (const o of occasions) {
    if (!o.active) continue;
    const event = { occasion: o, category: eventCategoryOf(o), next: nextOccurrenceOf(o, from)?.date || null };
    map.set(o.sponsor_id, [...(map.get(o.sponsor_id) || []), event]);
  }
  for (const list of Array.from(map.values())) list.sort(byNext);
  return map;
}

export function byNext(a: { next: Date | null }, b: { next: Date | null }): number {
  if (!a.next) return b.next ? 1 : 0;
  if (!b.next) return -1;
  return a.next.getTime() - b.next.getTime();
}

export function isEventTab(value: string | null): value is EventTab {
  return EVENT_TABS.some((t) => t.key === value);
}
