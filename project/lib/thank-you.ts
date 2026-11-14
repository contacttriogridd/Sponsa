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

export type ThankYouLanguage = 'en' | 'ta';
/** What the Send Thanks toggle offers: one language, or Tamil then English in one message. */
export type ThanksLanguageChoice = ThankYouLanguage | 'both';

export const THANKS_LANGUAGE_OPTIONS: { value: ThanksLanguageChoice; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'ta', label: 'தமிழ்' },
  { value: 'both', label: 'Both' },
];

/** Between the Tamil and English parts of a "Both" message. */
export const BOTH_DIVIDER = '━━━━━━━━━━━━━━';

/** Built-in English thank-you note; the database copy (organization_settings.thank_you_template_en) wins. */
export const THANK_YOU_TEMPLATE_EN = `🙏 Vanakkam {{sponsor_name}},

On behalf of {{organization_name}}, we sincerely thank you for your generous donation of {{amount}} received on {{donation_date}}.

Your kindness helps us continue our service of feeding the hungry, in the path shown by Vallalar. Every rupee you give reaches someone in need.

With heartfelt gratitude,
{{organization_name}}`;

/** Built-in Tamil thank-you note; the database copy (organization_settings.thank_you_template_ta) wins. */
export const THANK_YOU_TEMPLATE_TA = `🙏  மக்கள் சேவையே மகேசன் சேவை {{sponsor_name}} அவர்களுக்கு வணக்கம் 

{{donation_date}} அன்று நீங்கள் வழங்கிய {{amount}} நன்கொடைக்கு {{organization_name}} சார்பாக எங்கள் மனமார்ந்த வாழ்த்துக்களையும் நன்றிகளையும் தெரிவித்துக் கொள்கிறோம்.

வள்ளலார் காட்டிய வழியில் பசித்தவர்களுக்கு உணவளிக்கும் எங்கள் சேவையைத் தொடர உங்கள் மேலான உதவி பெரிதும் ஊக்கமளிக்கிறது. 

நன்றியுடன்,
{{organization_name}}`;

export const THANK_YOU_DEFAULTS: Record<ThankYouLanguage, string> = { en: THANK_YOU_TEMPLATE_EN, ta: THANK_YOU_TEMPLATE_TA };

/** Placeholders offered in the template editor. */
export const THANK_YOU_PLACEHOLDERS = ['{{sponsor_name}}', '{{amount}}', '{{donation_date}}', '{{organization_name}}'] as const;

export const DEFAULT_DONATION_PURPOSE_TA = 'ஆதரவற்ற முதியவர்களுக்கான அன்னதான உணவு';
export const THANK_YOU_EMAIL_SUBJECT = 'Thank you for your donation - VP TRUST';

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

function normalizeLineBreaks(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

/** Fills {{placeholders}}; one with no value becomes empty, so raw placeholders never show. */
export function fillTemplate(template: string, data: Record<string, string | null | undefined>): string {
  return normalizeLineBreaks(template)
    .replace(PLACEHOLDER, (_match, key: string) => data[key] ?? '');
}

/** Fills only the placeholders that have a value; any other stays as typed, for unfilledPlaceholders to catch. */
export function fillKnown(template: string, data: Record<string, string | null | undefined>): string {
  return normalizeLineBreaks(template)
    .replace(PLACEHOLDER, (match, key: string) => data[key] || match);
}

/** Raw placeholders left in a message, e.g. ["{{amount}}"]. */
export function unfilledPlaceholders(text: string): string[] {
  return Array.from(new Set(text.match(PLACEHOLDER) || []));
}

/** The English and Tamil templates from organization_settings, or the built-in ones. */
export function thankYouTemplatesFrom(
  row: { thank_you_template_en?: string | null; thank_you_template_ta?: string | null } | null | undefined,
): Record<ThankYouLanguage, string> {
  return {
    en: row?.thank_you_template_en?.trim() ? row.thank_you_template_en : THANK_YOU_TEMPLATE_EN,
    ta: row?.thank_you_template_ta?.trim() ? row.thank_you_template_ta : THANK_YOU_TEMPLATE_TA,
  };
}

/** Indian-style rupees with no decimals: ₹5,000, ₹1,00,000. Empty for a missing or zero amount. */
export function formatThanksAmount(amount: number | string | null | undefined): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "D Mon YYYY", e.g. 13 Nov 2026. */
export function formatDonationDate(date: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(date || '');
  return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
}

function asChoice(value: unknown): ThanksLanguageChoice | null {
  return value === 'en' || value === 'ta' || value === 'both' ? value : null;
}

/** The toggle's starting option: this user's last choice, else the Settings default, else Tamil. */
export function thanksLanguageChoice(userChoice: unknown, orgDefault: unknown): ThanksLanguageChoice {
  return asChoice(userChoice) || asChoice(orgDefault) || 'ta';
}

/**
 * Placeholder values from this one donation record. {{amount}} is left out
 * when the amount is missing or 0, so the message can't go out as "₹0".
 */
export function thankYouData(
  sponsor: Pick<Sponsor, 'full_name' | 'preferred_name'>,
  donation: Pick<Donation, 'donation_date' | 'type' | 'amount'>,
  organization: OrganizationNames,
  language: ThankYouLanguage,
): Record<string, string> {
  const name = sponsor.preferred_name?.trim() || sponsor.full_name?.trim() || '';
  return {
    sponsor_name: name,
    donor_name: name,
    amount: formatThanksAmount(donation.amount),
    donation_date: formatDonationDate(donation.donation_date),
    donation_type: donation.type ? normalizeDonationType(donation.type) : '',
    donation_purpose_ta: DEFAULT_DONATION_PURPOSE_TA,
    organization_name: language === 'en' ? organization.org_name_en : organization.org_name_ta,
    organization_name_en: organization.org_name_en,
    organization_name_ta: organization.org_name_ta,
  };
}

/** The filled message: one language, or for "Both" the Tamil note, a divider, then the English note. */
export function buildThankYouMessage(
  templates: Record<ThankYouLanguage, string>,
  sponsor: Pick<Sponsor, 'full_name' | 'preferred_name'>,
  donation: Pick<Donation, 'donation_date' | 'type' | 'amount'>,
  organization: OrganizationNames,
  choice: ThanksLanguageChoice,
): string {
  const one = (language: ThankYouLanguage) => fillKnown(templates[language], thankYouData(sponsor, donation, organization, language));
  if (choice !== 'both') return one(choice);
  return [one('ta').trim(), BOTH_DIVIDER, one('en').trim()].join('\n\n');
}

/** Why a thank-you can't be sent yet, or null when it can. */
export function thanksBlockReason(text: string, donation: Pick<Donation, 'amount'>): string | null {
  if (!formatThanksAmount(donation.amount)) return 'This donation has no amount. Please update the donation amount first, then send thanks.';
  const left = unfilledPlaceholders(text);
  if (left.length) return `The message still has ${left.join(', ')}. Replace it before sending.`;
  return null;
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
