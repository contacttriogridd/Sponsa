import { formatCurrency, normalizeDonationType } from '@/lib/constants';
import type { OrganizationNames } from '@/lib/organization';
import type { Donation, Sponsor } from '@/lib/types';

export type ThankYouChannel = 'whatsapp' | 'sms' | 'email' | 'copy';

export const THANK_YOU_CHANNEL_LABELS: Record<ThankYouChannel, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'Email',
  copy: 'Copy',
};

/** The one donation thank-you message; every screen fills this through fillTemplate. */
export const THANK_YOU_TEMPLATE = `Dear {{donor_name}},
Thank you for your generous donation of {{donation_type}} on {{donation_date}}.
Your kindness helps us continue feeding the hungry and serving those in need.
May Vallalar's blessings be with you and your family always.
With heartfelt gratitude,

அருட்பெருஞ்ஜோதி அருட்பெருஞ்ஜோதி தனிப்பெருங்கருணை அருட்பெருஞ்ஜோதி

அன்புள்ள திரு. {{donor_name}} அவர்களுக்கு,
{{donation_date}} அன்று நீங்கள் வழங்கிய {{donation_purpose_ta}} நன்கொடைக்கு எங்களின் மனமார்ந்த நன்றிகள்.
உங்கள் அன்பும் கருணையும் பசித்தோருக்கு உணவளிக்கும் எங்கள் சேவைக்கு பெரும் உறுதுணையாக உள்ளது.
நீங்களும் உங்கள் அன்புக்குடும்பமும் எல்லாம் வல்ல இறையாற்றலின் கருணையினால் எவ்வகையேனும் ஏற்றமுடன் வாழ்க வளமுடன்.

நன்றியுடன்,
{{organization_name}}
({{organization_name_ta}})`;

export const DEFAULT_DONATION_PURPOSE_TA = 'ஆதரவற்ற முதியவர்களுக்கான அன்னதான உணவு';
export const THANK_YOU_EMAIL_SUBJECT = 'Thank you for your donation - VP TRUST';

/** Fills {{placeholders}}; one with no value becomes empty, so raw placeholders never show. */
export function fillTemplate(template: string, data: Record<string, string | null | undefined>): string {
  return template
    .replace(/\r\n?/g, '\n')
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => data[key] ?? '');
}

/** The admin's saved template from organization_settings, or the built-in one. */
export function thankYouTemplateFrom(row: { thank_you_template?: string | null } | null | undefined): string {
  return row?.thank_you_template?.trim() || THANK_YOU_TEMPLATE;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "DD Mon YYYY", e.g. 30 Oct 2026. */
export function formatDonationDate(date: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date || '');
  return m ? `${m[3]} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
}

/** Placeholder values from the donation record, with safe fallbacks for empty fields. */
export function thankYouData(
  sponsor: Pick<Sponsor, 'full_name' | 'preferred_name'>,
  donation: Pick<Donation, 'donation_date' | 'type'>,
  organization: OrganizationNames,
): Record<string, string> {
  return {
    donor_name: sponsor.preferred_name?.trim() || sponsor.full_name?.trim() || 'Donor',
    donation_type: donation.type ? normalizeDonationType(donation.type) : 'your donation',
    donation_date: formatDonationDate(donation.donation_date) || 'the recent date',
    donation_purpose_ta: DEFAULT_DONATION_PURPOSE_TA,
    organization_name: organization.org_name_en,
    organization_name_ta: organization.org_name_ta,
  };
}

/** Short summary line for the dialog, e.g. "₹1,000 · 30 Oct 2026 · Money". */
export function donationSummary(donation: Pick<Donation, 'amount' | 'donation_date' | 'type'>): string {
  return [
    Number(donation.amount) > 0 ? formatCurrency(Number(donation.amount)) : null,
    formatDonationDate(donation.donation_date),
    normalizeDonationType(donation.type),
  ].filter(Boolean).join(' · ');
}

/** Phone for sms: links — digits with a leading +, India's code added to 10-digit numbers. */
export function smsNumber(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) digits = `91${digits}`;
  return `+${digits}`;
}

export function buildSmsUrl(phone: string, message: string): string {
  return `sms:${smsNumber(phone)}?body=${encodeURIComponent(message)}`;
}

export function buildEmailUrl(email: string, message: string): string {
  return `mailto:${email.trim()}?subject=${encodeURIComponent(THANK_YOU_EMAIL_SUBJECT)}&body=${encodeURIComponent(message)}`;
}
