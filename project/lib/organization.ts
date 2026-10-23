/**
 * The organization's English and Tamil names. They live in
 * organization_settings (org_name_en / org_name_ta) and are the only source
 * for {{organization_name}} in every message the app builds.
 */
export interface OrganizationNames {
  org_name_en: string;
  org_name_ta: string;
}

/** Used until settings load, and on databases that predate migration 00009. */
export const DEFAULT_ORGANIZATION_NAMES: OrganizationNames = {
  org_name_en: 'VP TRUST',
  org_name_ta: 'வள்ளலார் பசியாற்றுமையம் அறக்கட்டளை',
};

/** Reads the names from an organization_settings row, falling back to the defaults for missing columns. */
export function organizationNamesFrom(
  row: { org_name_en?: string | null; org_name_ta?: string | null } | null | undefined
): OrganizationNames {
  return {
    org_name_en: row?.org_name_en ?? DEFAULT_ORGANIZATION_NAMES.org_name_en,
    org_name_ta: row?.org_name_ta ?? DEFAULT_ORGANIZATION_NAMES.org_name_ta,
  };
}

/** What {{organization_name}} renders as: English on the first line, Tamil on the second. */
export function formatOrganizationName(names: OrganizationNames): string {
  return [names.org_name_en, names.org_name_ta].map((n) => n.trim()).filter(Boolean).join('\n');
}
