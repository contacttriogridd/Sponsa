/**
 * "Numbers to fix": saved phone numbers that are not valid (lib/phone.ts →
 * normalizePhone), so messages to them can't be sent. Pure, so it can be tested;
 * the Admin page loads the rows and saves the fixes.
 */
import { normalizePhone } from '@/lib/phone';

export interface PhoneIssue {
  key: string;
  table: string;
  column: string;
  id: string;
  name: string;
  /** Where the number is used, e.g. "Sponsor · WhatsApp". */
  where: string;
  value: string;
  /** Page to open the record, when there is one. */
  href: string | null;
  /** Monthly sponsor to open in the drawer. */
  monthlyId?: string | null;
}

type Row = Record<string, unknown> & { id: string };

export interface PhoneSources {
  sponsors?: Row[];
  family_members?: Row[];
  monthly_sponsors?: Row[];
  monthly_family_members?: Row[];
  special_occasions?: Row[];
  app_users?: Row[];
  organization_settings?: Row[];
}

const bad = (v: unknown) => typeof v === 'string' && v.trim() !== '' && !normalizePhone(v);

/** Every non-empty, invalid number, with where it is used. */
export function findPhoneIssues(src: PhoneSources): PhoneIssue[] {
  const out: PhoneIssue[] = [];
  const add = (table: string, column: string, row: Row, name: string, where: string, href: string | null, monthlyId?: string | null) => {
    const value = row[column];
    if (bad(value)) out.push({ key: `${table}:${row.id}:${column}`, table, column, id: row.id, name, where, value: String(value), href, monthlyId });
  };
  for (const s of src.sponsors || []) {
    add('sponsors', 'whatsapp', s, String(s.full_name || ''), 'Sponsor · Mobile (WhatsApp)', `/sponsors/${s.id}`);
    add('sponsors', 'phone', s, String(s.full_name || ''), 'Sponsor · Alternate mobile', `/sponsors/${s.id}`);
  }
  for (const m of src.family_members || []) {
    add('family_members', 'phone', m, String(m.full_name || ''), 'Family member · Phone', `/sponsors/${m.sponsor_id}`);
    add('family_members', 'whatsapp', m, String(m.full_name || ''), 'Family member · WhatsApp', `/sponsors/${m.sponsor_id}`);
  }
  for (const m of (src.monthly_sponsors || []).filter((x) => !x.deleted_at)) {
    add('monthly_sponsors', 'phone', m, String(m.name || ''), 'Monthly sponsor · Phone', null, m.id);
  }
  for (const m of src.monthly_family_members || []) {
    add('monthly_family_members', 'phone', m, String(m.name || ''), 'Monthly sponsor family · Phone', null, String(m.monthly_sponsor_id || ''));
  }
  for (const o of (src.special_occasions || []).filter((x) => x.active !== false)) {
    add('special_occasions', 'contact_phone', o, String(o.contact_name || o.person_name || ''), 'Occasion · Contact phone', `/sponsors/${o.sponsor_id}`);
  }
  for (const u of src.app_users || []) add('app_users', 'phone', u, String(u.full_name || u.email || ''), 'Staff user · Phone', '/settings/users');
  for (const o of src.organization_settings || []) {
    add('organization_settings', 'phone', o, 'Organization', 'Settings · Organization phone', '/settings');
    add('organization_settings', 'admin_whatsapp_number', o, 'Admin', 'Settings · Admin WhatsApp', '/settings');
    add('organization_settings', 'ack_whatsapp', o, 'Acknowledgment recipient', 'Settings · Acknowledgment WhatsApp', '/settings');
  }
  return out;
}

/** The selects the page and the badge use. */
export const PHONE_SOURCE_QUERIES: Record<keyof PhoneSources, string> = {
  sponsors: 'id, full_name, phone, whatsapp',
  family_members: 'id, sponsor_id, full_name, phone, whatsapp',
  monthly_sponsors: '*',
  monthly_family_members: 'id, monthly_sponsor_id, name, phone',
  special_occasions: 'id, sponsor_id, person_name, contact_name, contact_phone, active',
  app_users: 'id, full_name, email, phone',
  organization_settings: '*',
};
