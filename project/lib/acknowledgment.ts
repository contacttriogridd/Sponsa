/**
 * Acknowledgment to the admin (Udhaya Sir) for every donation received.
 * Pure, so it can be tested; sending lives in components/shared/AcknowledgmentButton.
 */

import { categoryOf } from '@/lib/donations';
import { formatDateLabel } from '@/lib/messaging';
import { normalizePhone } from '@/lib/phone';

export interface AckRecipient {
  name: string;
  whatsapp: string;
  email: string;
}

export const DEFAULT_ACK_RECIPIENT: AckRecipient = { name: 'Udhaya Sir', whatsapp: '919629522777', email: '' };

/** From organization_settings; falls back to the admin number, then Udhaya Sir's. */
export function ackRecipientFrom(row: Record<string, unknown> | null | undefined): AckRecipient {
  const number = (row?.ack_whatsapp as string) || (row?.admin_whatsapp_number as string) || DEFAULT_ACK_RECIPIENT.whatsapp;
  return {
    name: (row?.ack_name as string) || (row?.admin_name as string) || DEFAULT_ACK_RECIPIENT.name,
    whatsapp: normalizePhone(number)?.waDigits || number,
    email: (row?.ack_email as string) || '',
  };
}

export const ACK_TEMPLATE =
  'Donation received: ₹{{amount}} from {{sponsor_name}} ({{sponsor_category}}) on {{donation_date}} via {{payment_mode}}. Receipt No: {{receipt_no}}. Recorded by {{recorded_by}}.';

interface AckDonation {
  amount: number | string | null;
  donation_date: string;
  payment_method?: string | null;
  receipt_number?: string | null;
  sponsor_category?: string | null;
  sponsor_type?: string | null;
  monthly_sponsor_id?: string | null;
  type?: string | null;
}

/** "Donation received: ₹5,000 from Ravi (Birthday) on 21 Nov 2026 via UPI. Receipt No: VPT-2026-00012. Recorded by Priya." */
export function buildAckMessage(d: AckDonation, sponsorName: string, recordedBy: string): string {
  const amount = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Number(d.amount) || 0);
  const values: Record<string, string> = {
    amount,
    sponsor_name: sponsorName.trim() || 'Anonymous',
    sponsor_category: categoryOf(d),
    donation_date: formatDateLabel(d.donation_date),
    payment_mode: d.payment_method || 'Not recorded',
    receipt_no: d.receipt_number || '—',
    recorded_by: recordedBy.trim() || 'VP TRUST',
  };
  return ACK_TEMPLATE.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k: string) => values[k] ?? '');
}

export const ACK_STATUS_LABELS: Record<string, string> = { sent: 'Sent', failed: 'Failed', pending: 'Pending' };
