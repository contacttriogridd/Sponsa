import { normalizeIndianNumber } from '@/lib/phone';
import { repeatRow, type RepeatValue } from '@/lib/repeat-value';
import type { SpecialOccasion } from '@/lib/types';
import type { OccasionCategory } from '@/lib/occasion-details';

// One occasion being edited, and how it becomes a special_occasions row.

export interface OccasionTypeRow {
  id?: string;
  key: string;
  name_en: string;
  name_ta: string;
  icon: string;
  category: OccasionCategory;
  needs_person_name: boolean;
  is_active: boolean;
  sort_order: number;
}

/** Used until the occasion_types table exists. */
export const DEFAULT_OCCASION_TYPES: OccasionTypeRow[] = [
  { key: 'self_birthday', name_en: "Sponsor's Own Birthday", name_ta: 'சொந்த பிறந்தநாள்', icon: '🎂', category: 'birthday', needs_person_name: false, is_active: true, sort_order: 10 },
  { key: 'family_birthday', name_en: "Family Member's Birthday", name_ta: 'குடும்பத்தினர் பிறந்தநாள்', icon: '🎂', category: 'birthday', needs_person_name: true, is_active: true, sort_order: 20 },
  { key: 'wedding_anniversary', name_en: 'Wedding Anniversary', name_ta: 'திருமண நாள்', icon: '💍', category: 'anniversary', needs_person_name: true, is_active: true, sort_order: 30 },
  { key: 'death_anniversary', name_en: 'Death Anniversary (Remembrance)', name_ta: 'நினைவு நாள்', icon: '🪔', category: 'remembrance', needs_person_name: true, is_active: true, sort_order: 40 },
  { key: 'other', name_en: 'Other Occasion', name_ta: 'பிற நிகழ்வு', icon: '✨', category: 'other', needs_person_name: false, is_active: true, sort_order: 50 },
];

const LEGACY_TYPE: Record<string, string> = {
  business_anniversary: 'Business Anniversary', achievement: 'Achievement', celebration: 'Celebration',
};
const CATEGORY_TYPE: Record<OccasionCategory, string> = {
  birthday: 'Birthday', anniversary: 'Wedding Anniversary', remembrance: 'Death Anniversary', other: 'Other',
};

export interface OccasionDraft {
  /** Local list key. */
  localId: string;
  /** Existing row, when editing. */
  id?: string;
  type_key: string;
  relationship: string;
  relationship_other: string;
  person_name: string;
  occasion_date: string;
  occasion_name_en: string;
  occasion_name_ta: string;
  contact_name: string;
  contact_title: string;
  contact_phone: string;
  contact_relation: string;
  linked_donation_type: string;
  linked_donation_details: string;
  thithi_note: string;
  notes: string;
  remind_days_before: number[] | null;
  repeat: RepeatValue;
  active: boolean;
  family_member_id?: string | null;
  is_auto_generated?: boolean;
  /** Changed in this form; untouched existing rows are neither re-checked nor rewritten. */
  touched?: boolean;
}

export const FAMILY_RELATIONS = ['Son', 'Daughter', 'Wife', 'Husband', 'Father', 'Mother', 'Grandson', 'Granddaughter', 'Brother', 'Sister', 'Other'];
export const ANNIVERSARY_WHOSE = [
  { value: 'Self', label: 'Sponsor & spouse' }, { value: 'Son', label: 'Son' }, { value: 'Daughter', label: 'Daughter' },
  { value: 'Parents', label: 'Parents' }, { value: 'Other', label: 'Other' },
];
export const REMEMBRANCE_RELATIONS = ['Father', 'Mother', 'Husband', 'Wife', 'Son', 'Daughter', 'Grandfather', 'Grandmother', 'Other'];

let counter = 0;

export function newDraft(typeKey: string, date = ''): OccasionDraft {
  counter += 1;
  return {
    localId: `new-${counter}`,
    type_key: typeKey, relationship: '', relationship_other: '', person_name: '', occasion_date: date,
    occasion_name_en: '', occasion_name_ta: '', contact_name: '', contact_title: '', contact_phone: '', contact_relation: '',
    linked_donation_type: '', linked_donation_details: '', thithi_note: '', notes: '',
    remind_days_before: [0],
    repeat: { recurrence: 'yearly', weekdays: [], day_of_month: '', end_date: '' },
    active: true,
  };
}

export function draftFromOccasion(o: SpecialOccasion, typeKey: string): OccasionDraft {
  counter += 1;
  const known = [...FAMILY_RELATIONS, ...REMEMBRANCE_RELATIONS, 'Self', 'Parents'];
  const rel = o.relationship?.trim() || '';
  const isKnown = !rel || known.includes(rel);
  return {
    localId: `row-${counter}`,
    id: o.id,
    type_key: typeKey,
    relationship: isKnown ? rel : 'Other',
    relationship_other: isKnown ? '' : rel,
    person_name: o.person_name,
    occasion_date: o.occasion_date,
    occasion_name_en: o.occasion_name_en || '',
    occasion_name_ta: o.occasion_name_ta || '',
    contact_name: o.contact_name || '',
    contact_title: o.contact_title || '',
    contact_phone: o.contact_phone || '',
    contact_relation: o.contact_relation || '',
    linked_donation_type: o.linked_donation_type || '',
    linked_donation_details: o.linked_donation_details || '',
    thithi_note: o.thithi_note || '',
    notes: o.notes || '',
    remind_days_before: o.remind_days_before ?? null,
    repeat: {
      recurrence: o.recurrence || (o.recurring_yearly ? 'yearly' : 'none'),
      weekdays: o.weekdays || [],
      day_of_month: o.day_of_month ? String(o.day_of_month) : '',
      end_date: o.end_date || '',
    },
    active: o.active,
    family_member_id: o.family_member_id,
    is_auto_generated: o.is_auto_generated,
  };
}

export interface SponsorDefaults {
  name: string;
  dob?: string | null;
  phone?: string | null;
}

const relationOf = (d: OccasionDraft) => (d.relationship === 'Other' ? d.relationship_other.trim() : d.relationship);

/** First problem with a draft, or null. */
export function validateDraft(d: OccasionDraft, type: OccasionTypeRow | undefined, sponsor: SponsorDefaults): string | null {
  const label = type?.name_en || 'Occasion';
  const own = d.type_key === 'self_birthday';
  const category = type?.category || 'other';
  if (!own && !d.occasion_date) return `${label}: the date is required.`;
  if (own && !d.occasion_date && !sponsor.dob) return `${label}: enter the date of birth.`;
  const needsRelation = d.type_key === 'family_birthday' || category === 'remembrance';
  if (needsRelation && !relationOf(d)) return `${label}: the relationship is required.`;
  if (d.relationship === 'Other' && !d.relationship_other.trim()) return `${label}: type the relationship.`;
  if (type?.needs_person_name && !own && !d.person_name.trim()) return `${label}: the person's name is required.`;
  if (category === 'other' && !d.occasion_name_en.trim() && !type?.key.match(/business_anniversary|achievement|celebration/) && type?.key === 'other') {
    return `${label}: the occasion name is required.`;
  }
  const phone = d.contact_phone.trim() || sponsor.phone || '';
  if (needsRelation && !phone) return `${label}: the contact phone is required.`;
  if (d.contact_phone.trim() && !normalizeIndianNumber(d.contact_phone)) return `${label}: enter a valid 10-digit contact phone.`;
  return null;
}

/** The special_occasions columns for a draft. */
export function draftToRow(d: OccasionDraft, type: OccasionTypeRow | undefined, sponsorId: string, sponsor: SponsorDefaults) {
  const own = d.type_key === 'self_birthday';
  const category = type?.category || 'other';
  const date = d.occasion_date || (own ? sponsor.dob || '' : '');
  const name = d.contact_name.trim();
  const sameAsSponsor = !name || name.toLowerCase() === sponsor.name.trim().toLowerCase();
  const typeNameEn = type?.key === 'other' ? '' : type?.name_en || '';
  const relationship = own ? 'Self' : relationOf(d) || 'Self';
  return {
    sponsor_id: sponsorId,
    occasion_type_key: d.type_key,
    occasion_type: LEGACY_TYPE[d.type_key] || CATEGORY_TYPE[category],
    person_name: own ? sponsor.name.trim() : d.person_name.trim() || sponsor.name.trim(),
    relationship,
    occasion_date: date,
    occasion_name_en: category === 'other' ? d.occasion_name_en.trim() || typeNameEn || null : null,
    occasion_name_ta: category === 'other' ? d.occasion_name_ta.trim() || (type?.key === 'other' ? '' : type?.name_ta) || null : null,
    contact_name: sameAsSponsor ? null : name,
    contact_title: d.contact_title || null,
    contact_phone: d.contact_phone.trim() ? normalizeIndianNumber(d.contact_phone) : null,
    contact_relation: d.contact_relation.trim() || null,
    linked_donation_type: d.linked_donation_type || null,
    linked_donation_details: d.linked_donation_type ? d.linked_donation_details.trim() || null : null,
    thithi_note: d.thithi_note.trim() || null,
    notes: d.notes.trim() || null,
    remind_days_before: d.remind_days_before,
    recurring_yearly: d.repeat.recurrence === 'yearly',
    ...repeatRow(d.repeat, date),
    active: d.active,
    is_auto_generated: false,
  };
}
