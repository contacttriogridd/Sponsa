/**
 * Monthly Sponsorship Requests: which active monthly sponsors still need this
 * month's request. Sent on the 1st–3rd of every month (IST); history and late
 * sending stay available on the Requests page. Pure, so it can be tested.
 */

import { normalizePhone } from '@/lib/phone';

export interface MonthlyRequestRow {
  id: string;
  monthly_sponsor_id: string;
  year: number;
  month: number;
  status: 'opened' | 'sent';
  channel?: string | null;
  language?: string | null;
  opened_at?: string | null;
  sent_at?: string | null;
  sent_by_name?: string | null;
  send_count?: number;
}

export interface RequestSponsorLite {
  id: string;
  name: string;
  phone: string | null;
  monthly_amount: number | null;
  payment_day: number | null;
  status: string;
  start_date: string | null;
  deleted_at?: string | null;
  sponsor_id?: string | null;
  sponsors?: { whatsapp?: string | null; phone?: string | null } | null;
}

export type RequestState = 'pending' | 'opened' | 'sent' | 'donated';

export interface RequestStatus<S extends RequestSponsorLite = RequestSponsorLite> {
  sponsor: S;
  phone: string | null;
  validPhone: boolean;
  request: MonthlyRequestRow | null;
  /** A donation recorded for this sponsor since the 1st of the month. */
  donated: boolean;
  state: RequestState;
}

export const REQUEST_STATE_LABELS: Record<RequestState, string> = {
  pending: 'Pending',
  opened: 'WhatsApp opened, not confirmed',
  sent: 'Request Sent',
  donated: 'Already donated',
};

/** True on the 1st, 2nd and 3rd of the month (IST date YYYY-MM-DD). */
export function inRequestWindow(today: string): boolean {
  const day = Number(today.slice(8, 10));
  return day >= 1 && day <= 3;
}

export const monthStart = (date: string) => `${date.slice(0, 7)}-01`;

/** The sponsor's own number, else the linked sponsor's WhatsApp / phone. */
export const requestPhoneOf = (s: RequestSponsorLite) => s.phone || s.sponsors?.whatsapp || s.sponsors?.phone || null;

/**
 * Every active monthly sponsor for the month (paused / stopped / deleted ones,
 * and those starting after the month, left out), with this month's request
 * and whether they have already donated.
 */
export function requestStatuses<S extends RequestSponsorLite>(
  sponsors: S[], requests: MonthlyRequestRow[], donatedIds: Set<string>, month: string,
): RequestStatus<S>[] {
  const [y, m] = month.split('-').map(Number);
  const monthEnd = `${month.slice(0, 7)}-31`;
  return sponsors
    .filter((s) => s.status === 'active' && !s.deleted_at && (!s.start_date || s.start_date <= monthEnd))
    .map((s) => {
      const request = requests.find((r) => r.monthly_sponsor_id === s.id && r.year === y && r.month === m) || null;
      const donated = donatedIds.has(s.id);
      const phone = requestPhoneOf(s);
      const state: RequestState = request?.status === 'sent' ? 'sent' : donated ? 'donated' : request?.status === 'opened' ? 'opened' : 'pending';
      return { sponsor: s, phone, validPhone: !!normalizePhone(phone), request, donated, state };
    })
    .sort((a, b) => a.sponsor.name.localeCompare(b.sponsor.name));
}

export function requestCounts(rows: RequestStatus[]): { pending: number; sent: number; opened: number; donated: number; total: number } {
  return {
    pending: rows.filter((r) => r.state === 'pending' || r.state === 'opened').length,
    sent: rows.filter((r) => r.state === 'sent').length,
    opened: rows.filter((r) => r.state === 'opened').length,
    donated: rows.filter((r) => r.state === 'donated').length,
    total: rows.length,
  };
}

/** "Send All": not yet sent, not already donated, with a valid number. */
export function sendAllQueue<S extends RequestSponsorLite>(rows: RequestStatus<S>[]): RequestStatus<S>[] {
  return rows.filter((r) => (r.state === 'pending' || r.state === 'opened') && r.validPhone);
}

/** Skipped by Send All for an invalid or missing number. */
export function invalidPhoneRows<S extends RequestSponsorLite>(rows: RequestStatus<S>[]): RequestStatus<S>[] {
  return rows.filter((r) => (r.state === 'pending' || r.state === 'opened') && !r.validPhone);
}
