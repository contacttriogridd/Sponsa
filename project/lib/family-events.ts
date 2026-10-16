// Family-day options and date helpers for the Add Sponsor page. Each day the
// user adds is saved as the new sponsor's `special_occasions` row, so it shows
// on the sponsor page, calendar and reminders like any other occasion.

export type FamilyEventCategory = 'birthday' | 'anniversary' | 'death_anniversary';

export interface FamilyEventTypeOption {
  key: string;
  category: FamilyEventCategory;
  label: string;
  /** Relationship pre-selected when this type is chosen; the user can change it. */
  defaultRelationship: string;
}

export interface FamilyEventCategoryOption {
  key: FamilyEventCategory;
  label: string;
  singular: string;
  emoji: string;
  description: string;
  /** `special_occasions.occasion_type` stored for this category. */
  occasionType: string;
}

export const FAMILY_EVENT_CATEGORIES: FamilyEventCategoryOption[] = [
  { key: 'birthday', label: 'Birthdays', singular: 'Birthday', emoji: '🎂', description: 'Children, parents, wife and other family members', occasionType: 'Birthday' },
  { key: 'anniversary', label: 'Anniversaries', singular: 'Anniversary', emoji: '💍', description: 'Wedding and other special anniversaries', occasionType: 'Wedding Anniversary' },
  { key: 'death_anniversary', label: 'Death Anniversaries', singular: 'Death Anniversary', emoji: '🪔', description: 'Remembering loved ones who have passed', occasionType: 'Death Anniversary' },
];

export const FAMILY_EVENT_TYPES: FamilyEventTypeOption[] = [
  { key: 'child_birthday', category: 'birthday', label: "Children's Birthday", defaultRelationship: 'Child' },
  { key: 'father_birthday', category: 'birthday', label: "Father's Birthday", defaultRelationship: 'Father' },
  { key: 'mother_birthday', category: 'birthday', label: "Mother's Birthday", defaultRelationship: 'Mother' },
  { key: 'wife_birthday', category: 'birthday', label: "Wife's Birthday", defaultRelationship: 'Wife' },
  { key: 'other_birthday', category: 'birthday', label: "Other Family Member's Birthday", defaultRelationship: 'Other Family Member' },

  { key: 'wedding_anniversary', category: 'anniversary', label: 'Wedding Anniversary', defaultRelationship: 'Self' },
  { key: 'parents_wedding_anniversary', category: 'anniversary', label: "Parents' Wedding Anniversary", defaultRelationship: 'Parent' },
  { key: 'other_wedding_anniversary', category: 'anniversary', label: "Other Family Member's Wedding Anniversary", defaultRelationship: 'Other Family Member' },
  { key: 'special_anniversary', category: 'anniversary', label: 'Other Special Anniversary', defaultRelationship: 'Self' },

  { key: 'father_death_anniversary', category: 'death_anniversary', label: "Father's Death Anniversary", defaultRelationship: 'Father' },
  { key: 'mother_death_anniversary', category: 'death_anniversary', label: "Mother's Death Anniversary", defaultRelationship: 'Mother' },
  { key: 'other_death_anniversary', category: 'death_anniversary', label: "Other Family Member's Death Anniversary", defaultRelationship: 'Other Family Member' },
];

export const FAMILY_RELATIONSHIPS = [
  'Self',
  'Child',
  'Father',
  'Mother',
  'Wife',
  'Husband',
  'Parent',
  'Other Family Member',
] as const;

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

const TYPE_MAP = new Map(FAMILY_EVENT_TYPES.map((t) => [t.key, t]));
const CATEGORY_MAP = new Map(FAMILY_EVENT_CATEGORIES.map((c) => [c.key, c]));

export function getEventTypesForCategory(category: FamilyEventCategory): FamilyEventTypeOption[] {
  return FAMILY_EVENT_TYPES.filter((t) => t.category === category);
}

export function getEventTypeLabel(key: string): string {
  return TYPE_MAP.get(key)?.label || key;
}

export function getCategory(key: FamilyEventCategory): FamilyEventCategoryOption {
  return CATEGORY_MAP.get(key) || FAMILY_EVENT_CATEGORIES[0];
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** With no year chosen yet, February allows 29 so a leap-day date can be picked. */
export function daysInMonth(month: number, year: number | null): number {
  if (month === 2) return year === null || isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export interface FamilyEventInput {
  person_name: string;
  event_category: FamilyEventCategory | '';
  event_type: string;
  relationship: string;
  event_day: number | null;
  event_month: number | null;
  event_year: number | null;
  notes: string;
}

/** Returns a user-facing message for the first problem found, or null when valid. */
export function validateFamilyEventInput(input: FamilyEventInput, today: Date = new Date()): string | null {
  if (!input.person_name.trim()) return "Please enter the person's name.";
  if (input.person_name.trim().length > 120) return 'The name is too long (120 characters at most).';
  if (!input.event_category) return 'Please choose an event category.';
  const type = TYPE_MAP.get(input.event_type);
  if (!type) return 'Please choose an event type.';
  if (type.category !== input.event_category) return 'The event type does not match the chosen category.';
  if (!input.relationship.trim()) return 'Please choose or type a relationship.';
  if (input.relationship.trim().length > 60) return 'The relationship is too long (60 characters at most).';
  if (!input.event_day || !input.event_month) return 'Please choose the day and month of the event.';
  if (input.event_year === null) return 'Please enter the year, e.g. 1978.';
  if (input.event_year < 1900 || input.event_year > today.getFullYear()) return 'Please enter a valid year.';
  if (input.event_day > daysInMonth(input.event_month, input.event_year)) {
    return input.event_month === 2 && input.event_day === 29
      ? `${input.event_year} was not a leap year, so it has no 29 February.`
      : `${MONTHS[input.event_month - 1]} does not have ${input.event_day} days.`;
  }
  const original = new Date(input.event_year, input.event_month - 1, input.event_day);
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (original > startOfToday) return 'The original date cannot be in the future.';
  if (input.notes.length > 1000) return 'Notes are too long (1000 characters at most).';
  return null;
}

/** Row for `special_occasions`, from a validated input. */
export function toSpecialOccasion(input: FamilyEventInput, sponsorId: string) {
  const category = getCategory(input.event_category as FamilyEventCategory);
  const pad = (n: number) => String(n).padStart(2, '0');
  // "Other Special Anniversary" isn't a wedding anniversary, so keep its meaning in the notes.
  const isSpecial = input.event_type === 'special_anniversary';
  const notes = [isSpecial ? getEventTypeLabel(input.event_type) : '', input.notes.trim()].filter(Boolean).join(' — ');
  return {
    sponsor_id: sponsorId,
    person_name: input.person_name.trim(),
    relationship: input.relationship.trim(),
    occasion_type: isSpecial ? 'Other' : category.occasionType,
    occasion_date: `${input.event_year}-${pad(input.event_month!)}-${pad(input.event_day!)}`,
    recurring_yearly: true,
    is_auto_generated: false,
    active: true,
    notes: notes || null,
  };
}

type DayMonthYear = { event_day: number; event_month: number; event_year: number | null };

export interface NextOccurrence {
  date: Date;
  daysUntil: number;
  /** Age / number of years being marked on the next occurrence, when the year is known. */
  years: number | null;
}

/**
 * Next yearly occurrence on or after `from`. A 29 February date is observed on
 * 28 February in non-leap years (same rule as `getNextOccurrence` in date-utils).
 */
export function getNextFamilyEventOccurrence(event: DayMonthYear, from: Date = new Date()): NextOccurrence {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const onYear = (y: number) => {
    const day = event.event_month === 2 && event.event_day === 29 && !isLeapYear(y) ? 28 : event.event_day;
    return new Date(y, event.event_month - 1, day);
  };

  let date = onYear(today.getFullYear());
  if (date < today) date = onYear(today.getFullYear() + 1);

  const daysUntil = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  const years = event.event_year !== null ? date.getFullYear() - event.event_year : null;
  return { date, daysUntil, years };
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th'}`;
}

/** e.g. "Turns 46", "25th anniversary", "10th year of remembrance". */
export function describeMilestone(category: FamilyEventCategory, years: number | null): string | null {
  if (years === null || years <= 0) return null;
  if (category === 'birthday') return `Turns ${years}`;
  if (category === 'anniversary') return `${ordinal(years)} anniversary`;
  return `${ordinal(years)} year of remembrance`;
}

export function formatFamilyEventDate(event: DayMonthYear): string {
  const base = `${event.event_day} ${MONTHS[event.event_month - 1]}`;
  return event.event_year !== null ? `${base} ${event.event_year}` : base;
}

export function getWhenLabel(daysUntil: number): string {
  if (daysUntil === 0) return 'Today';
  if (daysUntil === 1) return 'Tomorrow';
  if (daysUntil < 7) return `In ${daysUntil} days`;
  if (daysUntil < 14) return 'Next week';
  if (daysUntil < 60) return `In ${Math.round(daysUntil / 7)} weeks`;
  return `In ${Math.round(daysUntil / 30)} months`;
}
