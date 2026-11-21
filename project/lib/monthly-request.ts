/**
 * "Monthly Sponsorship Request": the payment request sent to monthly sponsors,
 * in Tamil and English. Pure, so it can be tested.
 */

import type { OrganizationNames } from '@/lib/organization';

export type RequestLanguage = 'ta' | 'en' | 'both';

export const REQUEST_PLACEHOLDERS = ['{{sponsor_name}}', '{{organization_name}}', '{{month}}', '{{sponsor_date}}', '{{amount}}', '{{upi_id}}', '{{bank_details}}', '{{contact_number}}'] as const;

/** Same text as migration 00028 seeds (used until it is applied, or if a template is emptied). */
export const DEFAULT_REQUEST_EN = 'Vanakkam {{sponsor_name}}, greetings from {{organization_name}}. Your monthly Annadhanam sponsorship for {{month}} is due on {{sponsor_date}}. Amount: ₹{{amount}}. UPI: {{upi_id}}. Thank you for feeding the hungry with us. – {{organization_name}}, {{contact_number}}';
export const DEFAULT_REQUEST_TA = 'வணக்கம் {{sponsor_name}} அவர்களே, {{organization_name}} சார்பாக அன்பான வணக்கங்கள். {{month}} மாதத்திற்கான உங்கள் மாதாந்திர அன்னதான நன்கொடை {{sponsor_date}} அன்று செலுத்த வேண்டியது. தொகை: ₹{{amount}}. UPI: {{upi_id}}. பசித்தவர்களுக்கு உணவளிக்கும் எங்கள் சேவையில் இணைந்திருப்பதற்கு நன்றி. – {{organization_name}}, {{contact_number}}';

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_TA = ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'];
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface RequestSponsor { name: string; monthly_amount: number | null; payment_day: number | null }
export interface PaymentDetails { upi_id: string; bank_details: string; contact_number: string }

/** The due date in `month` (YYYY-MM-01): the payment day, kept inside short months; the 1st when not set. */
export function requestDueDate(sponsor: Pick<RequestSponsor, 'payment_day'>, month: string): string {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Math.min(Math.max(sponsor.payment_day || 1, 1), last);
  return `${month.slice(0, 8)}${String(day).padStart(2, '0')}`;
}

export function requestValues(sponsor: RequestSponsor, month: string, lang: 'ta' | 'en', org: OrganizationNames, pay: PaymentDetails): Record<string, string> {
  const [y, m] = month.split('-').map(Number);
  const due = requestDueDate(sponsor, month);
  return {
    sponsor_name: sponsor.name.trim(),
    organization_name: lang === 'ta' ? org.org_name_ta : org.org_name_en,
    month: `${(lang === 'ta' ? MONTHS_TA : MONTHS_EN)[m - 1]} ${y}`,
    sponsor_date: `${Number(due.slice(8))} ${SHORT[m - 1]} ${y}`,
    amount: sponsor.monthly_amount != null ? new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(sponsor.monthly_amount)) : '',
    upi_id: pay.upi_id.trim(),
    bank_details: pay.bank_details.trim(),
    contact_number: pay.contact_number.trim(),
  };
}

/** Fills placeholders; one without a value becomes empty so a raw {{…}} never goes out. */
export function fillRequest(body: string, values: Record<string, string>): string {
  return body.replace(/\r\n?/g, '\n').replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => values[k] ?? '');
}

/** Tamil, English, or both (Tamil first, a blank line, then English). */
export function buildRequestMessage(
  templates: { ta: string; en: string }, sponsor: RequestSponsor, month: string, lang: RequestLanguage, org: OrganizationNames, pay: PaymentDetails,
): string {
  const one = (l: 'ta' | 'en') => fillRequest(templates[l] || (l === 'ta' ? DEFAULT_REQUEST_TA : DEFAULT_REQUEST_EN), requestValues(sponsor, month, l, org, pay)).trim();
  return lang === 'both' ? `${one('ta')}\n\n${one('en')}` : one(lang);
}
