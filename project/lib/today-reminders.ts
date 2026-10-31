import { OCCASION_ICONS } from '@/lib/constants';
import { occasionCategory, occasionContact, occasionKeyOf, occasionTitle } from '@/lib/occasion-details';
import { classifyDate, type ReminderGroup, type ReminderTiming, daysBetweenDates } from '@/lib/dateHelpers';
import { monthlySponsorEvent, nextOccurrence, occasionEvent, occursOn, recurrenceBadge, shiftDate, sponsorshipEvent, type RecurringEvent } from '@/lib/recurrence';
import type { Donation, FamilyMember, MonthlySponsor, SpecialOccasion, Sponsor, SponsorshipRequest } from '@/lib/types';

// Pure (no Supabase): turns stored records into dashboard reminders.

export interface ReminderItem {
  /** Stable id, used to remember "Mark as Done" for the day. */
  key: string;
  kind: 'birthday' | 'event' | 'donation';
  group: ReminderGroup;
  date: string;
  days: number;
  icon: string;
  name: string;
  occasion: string;
  subtitle: string | null;
  /** "🔁 Daily" etc.; null for one-time and plain yearly dates. */
  recurrenceBadge: string | null;
  donationType: string | null;
  phone: string | null;
  /** Who receives the message. */
  contactName: string | null;
  /** Remembrance: shown in a calm style, never as a celebration. */
  calm: boolean;
  /** Whose day it is, for wishes (may differ from the sponsor, e.g. a child). */
  personName: string;
  familyMember: boolean;
  sponsor: Sponsor | null;
  monthlySponsor: MonthlySponsor | null;
  occasionRecord: SpecialOccasion | null;
  donation: Donation | null;
}

export interface ReminderSources {
  sponsors: Sponsor[];
  occasions: SpecialOccasion[];
  familyMembers: FamilyMember[];
  monthlySponsors: MonthlySponsor[];
  /** Icons by occasion type key, from Settings. */
  occasionIcons?: Record<string, string>;
  donations: Donation[];
  requests: SponsorshipRequest[];
}

/**
 * When an event falls relative to today. A repeating event appears today if
 * it occurs today, and once under Upcoming with its next date, never under
 * Past until it has ended. A one-time or open-ended yearly date is in one group.
 */
export function eventTimings(event: RecurringEvent, today: string): ReminderTiming[] {
  const recurrence = event.recurrence || 'none';
  const anchor = event.start_date || event.date;
  if (recurrence === 'none' || (recurrence === 'yearly' && !event.end_date)) {
    return anchor ? [classifyDate(event.date || anchor, recurrence === 'yearly', today)] : [];
  }
  const out: ReminderTiming[] = [];
  if (occursOn(event, today)) out.push({ group: 'today', date: today, days: 0 });
  const next = nextOccurrence(event, shiftDate(today, 1));
  if (next) out.push({ group: 'upcoming', date: next, days: daysBetweenDates(today, next) });
  else if (event.end_date && event.end_date < today) {
    out.push({ group: 'past', date: event.end_date, days: daysBetweenDates(today, event.end_date) });
  }
  return out;
}

/**
 * Every reminder. Includes birthdays stored only
 * as a date of birth (sponsor, family member, monthly sponsor), skipping any
 * person whose birthday is already saved as a special occasion, plus today's
 * donations and sponsorship days.
 */
export function buildReminderItems(src: ReminderSources, today: string): ReminderItem[] {
  const sponsorById = new Map(src.sponsors.map((s) => [s.id, s]));
  const items: ReminderItem[] = [];
  const birthdays = new Set<string>();
  const birthdayKey = (name: string, date: string) => `${name.trim().toLowerCase()}|${date.slice(5, 10)}`;
  const phoneOf = (s: Sponsor | null | undefined) => s?.phone || s?.whatsapp || null;
  const base = { donationType: null, monthlySponsor: null, occasionRecord: null, donation: null, subtitle: null, familyMember: false, recurrenceBadge: null, contactName: null, calm: false };
  // Repeating events get a second key for their Upcoming entry; Done is stored under the plain key per date.
  const entryKey = (key: string, t: ReminderTiming) => (t.group === 'upcoming' ? `${key}#next` : key);

  for (const o of src.occasions) {
    const sponsor = sponsorById.get(o.sponsor_id);
    if (!o.active || !sponsor) continue;
    const event = occasionEvent(o);
    const isBirthday = o.occasion_type === 'Birthday';
    if (isBirthday) birthdays.add(birthdayKey(o.person_name, o.occasion_date));
    const contact = occasionContact(o, sponsor);
    const category = occasionCategory(o);
    for (const t of eventTimings(event, today)) {
      items.push({
        ...base, key: entryKey(`occ:${o.id}`, t), kind: isBirthday ? 'birthday' : 'event', ...t,
        icon: src.occasionIcons?.[occasionKeyOf(o)] || OCCASION_ICONS[o.occasion_type] || '⭐',
        name: sponsor.full_name, occasion: occasionTitle(o, sponsor.full_name),
        contactName: contact.name, calm: category === 'remembrance',
        donationType: o.linked_donation_type || null,
        recurrenceBadge: event.recurrence === 'yearly' ? null : recurrenceBadge(event),
        personName: o.person_name, familyMember: !!o.family_member_id,
        phone: contact.phone, sponsor, occasionRecord: o,
      });
    }
  }

  const addBirthday = (key: string, personName: string, dob: string | null, extra: Partial<ReminderItem>) => {
    if (!dob || birthdays.has(birthdayKey(personName, dob))) return;
    birthdays.add(birthdayKey(personName, dob));
    items.push({
      ...base, key, kind: 'birthday', ...classifyDate(dob, true, today),
      icon: '🎂', name: personName, occasion: `${personName}'s Birthday`, personName, phone: null, sponsor: null, ...extra,
    });
  };
  for (const s of src.sponsors) addBirthday(`dob:${s.id}`, s.full_name, s.dob, { phone: phoneOf(s), sponsor: s });
  for (const m of src.familyMembers) {
    const sponsor = sponsorById.get(m.sponsor_id);
    if (sponsor) {
      addBirthday(`fam:${m.id}`, m.full_name, m.dob, {
        name: sponsor.full_name, subtitle: `${m.relationship} of ${sponsor.full_name}`, familyMember: true,
        phone: m.whatsapp || m.phone || phoneOf(sponsor), sponsor,
      });
    }
  }
  for (const m of src.monthlySponsors) {
    if (m.status !== 'active') continue;
    const linked = m.sponsor_id ? sponsorById.get(m.sponsor_id) || null : null;
    addBirthday(`ms:${m.id}`, m.name, m.dob, { phone: m.phone || phoneOf(linked), sponsor: linked, monthlySponsor: m });
    // Their donation day each month, from the payment day.
    if (m.payment_day) {
      const event = monthlySponsorEvent(m);
      for (const t of eventTimings(event, today)) {
        items.push({
          ...base, key: entryKey(`mspay:${m.id}`, t), kind: 'event', ...t, icon: '🗓️',
          name: m.name, occasion: 'Monthly donation day', recurrenceBadge: recurrenceBadge(event),
          personName: m.name, phone: m.phone || phoneOf(linked), sponsor: linked, monthlySponsor: m,
        });
      }
    }
  }

  for (const d of src.donations) {
    if (d.donation_date !== today) continue;
    const sponsor = sponsorById.get(d.sponsor_id);
    if (!sponsor) continue;
    items.push({
      ...base, key: `don:${d.id}`, kind: 'donation', group: 'today', date: today, days: 0, icon: '🎁',
      name: sponsor.full_name, occasion: d.occasion_name || 'Donation today', donationType: d.type || 'Food',
      personName: sponsor.full_name, phone: phoneOf(sponsor), sponsor, donation: d,
    });
  }

  for (const r of src.requests) {
    if (r.status === 'declined' || r.status === 'cancelled') continue;
    const sponsor = sponsorById.get(r.sponsor_id);
    if (!sponsor) continue;
    const event = sponsorshipEvent(r);
    // A one-time request tied to an occasion is already listed through that occasion.
    if (event.active === false || (event.recurrence === 'none' && (r.occasion_id || !r.special_date))) continue;
    for (const t of eventTimings(event, today)) {
      items.push({
        ...base, key: entryKey(`req:${r.id}`, t), kind: 'event', ...t, icon: '🤝',
        name: sponsor.full_name, occasion: r.occasion_name || 'Sponsorship day', donationType: r.type || null,
        recurrenceBadge: recurrenceBadge(event),
        personName: sponsor.full_name, phone: phoneOf(sponsor), sponsor,
      });
    }
  }

  return items.sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));
}
