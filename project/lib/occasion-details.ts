import { normalizeDonationType } from '@/lib/constants';
import { formatDateLabel } from '@/lib/messaging';
import type { OrganizationNames } from '@/lib/organization';
import type { MessageType, SpecialOccasion, Sponsor } from '@/lib/types';

// Pure (no Supabase): who an occasion is for, who to contact, and its message.

export type OccasionCategory = 'birthday' | 'anniversary' | 'remembrance' | 'other';
export type OccasionLike = Partial<SpecialOccasion> & Pick<SpecialOccasion, 'person_name' | 'occasion_type'>;
type SponsorLike = Pick<Sponsor, 'full_name'> & Partial<Pick<Sponsor, 'title' | 'phone' | 'whatsapp' | 'preferred_name'>>;

export const TITLES = ['Mr', 'Mrs', 'Ms', 'Dr'] as const;
export const TITLE_TA: Record<string, string> = { Mr: 'திரு.', Mrs: 'திருமதி.', Ms: 'செல்வி.', Dr: 'டாக்டர்' };

const RELATION_TA: Record<string, string> = {
  son: 'மகன்', daughter: 'மகள்', wife: 'மனைவி', husband: 'கணவர்', father: 'தந்தை', mother: 'தாய்', grandson: 'பேரன்',
  granddaughter: 'பேத்தி', brother: 'சகோதரர்', sister: 'சகோதரி', grandfather: 'தாத்தா', grandmother: 'பாட்டி', parents: 'பெற்றோர்',
};
// Respectful forms for remembrance messages.
const RELATION_TA_REMEMBRANCE: Record<string, string> = { ...RELATION_TA, father: 'தந்தையார்', mother: 'தாயார்', husband: 'கணவர்', wife: 'துணைவியார்' };

export const DONATION_TYPE_TA: Record<string, string> = {
  Food: 'உணவு', Money: 'நிதியுதவி', Clothes: 'ஆடைகள்', Education: 'கல்வி உதவி', Medical: 'மருத்துவ உதவி',
  Groceries: 'மளிகைப் பொருட்கள்', 'Books & Stationery': 'புத்தகங்கள் மற்றும் எழுதுபொருட்கள்', Other: 'உதவி',
};

/** Who the contact is to the person, for the form's auto-fill. */
export const CONTACT_RELATION: Record<string, string> = {
  Son: 'Father/Mother', Daughter: 'Father/Mother', Wife: 'Husband', Husband: 'Wife', Father: 'Son/Daughter', Mother: 'Son/Daughter',
  Grandson: 'Grandparent', Granddaughter: 'Grandparent', Grandfather: 'Grandchild', Grandmother: 'Grandchild', Brother: 'Sibling', Sister: 'Sibling',
};

const isSelfRelation = (r: string | null | undefined) => !r || !r.trim() || r.trim().toLowerCase() === 'self';
const withoutLate = (name: string) => name.trim().replace(/^late\s+/i, '');

/** The occasion's type key; older rows are worked out from their type. */
export function occasionKeyOf(o: OccasionLike): string {
  if (o.occasion_type_key) return o.occasion_type_key;
  switch (o.occasion_type) {
    case 'Birthday': return o.family_member_id || !isSelfRelation(o.relationship) ? 'family_birthday' : 'self_birthday';
    case 'Wedding Anniversary': return 'wedding_anniversary';
    case 'Death Anniversary': return 'death_anniversary';
    default: return 'other';
  }
}

export function occasionCategory(o: OccasionLike): OccasionCategory {
  if (o.occasion_type === 'Birthday') return 'birthday';
  if (o.occasion_type === 'Wedding Anniversary') return 'anniversary';
  if (o.occasion_type === 'Death Anniversary') return 'remembrance';
  return 'other';
}

/** Contact person: the occasion's own, otherwise the sponsor. */
export function occasionContact(o: OccasionLike | null | undefined, sponsor: SponsorLike) {
  const name = o?.contact_name?.trim() || sponsor.preferred_name || sponsor.full_name;
  const own = !o?.contact_name?.trim() || o.contact_name.trim().toLowerCase() === sponsor.full_name.trim().toLowerCase();
  return {
    name,
    title: o?.contact_title || (own ? sponsor.title || null : null),
    phone: o?.contact_phone || sponsor.whatsapp || sponsor.phone || null,
  };
}

/** e.g. "Arun's Birthday (Son of Ravi Kumar)" or "Remembrance Day – Late Muthusamy (Father of Senthil)". */
export function occasionTitle(o: OccasionLike, sponsorName: string): string {
  const key = occasionKeyOf(o);
  const category = occasionCategory(o);
  const person = withoutLate(o.person_name);
  const of = isSelfRelation(o.relationship) ? '' : ` (${o.relationship!.trim()} of ${sponsorName})`;
  if (category === 'remembrance') return `Remembrance Day – Late ${person}${of}`;
  if (category === 'birthday') return `${person}'s Birthday${key === 'self_birthday' ? '' : of}`;
  if (category === 'anniversary') return of ? `Wedding Anniversary – ${person}${of}` : `${person ? `${person}'s ` : ''}Wedding Anniversary`;
  const name = o.occasion_name_en || (o.occasion_type === 'Other' ? 'Special Day' : o.occasion_type);
  return `${name}${person && person.toLowerCase() !== sponsorName.trim().toLowerCase() ? ` – ${person}` : ''}${of}`;
}

export function occasionSendLabel(o: OccasionLike | null | undefined): string {
  switch (o ? occasionCategory(o) : 'other') {
    case 'birthday': return 'Send Birthday Wish';
    case 'anniversary': return 'Send Anniversary Wish';
    case 'remembrance': return 'Send Remembrance Message';
    default: return 'Send Wish';
  }
}

export function occasionMessageType(o: OccasionLike | null | undefined): MessageType {
  switch (o ? occasionCategory(o) : 'other') {
    case 'birthday': return 'birthday_wish';
    case 'anniversary': return 'anniversary_wish';
    default: return 'event_wish';
  }
}

export type OccasionTemplateType = 'Occasion: Own Birthday' | 'Occasion: Family Birthday' | 'Occasion: Anniversary' | 'Occasion: Remembrance' | 'Occasion: Other';

export function occasionTemplateType(o: OccasionLike): OccasionTemplateType {
  const category = occasionCategory(o);
  if (category === 'birthday') {
    const own = occasionKeyOf(o) === 'self_birthday' || (isSelfRelation(o.relationship) && !o.family_member_id);
    return own ? 'Occasion: Own Birthday' : 'Occasion: Family Birthday';
  }
  if (category === 'anniversary') return 'Occasion: Anniversary';
  if (category === 'remembrance') return 'Occasion: Remembrance';
  return 'Occasion: Other';
}

const ARUT = 'அருட்பெருஞ்ஜோதி அருட்பெருஞ்ஜோதி தனிப்பெருங்கருணை அருட்பெருஞ்ஜோதி';
const SIGN_OFF_TA = 'அன்புடன்,\n{{organization_name}}\n({{organization_name_ta}})';
const DEAR_TA = 'அன்புள்ள {{contact_title_ta}} {{contact_name}} அவர்களுக்கு,';
const SIGN_OFF_EN = 'With warm wishes,\n{{organization_name}}';

/** Built-in text, used if a template isn't in the database; edit them in Settings → Message Templates. */
export const OCCASION_TEMPLATES: Record<OccasionTemplateType, { name: string; body: string }> = {
  'Occasion: Own Birthday': {
    name: "Sponsor's Own Birthday",
    body: `Dear {{contact_name}},
Wishing you a very Happy Birthday!
May Vallalar's blessings fill your life with good health, happiness and prosperity.
{{donation_line_en}}
${SIGN_OFF_EN}

${ARUT}

${DEAR_TA}
உங்களுக்கு எங்களின் மனமார்ந்த பிறந்தநாள் வாழ்த்துகள்!
எல்லாம் வல்ல இறையாற்றலின் கருணையினால் நீங்கள் நீடூழி நலமுடனும் மகிழ்ச்சியுடனும் வாழ்க வளமுடன்.
{{donation_line_ta}}
${SIGN_OFF_TA}`,
  },
  'Occasion: Family Birthday': {
    name: "Family Member's Birthday",
    body: `Dear {{contact_name}},
Warm birthday wishes to your beloved {{relation_en}}, {{person_name}}!
May Vallalar's blessings bring {{person_name}} good health, happiness and a bright future, and may your family be blessed with joy always.
{{donation_line_en}}
${SIGN_OFF_EN}

${ARUT}

${DEAR_TA}
இன்று பிறந்தநாள் காணும் உங்கள் அன்பு {{relation_ta}} {{person_name}} அவர்களுக்கு எங்களின் மனமார்ந்த பிறந்தநாள் வாழ்த்துகள்!
எல்லாம் வல்ல இறையாற்றலின் கருணையினால் {{person_name}} அவர்கள் நீடூழி நலமுடனும் மகிழ்ச்சியுடனும் வாழவும், உங்கள் குடும்பம் என்றும் மகிழ்வுடன் திகழவும் வாழ்த்துகிறோம்.
{{donation_line_ta}}
${SIGN_OFF_TA}`,
  },
  'Occasion: Anniversary': {
    name: 'Wedding Anniversary',
    body: `Dear {{contact_name}},
Heartfelt wishes on {{anniversary_of_en}}!
May Vallalar's blessings fill the couple's life with love, togetherness and happiness for many more years.
{{donation_line_en}}
${SIGN_OFF_EN}

${ARUT}

${DEAR_TA}
{{anniversary_of_ta}} எங்களின் மனமார்ந்த திருமண நாள் வாழ்த்துகள்!
எல்லாம் வல்ல இறையாற்றலின் கருணையினால் தம்பதியர் இருவரும் என்றும் அன்புடனும் ஒற்றுமையுடனும் நீடூழி வாழ்க வளமுடன்.
{{donation_line_ta}}
${SIGN_OFF_TA}`,
  },
  'Occasion: Remembrance': {
    name: 'Remembrance Day',
    body: `Dear {{contact_name}},
On this remembrance day of your beloved {{relation_en}}, Late {{person_name}}, we join you and your family in remembering them with love and respect.
{{donation_line_en}}
May their soul rest in peace in the eternal grace of Arutperunjothi.
With prayers,
{{organization_name}}

${ARUT}

${DEAR_TA}
உங்கள் அன்பு {{relation_ta}} அமரர் {{person_name}} அவர்களின் நினைவு நாளில், அவர்களை நாங்களும் உங்களுடன் இணைந்து அன்புடனும் மரியாதையுடனும் நினைவுகூர்கிறோம்.
{{donation_line_ta}}
அவர்களின் ஆன்மா அருட்பெருஞ்ஜோதி ஆண்டவரின் திருவருளில் சாந்தியடைய இறைவனைப் பிரார்த்திக்கிறோம்.
பிரார்த்தனைகளுடன்,
{{organization_name}}
({{organization_name_ta}})`,
  },
  'Occasion: Other': {
    name: 'Other Occasion',
    body: `Dear {{contact_name}},
Warm wishes on the occasion of {{occasion_name_en}}!
May Vallalar's blessings fill your life with good health, happiness and prosperity.
{{donation_line_en}}
${SIGN_OFF_EN}

${ARUT}

${DEAR_TA}
{{occasion_name_ta}} நன்னாளில் எங்களின் மனமார்ந்த வாழ்த்துகள்!
எல்லாம் வல்ல இறையாற்றலின் கருணையினால் நீங்கள் நீடூழி நலமுடனும் மகிழ்ச்சியுடனும் வாழ்க வளமுடன்.
{{donation_line_ta}}
${SIGN_OFF_TA}`,
  },
};

/** Every placeholder an occasion message can use. */
export function occasionVariables(o: OccasionLike, sponsor: SponsorLike, eventDate: string | null | undefined, org: OrganizationNames): Record<string, string> {
  const contact = occasionContact(o, sponsor);
  const category = occasionCategory(o);
  const self = isSelfRelation(o.relationship);
  const person = withoutLate(o.person_name);
  const relation = self ? '' : o.relationship!.trim();
  const lower = relation.toLowerCase();
  const relationTa = (category === 'remembrance' ? RELATION_TA_REMEMBRANCE : RELATION_TA)[lower] || relation;

  const typeEn = o.linked_donation_type ? normalizeDonationType(o.linked_donation_type) : '';
  const details = o.linked_donation_details?.trim();
  const donationEn = typeEn && `${typeEn}${details ? ` (${details})` : ''}`;
  const donationTa = typeEn && `${DONATION_TYPE_TA[typeEn] || typeEn}${details ? ` (${details})` : ''}`;
  const remembrance = category === 'remembrance';

  const nameEn = o.occasion_name_en || (o.occasion_type === 'Other' ? 'this special day' : o.occasion_type);
  return {
    contact_title_en: contact.title || '',
    contact_title_ta: contact.title ? TITLE_TA[contact.title] || '' : '',
    contact_name: contact.name,
    person_name: person,
    relation_en: lower,
    relation_ta: relationTa,
    event_date: eventDate ? formatDateLabel(eventDate) : '',
    donation_type: donationEn,
    donation_type_ta: donationTa,
    donation_line_en: !donationEn ? '' : remembrance
      ? `In their loving memory, ${donationEn} is being offered to those in need today.`
      : `On this special day, ${donationEn} is being offered to those in need in ${person || contact.name}'s name.`,
    donation_line_ta: !donationTa ? '' : remembrance
      ? `அவர்களின் நினைவாக இன்று ஆதரவற்றோருக்கு ${donationTa} வழங்கப்படுகிறது.`
      : `இந்த சிறப்பு நாளில் ${person || contact.name} அவர்களின் பெயரில் ஆதரவற்றோருக்கு ${donationTa} வழங்கப்படுகிறது.`,
    anniversary_of_en: self
      ? 'your wedding anniversary'
      : `the wedding anniversary of your ${lower}${person ? ` ${person}` : ''}`,
    anniversary_of_ta: self
      ? 'இன்று திருமண நாள் காணும் உங்களுக்கும் உங்கள் துணைவருக்கும்'
      : `இன்று திருமண நாள் காணும் உங்கள் அன்பு ${relationTa}${person ? ` ${person}` : ''} தம்பதியருக்கு`,
    occasion_name_en: nameEn,
    occasion_name_ta: o.occasion_name_ta || nameEn,
    organization_name: org.org_name_en,
    organization_name_ta: org.org_name_ta,
    // Older templates' placeholders.
    sponsor_name: contact.name,
    occasion: nameEn,
    date: eventDate ? formatDateLabel(eventDate) : '',
  };
}

/**
 * Fills a template: unknown or empty placeholders disappear, a line left with
 * nothing is removed, and extra spaces and blank lines are tidied.
 */
export function fillOccasionMessage(template: string, data: Record<string, string>): string {
  return template.replace(/\r\n?/g, '\n').split('\n')
    .map((line) => {
      const hadPlaceholder = /\{\{\s*\w+\s*\}\}/.test(line);
      const filled = line.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => data[key] ?? '').replace(/ {2,}/g, ' ').trim();
      return hadPlaceholder && !filled ? null : filled;
    })
    .filter((line): line is string => line !== null)
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
