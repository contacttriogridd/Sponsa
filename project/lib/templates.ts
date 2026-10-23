import { formatOrganizationName, type OrganizationNames } from '@/lib/organization';

/** Sign-off every template ends with; new templates start with it. */
export const ORGANIZATION_SIGN_OFF = 'With gratitude,\n{{organization_name}}';

export type TemplateData = Record<string, string | null | undefined>;

/**
 * Fills in a template's {{variables}}. This is the one place variables are
 * replaced, so previews, WhatsApp messages and reminders all read the same.
 * {{organization_name}} (English and Tamil on two lines), {{organization_name_english}}
 * and {{organization_name_tamil}} always come from the organization settings; any other
 * variable without a value is left as-is (e.g. "{{sponsor_name}}" in a preview).
 */
export function renderTemplate(
  template: string | { body: string },
  data: TemplateData,
  organization: OrganizationNames
): string {
  const body = typeof template === 'string' ? template : template.body;
  const values: TemplateData = {
    ...data,
    organization_name: formatOrganizationName(organization),
    organization_name_english: organization.org_name_en,
    organization_name_tamil: organization.org_name_ta,
  };
  return body
    .replace(/\r\n?/g, '\n')
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => values[key] ?? match);
}

/** True when the last line of the body mentions {{organization_name}}. */
export function hasOrganizationSignOff(body: string): boolean {
  const lines = body.trimEnd().split(/\r?\n/);
  return /\{\{\s*organization_name\s*\}\}/.test(lines[lines.length - 1] || '');
}
