import type { OrganizationNames } from '@/lib/organization';

// Pure (no Supabase): Festival Wishes text and family-member helpers.

export type FestivalCategory = 'general' | 'monthly';
export type FestivalLanguage = 'en' | 'ta' | 'both';

export interface Festival {
  id: string;
  key: string;
  name_en: string;
  name_ta: string;
  is_active: boolean;
  sort_order: number;
}

export interface FestivalTemplate {
  id: string;
  festival_id: string;
  category: FestivalCategory;
  language: 'en' | 'ta';
  body: string;
  default_body: string;
}

export const LANGUAGE_LABELS: Record<FestivalLanguage, string> = { ta: 'Tamil', en: 'English', both: 'Both' };

/**
 * Fills one language's template. {{organization_name}} is VP TRUST in English
 * and the Tamil name in Tamil. A line whose {{family_member_names}} is empty
 * is removed entirely, so no gap is left.
 */
export function fillFestivalTemplate(
  template: string,
  language: 'en' | 'ta',
  data: { sponsor_name: string; family_member_names?: string | null },
  org: OrganizationNames,
): string {
  const values: Record<string, string> = {
    sponsor_name: data.sponsor_name,
    family_member_names: data.family_member_names?.trim() || '',
    organization_name: language === 'ta' ? org.org_name_ta : org.org_name_en,
  };
  return template.replace(/\r\n?/g, '\n').split('\n')
    .filter((line) => !(/\{\{\s*family_member_names\s*\}\}/.test(line) && !values.family_member_names))
    .map((line) => line.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => values[key] ?? ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** The message in the chosen language; Both is Tamil, then English. */
export function buildFestivalMessage(
  language: FestivalLanguage,
  templates: { en: string; ta: string },
  data: { sponsor_name: string; family_member_names?: string | null },
  org: OrganizationNames,
): string {
  if (language === 'both') {
    return `${fillFestivalTemplate(templates.ta, 'ta', data, org)}\n\n${fillFestivalTemplate(templates.en, 'en', data, org)}`;
  }
  return fillFestivalTemplate(templates[language], language, data, org);
}

/** "Priya, Arun and Meena" style list. */
export function joinNames(names: string[]): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length <= 1) return clean[0] || '';
  return `${clean.slice(0, -1).join(', ')} and ${clean[clean.length - 1]}`;
}

export const FAMILY_RELATIONSHIPS = [
  { value: 'Spouse', label: 'Spouse / மனைவி/கணவர்' },
  { value: 'Son', label: 'Son / மகன்' },
  { value: 'Daughter', label: 'Daughter / மகள்' },
  { value: 'Father', label: 'Father / தந்தை' },
  { value: 'Mother', label: 'Mother / தாய்' },
  { value: 'Grandfather', label: 'Grandfather / தாத்தா' },
  { value: 'Grandmother', label: 'Grandmother / பாட்டி' },
  { value: 'Brother', label: 'Brother / சகோதரன்' },
  { value: 'Sister', label: 'Sister / சகோதரி' },
  { value: 'Other', label: 'Other / மற்றவை' },
] as const;

export type FamilyRelationship = (typeof FAMILY_RELATIONSHIPS)[number]['value'];

export function relationshipLabel(m: { relationship: string; relationship_other?: string | null }): string {
  return m.relationship === 'Other' ? m.relationship_other?.trim() || 'Family member' : m.relationship;
}

/** The IST year a festival send belongs to, so each year's festival is separate. */
export function festivalYear(now: Date = new Date()): number {
  return new Date(now.getTime() + 330 * 60 * 1000).getUTCFullYear();
}
