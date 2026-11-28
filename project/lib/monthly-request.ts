/**
 * "Monthly Sponsorship Request": sent to monthly sponsors on the 1st–3rd of
 * every month, in Tamil, English, or both. Pure, so it can be tested.
 */

import { BOTH_DIVIDER } from '@/lib/thank-you';
import type { OrganizationNames } from '@/lib/organization';

export type RequestLanguage = 'ta' | 'en' | 'both';

/** Placeholders offered in the template editor. */
export const REQUEST_PLACEHOLDERS = ['{{sponsor_name}}', '{{amount}}', '{{month_name}}', '{{organization_name}}', '{{payment_details}}'] as const;

/** The approved texts; migration 00031 seeds the same, and "Reset to default" restores them. */
export const DEFAULT_REQUEST_TA = `🙏 மக்கள் சேவையே மகேசன் சேவை
மதிப்பிற்குரிய {{sponsor_name}} அவர்களுக்கு வணக்கம்,

{{organization_name}} சார்பாக உங்களின் தொடர்ந்த ஆதரவிற்கு எங்கள் மனமார்ந்த நன்றி. வள்ளலார் காட்டிய வழியில் பசித்தவர்களுக்கு உணவளிக்கும் எங்கள் சேவை, உங்களைப் போன்ற அன்புள்ளங்களின் உதவியால் தொடர்ந்து நடைபெற்று வருகிறது.

இந்த {{month_name}} மாதத்திற்கான உங்களின் மாதாந்திர நன்கொடை {{amount}} வழங்கி, எங்கள் அன்னதான சேவையைத் தொடர உதவுமாறு அன்புடன் கேட்டுக்கொள்கிறோம்.

நன்கொடை அனுப்ப: {{payment_details}}

நன்றியுடன்,
{{organization_name}}`;

export const DEFAULT_REQUEST_EN = `🙏 Vanakkam {{sponsor_name}},

On behalf of {{organization_name}}, thank you for your continued support. Our service of feeding the hungry, in the path shown by Vallalar, goes on every day because of kind hearts like yours.

We humbly request your monthly contribution of {{amount}} for {{month_name}} to help us continue our Annadhanam service.

To donate: {{payment_details}}

With heartfelt gratitude,
{{organization_name}}`;

export const DEFAULT_REQUEST: Record<'ta' | 'en', string> = { ta: DEFAULT_REQUEST_TA, en: DEFAULT_REQUEST_EN };

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_TA = ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'];
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface RequestSponsor { name: string; monthly_amount: number | null; payment_day: number | null }

/** From Settings. payment_details is the "Donation payment details" box; the rest serve older custom templates. */
export interface PaymentDetails { payment_details?: string; upi_id?: string; bank_details?: string; contact_number?: string }

/** "December 2026" / "டிசம்பர் 2026" for a month (YYYY-MM-01). */
export function monthName(month: string, lang: 'ta' | 'en'): string {
  const [y, m] = month.split('-').map(Number);
  return `${(lang === 'ta' ? MONTHS_TA : MONTHS_EN)[m - 1]} ${y}`;
}

/** The due date in `month` (YYYY-MM-01): the payment day, kept inside short months; the 1st when not set. */
export function requestDueDate(sponsor: Pick<RequestSponsor, 'payment_day'>, month: string): string {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const day = Math.min(Math.max(sponsor.payment_day || 1, 1), last);
  return `${month.slice(0, 8)}${String(day).padStart(2, '0')}`;
}

/** ₹1,100 — Indian format, no decimals; '' when no amount is set. */
export function requestAmount(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || String(amount).trim() === '' || !Number.isFinite(Number(amount))) return '';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(amount));
}

export function requestValues(sponsor: RequestSponsor, month: string, lang: 'ta' | 'en', org: OrganizationNames, pay: PaymentDetails): Record<string, string> {
  const [y, m] = month.split('-').map(Number);
  const due = requestDueDate(sponsor, month);
  return {
    sponsor_name: sponsor.name.trim(),
    amount: requestAmount(sponsor.monthly_amount),
    month_name: monthName(month, lang),
    organization_name: lang === 'ta' ? org.org_name_ta : org.org_name_en,
    payment_details: (pay.payment_details || '').trim(),
    // Placeholders of the earlier template, still filled for edited templates that use them.
    month: monthName(month, lang),
    sponsor_date: `${Number(due.slice(8))} ${SHORT[m - 1]} ${y}`,
    upi_id: (pay.upi_id || '').trim(),
    bank_details: (pay.bank_details || '').trim(),
    contact_number: (pay.contact_number || '').trim(),
  };
}

const P = (name: string) => `\\{\\{\\s*${name}\\s*\\}\\}`;

/**
 * Removes what has no value, so a raw {{…}}, "₹" or empty "To donate:" never goes out:
 *   no amount   → Tamil " {{amount}}" removed ("…மாதாந்திர நன்கொடை வழங்கி…");
 *                 English "your monthly contribution of {{amount}} for" → "your monthly contribution for"
 *   no payment details → the whole "நன்கொடை அனுப்ப / To donate" line removed
 */
export function prepareRequestBody(body: string, values: Record<string, string>): string {
  let text = body.replace(/\r\n?/g, '\n').replace(new RegExp(`₹\\s*(${P('amount')})`, 'g'), '$1'); // older "₹{{amount}}"
  if (!values.amount) {
    text = text
      .replace(new RegExp(`your monthly contribution of ${P('amount')} for`, 'gi'), 'your monthly contribution for')
      .replace(new RegExp(`(Amount|தொகை)\\s*:\\s*${P('amount')}\\.?\\s*`, 'g'), '')
      .replace(new RegExp(`\\s+of\\s+${P('amount')}`, 'g'), '')
      .replace(new RegExp(`\\s*${P('amount')}`, 'g'), '');
  }
  for (const key of ['payment_details', 'upi_id', 'bank_details', 'contact_number']) {
    if (values[key]) continue;
    // A whole line for it (e.g. "To donate: {{payment_details}}") goes; inside a sentence, just the sentence.
    text = text.split('\n').filter((line) => !new RegExp(`^[^.!?]*${P(key)}[^.!?]*$`).test(line.trim()) || !new RegExp(P(key)).test(line)).join('\n')
      .replace(new RegExp(`[^.!?\\n]*${P(key)}[^.!?\\n]*[.!?]?\\s*`, 'g'), '');
  }
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
}

/** Fills the placeholders; one without a value becomes empty, so a raw {{…}} never goes out. */
export function fillRequest(body: string, values: Record<string, string>): string {
  return prepareRequestBody(body, values).replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => values[k] ?? '').trim();
}

/** Tamil, English, or Both — Tamil first, the divider, then English (as the thank-you notes). */
export function buildRequestMessage(
  templates: { ta: string; en: string }, sponsor: RequestSponsor, month: string, lang: RequestLanguage, org: OrganizationNames, pay: PaymentDetails,
): string {
  const one = (l: 'ta' | 'en') => fillRequest(templates[l]?.trim() ? templates[l] : DEFAULT_REQUEST[l], requestValues(sponsor, month, l, org, pay));
  return lang === 'both' ? [one('ta'), BOTH_DIVIDER, one('en')].join('\n\n') : one(lang);
}
