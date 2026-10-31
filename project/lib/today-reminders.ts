import { OCCASION_ICONS } from '@/lib/constants';
import { occasionHeadline, occasionRelation } from '@/lib/occasion-text';
import { classifyDate, type ReminderGroup } from '@/lib/dateHelpers';
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
  donationType: string | null;
  phone: string | null;
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
  donations: Donation[];
  requests: SponsorshipRequest[];
}

/**
 * Every reminder, each in exactly one group. Includes birthdays stored only
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
  const base = { donationType: null, monthlySponsor: null, occasionRecord: null, donation: null, subtitle: null, familyMember: false };

  for (const o of src.occasions) {
    const sponsor = sponsorById.get(o.sponsor_id);
    if (!o.active || !sponsor) continue;
    const t = classifyDate(o.occasion_date, o.recurring_yearly, today);
    const isBirthday = o.occasion_type === 'Birthday';
    if (isBirthday) birthdays.add(birthdayKey(o.person_name, o.occasion_date));
    items.push({
      ...base, key: `occ:${o.id}`, kind: isBirthday ? 'birthday' : 'event', ...t,
      icon: OCCASION_ICONS[o.occasion_type] || '⭐',
      name: sponsor.full_name, occasion: occasionHeadline(o, sponsor.full_name),
      subtitle: occasionRelation(o, sponsor.full_name),
      personName: o.person_name, familyMember: !!o.family_member_id,
      phone: phoneOf(sponsor), sponsor, occasionRecord: o,
    });
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
    // A request tied to an occasion is already listed through that occasion.
    if (r.occasion_id || !r.special_date) continue;
    const sponsor = sponsorById.get(r.sponsor_id);
    if (!sponsor) continue;
    const t = classifyDate(r.special_date, false, today);
    if (t.group !== 'today') continue;
    items.push({
      ...base, key: `req:${r.id}`, kind: 'event', ...t, icon: '🤝',
      name: sponsor.full_name, occasion: r.occasion_name || 'Sponsorship day', donationType: r.type || null,
      personName: sponsor.full_name, phone: phoneOf(sponsor), sponsor,
    });
  }

  return items.sort((a, b) => a.days - b.days || a.name.localeCompare(b.name));
}
