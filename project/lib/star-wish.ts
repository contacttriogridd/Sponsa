'use client';

import { supabase } from '@/lib/supabase/client';
import { organizationNamesFrom, type OrganizationNames } from '@/lib/organization';
import { RAASIS, STARS } from '@/lib/natchathiram';
import { formatCurrency } from '@/lib/constants';
import { effectiveRaasi, formatStarDate } from '@/lib/monthly-sponsors';
import type { MessageTemplate, MonthlySponsor } from '@/lib/types';

/** Used when the database doesn't have the template yet (before migration 00012). */
export const DEFAULT_STAR_TODAY_BODY = `அன்புள்ள {{sponsor_name}} அவர்களுக்கு,

இன்று ({{star_day_date}}) உங்கள் நட்சத்திர நாள் — {{star_tamil}}. இறைவன் அருளால் நீங்களும் உங்கள் குடும்பத்தினரும் நலமும் மகிழ்ச்சியும் பெற்று வாழ வாழ்த்துகிறோம். தங்களின் தொடர்ந்த மாதாந்திர உதவிக்கு மனமார்ந்த நன்றி.

Dear {{sponsor_name}},

Happy star day! Today, {{star_day_weekday}} {{star_day_date}}, is your star day ({{star_english}}). May you and your family be blessed with good health and happiness. Thank you for your continued monthly support.

With gratitude,
{{organization_name}}`;

export const DEFAULT_STAR_UPCOMING_BODY = `அன்புள்ள {{sponsor_name}} அவர்களுக்கு,

இன்னும் {{days_left}} நாளில், {{star_day_date}} அன்று உங்கள் நட்சத்திர நாள் ({{star_tamil}}) வருகிறது. இறைவன் அருளால் நீங்களும் உங்கள் குடும்பத்தினரும் நலமும் மகிழ்ச்சியும் பெற முன்கூட்டியே வாழ்த்துகிறோம். தங்களின் தொடர்ந்த மாதாந்திர உதவிக்கு மனமார்ந்த நன்றி.

Dear {{sponsor_name}},

Your star day ({{star_english}}) is on {{star_day_weekday}}, {{star_day_date}} — just {{days_left}} day(s) away. Warm wishes to you and your family in advance, and thank you for your continued monthly support.

Contact: {{contact_phone}}

With gratitude,
{{organization_name}}`;

export interface WishContext {
  templates: MessageTemplate[];
  organizationNames: OrganizationNames;
  contactPhone: string;
}

let cache: { at: number; promise: Promise<WishContext> } | null = null;

/** Templates and organization details for composing wishes (cached for a minute). */
export function loadWishContext(): Promise<WishContext> {
  if (cache && Date.now() - cache.at < 60_000) return cache.promise;
  const promise = (async () => {
    const [{ data: templates }, { data: org }] = await Promise.all([
      supabase.from('message_templates').select('*').order('is_approved', { ascending: false }),
      supabase.from('organization_settings').select('*').limit(1).maybeSingle(),
    ]);
    return {
      templates: (templates || []) as MessageTemplate[],
      organizationNames: organizationNamesFrom(org),
      contactPhone: org?.phone || '',
    };
  })();
  cache = { at: Date.now(), promise };
  return promise;
}

/** "Star day today" on the day, otherwise "Star day upcoming"; falls back to older/default text. */
export function pickStarTemplate(templates: MessageTemplate[], daysLeft: number): { type: string; name: string; body: string; id: string | null } {
  const type = daysLeft <= 0 ? 'Star Day Today' : 'Star Day Upcoming';
  const t = templates.find((x) => x.type === type) || templates.find((x) => x.type === 'Star Day Wish');
  if (t) return { type: t.type, name: t.name, body: t.body, id: t.id };
  return {
    type,
    name: daysLeft <= 0 ? 'Star day today' : 'Star day upcoming',
    body: daysLeft <= 0 ? DEFAULT_STAR_TODAY_BODY : DEFAULT_STAR_UPCOMING_BODY,
    id: null,
  };
}

/** All star-day placeholders, plus the older {{star_name}} / {{raasi_name}} / {{star_date}}. */
export function starDayVariables(sponsor: MonthlySponsor, starDate: string, daysLeft: number, contactPhone: string): Record<string, string> {
  const star = sponsor.star != null ? STARS[sponsor.star] : null;
  const raasiIndex = effectiveRaasi(sponsor);
  const day = new Date(`${starDate}T00:00:00Z`);
  return {
    sponsor_name: sponsor.name,
    star_tamil: star?.ta || '',
    star_english: star?.en || '',
    star_day_date: day.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
    star_day_weekday: day.toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' }),
    days_left: String(Math.max(0, daysLeft)),
    monthly_amount: sponsor.monthly_amount != null ? formatCurrency(Number(sponsor.monthly_amount)) : '',
    contact_phone: contactPhone,
    star_name: star?.ta || '',
    raasi_name: raasiIndex != null ? RAASIS[raasiIndex].ta : '',
    star_date: formatStarDate(starDate),
  };
}

/**
 * WhatsApp number for wa.me: digits only, in international form. Handles the
 * ways Indian numbers are usually written — "+91 96295 22777",
 * "96295 22777", "096295 22777", "0091 96295 22777".
 */
export function whatsappNumber(phone: string | null | undefined): string {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2); // international prefix 00
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1); // trunk 0
  return digits.length === 10 ? `91${digits}` : digits;
}
