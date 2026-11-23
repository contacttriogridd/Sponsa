/**
 * Sponsorships → "Upcoming (3 days)": every sponsor event in the next 3 days
 * (IST), whether or not a sponsorship request exists yet, with its status and
 * the D-3 / D-2 / D-1 reminder slots. Built from the dashboard's reminder
 * items, so the next occurrence follows the same rules everywhere — yearly
 * birthdays and anniversaries, Star Birthday / Thithi dates per year, monthly
 * donation days. Pure, so it can be tested.
 */

import { daysBetweenDates } from '@/lib/dateHelpers';
import { shiftDate } from '@/lib/recurrence';
import type { ReminderItem } from '@/lib/today-reminders';
import type { SponsorshipRequest } from '@/lib/types';

export type Stage = 'D-3' | 'D-2' | 'D-1';
export const STAGES: Stage[] = ['D-3', 'D-2', 'D-1'];

export interface ReminderRow {
  id: string;
  sponsorship_id?: string | null;
  sponsor_id?: string | null;
  monthly_sponsor_id?: string | null;
  event_key: string;
  event_date: string;
  stage: Stage;
  sent_at: string;
  sent_by_name?: string | null;
  channel: 'whatsapp' | 'sms' | 'call' | 'email' | 'manual';
  message_preview?: string | null;
}

export interface Slot {
  stage: Stage;
  /** The day this reminder is due (event date minus 3, 2 or 1). */
  due: string;
  state: 'sent' | 'due' | 'pending' | 'missed';
  sent: ReminderRow | null;
}

export interface UpcomingEvent {
  /** The event's id (occ:<id>, dob:<id>, mspay:<id>, …) without the "#next" suffix. */
  key: string;
  item: ReminderItem;
  date: string;
  /** 0 = today … 3 = in 3 days. */
  days: number;
  name: string;
  category: string;
  occasion: string;
  foodType: string | null;
  people: number | null;
  amount: number | null;
  record: SponsorshipRequest | null;
  /** The record's status, or "not_requested". */
  status: string;
  slots: Slot[];
}

export const GROUPS = [
  { days: 0, en: 'Today', ta: 'இன்று' },
  { days: 1, en: '1 day before / Tomorrow', ta: 'நாளை' },
  { days: 2, en: '2 days before', ta: '2 நாட்களில்' },
  { days: 3, en: '3 days before', ta: '3 நாட்களில்' },
];

export const NOT_REQUESTED = 'not_requested';

export const eventKeyOf = (key: string) => key.replace(/#next$/, '');

/** Category label for an event, matching the donation categories. */
export function eventCategory(item: Pick<ReminderItem, 'key' | 'kind' | 'calm' | 'occasionRecord'>): string {
  if (item.key.startsWith('mspay:')) return 'Monthly';
  const o = item.occasionRecord;
  if (o?.occasion_type_key === 'star_birthday') return 'Star Birthday';
  if (item.calm) return 'Memorial (Thithi)';
  if (item.kind === 'birthday') return 'Birthday';
  if (o?.occasion_type === 'Wedding Anniversary' || o?.occasion_type_key === 'wedding_anniversary') return 'Wedding Anniversary';
  if (item.key.startsWith('req:')) return 'Sponsorship';
  return o ? 'Other' : 'General';
}

/** The sponsorship request for this event occurrence, if one exists. */
export function matchRecord(item: ReminderItem, date: string, requests: SponsorshipRequest[]): SponsorshipRequest | null {
  const key = eventKeyOf(item.key);
  if (key.startsWith('req:')) return requests.find((r) => r.id === key.slice(4)) || null;
  return requests.find((r) => {
    if (r.special_date !== date) return false;
    if (item.monthlySponsor && !item.sponsor) return r.monthly_sponsor_id === item.monthlySponsor.id;
    if (key.startsWith('mspay:')) return r.monthly_sponsor_id === key.slice(6);
    if (!item.sponsor || r.sponsor_id !== item.sponsor.id) return false;
    if (item.occasionRecord) return r.occasion_id === item.occasionRecord.id || eventKeyOf(r.related_event_id || '') === key || (!r.occasion_id && !r.related_event_id);
    return !r.occasion_id && (!r.related_event_id || eventKeyOf(r.related_event_id) === key);
  }) || null;
}

/** The three reminder slots for an event on `date`, as of `today`. */
export function slotsFor(key: string, date: string, reminders: ReminderRow[], today: string): Slot[] {
  return STAGES.map((stage) => {
    const n = Number(stage.slice(2));
    const due = shiftDate(date, -n);
    const sent = reminders.find((r) => r.event_key === key && r.event_date === date && r.stage === stage) || null;
    const state: Slot['state'] = sent ? 'sent' : due < today ? 'missed' : due === today ? 'due' : 'pending';
    return { stage, due, state, sent };
  });
}

/** Today's stage for an event `days` away (D-3 / D-2 / D-1), or null on the day itself. */
export const stageForDays = (days: number): Stage | null => (days >= 1 && days <= 3 ? (`D-${days}` as Stage) : null);

/**
 * Every event from today to 3 days ahead (one entry per event and date),
 * sorted by date then name. Today's donations are not events and are left out.
 */
export function upcomingEvents(items: ReminderItem[], requests: SponsorshipRequest[], reminders: ReminderRow[], today: string): UpcomingEvent[] {
  const seen = new Set<string>();
  const out: UpcomingEvent[] = [];
  for (const item of items) {
    if (item.kind === 'donation' || item.group === 'past') continue;
    const days = daysBetweenDates(today, item.date);
    if (days < 0 || days > 3) continue;
    const key = eventKeyOf(item.key);
    if (seen.has(`${key}|${item.date}`)) continue;
    seen.add(`${key}|${item.date}`);
    const record = matchRecord(item, item.date, requests);
    const amount = record?.requested_amount ?? item.monthlySponsor?.monthly_amount ?? item.sponsor?.sponsorship_amount ?? null;
    out.push({
      key, item, date: item.date, days,
      name: item.contactName && item.contactName !== item.name ? `${item.name} (${item.contactName})` : item.name,
      category: record?.category || eventCategory(item),
      occasion: item.occasion,
      foodType: record?.food_type || item.donationType || null,
      people: record?.people_count ?? null,
      amount: amount == null ? null : Number(amount),
      record,
      status: record?.status || NOT_REQUESTED,
      slots: slotsFor(key, item.date, reminders, today),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}

/** Upcoming events whose reminder for today's stage has not been sent yet. */
export function remindersPendingToday(events: UpcomingEvent[]): UpcomingEvent[] {
  return events.filter((e) => {
    const stage = stageForDays(e.days);
    return stage && e.slots.find((s) => s.stage === stage)?.state === 'due';
  });
}

/** "Reminder sent" tab: every event with at least one reminder, newest event first. */
export function remindersSentByEvent(reminders: ReminderRow[]): { key: string; date: string; rows: ReminderRow[] }[] {
  const map = new Map<string, ReminderRow[]>();
  for (const r of reminders) map.set(`${r.event_key}|${r.event_date}`, [...(map.get(`${r.event_key}|${r.event_date}`) || []), r]);
  return Array.from(map.entries())
    .map(([k, rows]) => ({ key: k.split('|')[0], date: k.split('|')[1], rows: rows.sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage)) }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export const STATUS_LABELS: Record<string, string> = {
  not_requested: 'Not requested', requested: 'Requested', confirmed: 'Confirmed', paid: 'Paid', declined: 'Declined',
  no_response: 'No response', completed: 'Completed', draft: 'Draft', contacted: 'Contacted', interested: 'Interested',
  pending: 'Pending', cancelled: 'Cancelled',
};
