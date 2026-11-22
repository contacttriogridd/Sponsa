/**
 * The one phone normalizer for the whole app (pages, dialogs, API routes and
 * cron jobs). Default country India (+91).
 *
 *   "98765 43210", "098765-43210", "+91 98765 43210", "919876543210",
 *   "0091 98765 43210", "+919876543210"  →  +919876543210
 *   "+44 20 7946 0958" (another country, written with +)  →  kept as is
 *   anything else  →  null (never guessed)
 */

export interface NormalizedPhone {
  /** "+919876543210" — what is stored. */
  e164: string;
  /** "919876543210" — digits only, for wa.me / sms: / tel: links and the WhatsApp API. */
  waDigits: string;
  /** "+91 98765 43210" — shown in the UI. */
  display: string;
}

export function normalizePhone(input: string | number | null | undefined): NormalizedPhone | null {
  if (input == null) return null;
  // Drop invisible characters (zero-width spaces, direction marks, BOM, NBSP) first.
  const raw = String(input).replace(/[​-‏‪-‮⁠-⁤﻿ ]/g, ' ').trim();
  if (!raw) return null;
  let digits = raw.replace(/\D/g, '');
  let international = raw.startsWith('+');
  if (digits.startsWith('00')) { digits = digits.slice(2); international = true; }

  // Another country's number, written with + or 00: keep it if it is a plausible length.
  if (international && !digits.startsWith('91')) {
    return digits.length >= 8 && digits.length <= 15 ? { e164: `+${digits}`, waDigits: digits, display: `+${digits}` } : null;
  }
  if (!international && digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1); // trunk 0

  let local: string | null = null;
  if (digits.length === 10 && /^[6-9]/.test(digits)) local = digits;
  else if (digits.length === 12 && /^91[6-9]/.test(digits)) local = digits.slice(2);
  if (!local) return null;
  return { e164: `+91${local}`, waDigits: `91${local}`, display: `+91 ${local.slice(0, 5)} ${local.slice(5)}` };
}

export const isValidPhone = (input: string | null | undefined) => normalizePhone(input) !== null;

/** What is wrong with a number, for the "can't send" message: missing, invalid, or nothing. */
export function phoneProblem(input: string | null | undefined): 'missing' | 'invalid' | null {
  if (!input || !String(input).trim()) return 'missing';
  return normalizePhone(input) ? null : 'invalid';
}

export const INVALID_PHONE_MESSAGE = "This contact's phone number is invalid. Please update it.";
export const PHONE_INPUT_ERROR = 'Enter a valid 10-digit mobile number';

/** Stored form (+91XXXXXXXXXX), or null when empty or invalid. */
export function toE164(input: string | null | undefined): string | null {
  return normalizePhone(input)?.e164 ?? null;
}

/** "+91 98765 43210", or the value as saved when it is not a valid number. */
export function displayPhone(input: string | null | undefined): string {
  return normalizePhone(input)?.display ?? (input || '').trim();
}

// ---------------------------------------------------------------- links
// Every WhatsApp / sms: / tel: link in the app comes from these. They return null
// for a missing or invalid number, so a link never opens WhatsApp's "Send to…"
// picker or a broken chat. Messages are encodeURIComponent-encoded, so Tamil
// text, ₹, emoji and line breaks survive.

/**
 * Click-to-chat link. Uses api.whatsapp.com/send rather than wa.me: wa.me
 * redirects there and, in that redirect, replaces emoji such as 🙏 with "�"
 * (seen on WhatsApp Web / Desktop). api.whatsapp.com/send opens the same chat
 * directly — the WhatsApp app on phones, WhatsApp Web / Desktop on computers —
 * with the message intact.
 */
export function buildWhatsAppLink(phone: string | null | undefined, message?: string | null): string | null {
  const n = normalizePhone(phone);
  if (!n) return null;
  const base = `https://api.whatsapp.com/send?phone=${n.waDigits}`;
  return message ? `${base}&text=${encodeURIComponent(message)}` : base;
}

export function buildSmsLink(phone: string | null | undefined, message?: string | null): string | null {
  const n = normalizePhone(phone);
  if (!n) return null;
  return message ? `sms:+${n.waDigits}?body=${encodeURIComponent(message)}` : `sms:+${n.waDigits}`;
}

export function buildCallLink(phone: string | null | undefined): string | null {
  const n = normalizePhone(phone);
  return n ? `tel:+${n.waDigits}` : null;
}

// ---------------------------------------------------------------- older helpers
// Kept for existing callers; both go through normalizePhone.

/** WhatsApp digits (91XXXXXXXXXX), or '' when missing or invalid — so "can I send?" checks fail safely. */
export function whatsappNumber(phone: string | null | undefined): string {
  return normalizePhone(phone)?.waDigits ?? '';
}

/** An Indian mobile number as 91XXXXXXXXXX, or null if it isn't one. */
export function normalizeIndianNumber(phone: string | null | undefined): string | null {
  const n = normalizePhone(phone);
  return n && n.waDigits.startsWith('91') && n.waDigits.length === 12 ? n.waDigits : null;
}
