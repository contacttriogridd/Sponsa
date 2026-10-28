import { renderTemplate } from '@/lib/templates';
import { formatCurrency, normalizeDonationType } from '@/lib/constants';
import type { OrganizationNames } from '@/lib/organization';
import type { Donation, Sponsor } from '@/lib/types';

export type ThankYouLanguage = 'en' | 'ta' | 'both';
export type ThankYouChannel = 'whatsapp' | 'sms' | 'email' | 'copy';

export const THANK_YOU_CHANNEL_LABELS: Record<ThankYouChannel, string> = {
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  email: 'Email',
  copy: 'Copy',
};

export const DEFAULT_THANK_YOU_EN = `Dear {{sponsor_name}},
Thank you for your generous donation of {{amount}} on {{date}}.
Your kindness helps us continue feeding the hungry and serving those in need.
May Vallalar's blessings be with you and your family always.
With heartfelt gratitude,`;

export const DEFAULT_THANK_YOU_TA = `அன்புள்ள {{sponsor_name}} அவர்களுக்கு,
{{date}} அன்று நீங்கள் வழங்கிய {{amount}} நன்கொடைக்கு எங்கள் மனமார்ந்த நன்றி.
உங்கள் அன்பும் கருணையும் பசித்தோருக்கு உணவளிக்கும் எங்கள் சேவைக்கு பெரும் துணையாக உள்ளது.
வள்ளலாரின் அருள் உங்களுக்கும் உங்கள் குடும்பத்தினருக்கும் என்றும் கிடைக்கட்டும்.
நன்றியுடன்,`;

export const THANK_YOU_EMAIL_SUBJECT = 'Thank you for your donation - VP TRUST';

export interface ThankYouTemplates {
  en: string;
  ta: string;
}

/** Saved templates from organization_settings, or the defaults when not set. */
export function thankYouTemplatesFrom(row: { thank_you_template_en?: string | null; thank_you_template_ta?: string | null } | null | undefined): ThankYouTemplates {
  return {
    en: row?.thank_you_template_en?.trim() || DEFAULT_THANK_YOU_EN,
    ta: row?.thank_you_template_ta?.trim() || DEFAULT_THANK_YOU_TA,
  };
}

/** e.g. "28 Oct 2026". */
export function formatDonationDate(date: string): string {
  return new Date(`${date.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Placeholder values for a donation. A gift with no money amount (food,
 * goods) is described by its type instead of "₹0".
 */
export function thankYouVariables(sponsor: Pick<Sponsor, 'full_name' | 'preferred_name'>, donation: Pick<Donation, 'amount' | 'donation_date' | 'type' | 'food_quantity'>): Record<string, string> {
  const type = normalizeDonationType(donation.type);
  const amount = Number(donation.amount) > 0
    ? formatCurrency(Number(donation.amount))
    : [type, donation.food_quantity].filter(Boolean).join(' — ');
  return {
    sponsor_name: sponsor.preferred_name || sponsor.full_name,
    amount,
    date: formatDonationDate(donation.donation_date),
    donation_type: type,
  };
}

/** Drops a trailing {{organization_name}} line, since the signature is added once at the end. */
function withoutSignature(template: string): string {
  return template.replace(/\r\n?/g, '\n').replace(/(\n\s*\{\{\s*organization_name\s*\}\}\s*)+$/, '').trimEnd();
}

/**
 * The thank-you message: English, Tamil, or English + blank line + Tamil,
 * always ending with the organization signature from {{organization_name}}
 * (VP TRUST / வள்ளலார் பசியாற்றும் அறக்கட்டளை).
 */
export function buildThankYouMessage(
  language: ThankYouLanguage,
  templates: ThankYouTemplates,
  variables: Record<string, string>,
  organization: OrganizationNames,
): string {
  const parts = language === 'en' ? [templates.en] : language === 'ta' ? [templates.ta] : [templates.en, templates.ta];
  const body = parts.map(withoutSignature).join('\n\n');
  return renderTemplate(`${body}\n{{organization_name}}`, variables, organization);
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
