/**
 * Optional amounts (sponsorship amount, monthly amount, requested amount):
 * saved as NULL when not set — never 0 — and shown as "Amount not set".
 * Pure, so it can be tested.
 */

export const AMOUNT_NOT_SET = 'Amount not set / தொகை குறிப்பிடப்படவில்லை';
export const AMOUNT_NOT_SET_EN = 'Amount not set';

/** True when an amount is recorded (0 counts; NULL, undefined, '' and non-numbers do not). */
export function hasAmount(value: unknown): boolean {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) return false;
  return Number.isFinite(Number(value));
}

/** "₹5,000", or "Amount not set / தொகை குறிப்பிடப்படவில்லை". */
export function amountLabel(value: unknown, notSet = AMOUNT_NOT_SET): string {
  if (!hasAmount(value)) return notSet;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value));
}

/** A form's amount box: empty → null (saved as NULL); otherwise it must be a positive number. */
export function parseOptionalAmount(text: string | number | null | undefined): { value: number | null; error: string | null } {
  const raw = String(text ?? '').trim();
  if (!raw) return { value: null, error: null };
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return { value: null, error: 'Enter an amount greater than 0, or leave it empty.' };
  return { value: n, error: null };
}

const AMOUNT_KEYS = ['amount', 'monthly_amount'];

/**
 * Before a template is filled: when an amount placeholder has no value, the
 * sentence holding it is left out ("Amount: ₹{{amount}}." disappears), and a
 * line left empty is removed — so "₹", "₹0", "₹null" or "₹undefined" never go out.
 */
export function dropMissingAmounts(body: string, values: Record<string, string | null | undefined>, keys: string[] = AMOUNT_KEYS): string {
  const missing = keys.filter((k) => !String(values[k] ?? '').trim() || /^(null|undefined|NaN)$/.test(String(values[k])));
  if (!missing.length) return body;
  const has = (text: string) => missing.some((k) => new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`).test(text));
  return body.replace(/\r\n?/g, '\n').split('\n').flatMap((line) => {
    if (!has(line)) return [line];
    // Sentences end with . ! ? or the Tamil/Hindi danda; keep the ones without the placeholder.
    const sentences = line.match(/[^.!?।]*[.!?।]+\s*|[^.!?।]+$/g) || [line];
    const kept = sentences.filter((s) => !has(s)).join('').replace(/\s+$/, '');
    return kept.trim() ? [kept] : [];
  }).join('\n');
}
