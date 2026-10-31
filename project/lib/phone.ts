/**
 * WhatsApp number for wa.me: digits only, in international form. Handles the
 * ways Indian numbers are usually written — "+91 96295 22777",
 * "96295 22777", "096295 22777", "0091 96295 22777".
 */
export function whatsappNumber(phone: string | null | undefined): string {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2); // international prefix 00
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1); // trunk 0
  return digits.length === 10 ? `91${digits}` : digits;
}

/** An Indian mobile number as 91XXXXXXXXXX, or null if it isn't one. */
export function normalizeIndianNumber(phone: string | null | undefined): string | null {
  const n = whatsappNumber(phone);
  return /^91[6-9]\d{9}$/.test(n) ? n : null;
}
