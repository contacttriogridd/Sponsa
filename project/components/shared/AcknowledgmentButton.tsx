'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Mail, RotateCcw, Send, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase/client';
import { ackRecipientFrom, buildAckMessage, type AckRecipient } from '@/lib/acknowledgment';
import { messagingSettingsFrom, type SendMode } from '@/lib/messaging';
import { logMessage, sendViaApi } from '@/lib/message-service';
import { buildWhatsAppUrl } from '@/lib/whatsapp';
import { notifyDrawerDataChanged } from '@/lib/drawer-store';
import { cn } from '@/lib/utils';
import type { Donation } from '@/lib/types';
import { PhoneLink } from '@/components/shared/PhoneLink';

export interface AckContext { recipient: AckRecipient; sendMode: SendMode }

let cache: Promise<AckContext> | null = null;
export function loadAckContext(): Promise<AckContext> {
  cache ??= (async () => {
    const { data } = await supabase.from('organization_settings').select('*').limit(1).maybeSingle();
    return { recipient: ackRecipientFrom(data), sendMode: messagingSettingsFrom(data).sendMode };
  })();
  return cache;
}
export function clearAckContext() { cache = null; }

const userNames = new Map<string, Promise<string>>();
function userName(id: string | null | undefined): Promise<string> {
  if (!id) return Promise.resolve('');
  if (!userNames.has(id)) {
    userNames.set(id, Promise.resolve(supabase.from('app_users').select('full_name, email').eq('id', id).maybeSingle())
      .then(({ data }) => data?.full_name || data?.email || ''));
  }
  return userNames.get(id)!;
}

type AckDonation = Pick<Donation, 'id' | 'amount' | 'donation_date' | 'payment_method' | 'receipt_number' | 'sponsor_category' | 'sponsor_type' | 'monthly_sponsor_id' | 'type' | 'created_by' | 'acknowledgment_status' | 'sponsor_id'>;

/** The acknowledgment text for a donation. */
export async function ackMessageFor(d: AckDonation, sponsorName: string): Promise<string> {
  return buildAckMessage(d, sponsorName, await userName(d.created_by));
}

async function record(d: AckDonation, sponsorName: string, recipient: AckRecipient, message: string, status: 'sent' | 'failed', channel: 'whatsapp_api' | 'whatsapp_link', error?: string) {
  await supabase.from('donations').update({ acknowledgment_status: status, acknowledgment_sent_at: status === 'sent' ? new Date().toISOString() : null }).eq('id', d.id);
  await logMessage({
    sponsorId: d.sponsor_id || null, sponsorName, monthlySponsorId: d.monthly_sponsor_id || null, messageType: 'donation_acknowledgment',
    typeLabel: `Donation acknowledgment to ${recipient.name}`, relatedDonationId: d.id, occurrenceDate: d.donation_date, messageText: message,
    recipient: 'admin', recipientPhone: recipient.whatsapp, channel, status: channel === 'whatsapp_link' ? 'opened' : status, errorMessage: error || null,
  });
  notifyDrawerDataChanged();
}

/**
 * Automatic mode only: sends the acknowledgment through the WhatsApp API and
 * saves Sent / Failed on the donation. Returns null in manual mode (the
 * button below opens WhatsApp instead).
 */
export async function autoAcknowledge(d: AckDonation, sponsorName: string): Promise<'sent' | 'failed' | null> {
  const ctx = await loadAckContext();
  if (ctx.sendMode !== 'automatic') return null;
  const message = await ackMessageFor(d, sponsorName);
  const result = await sendViaApi(ctx.recipient.whatsapp, message);
  const status = result.success ? 'sent' : 'failed';
  await record(d, sponsorName, ctx.recipient, message, status, 'whatsapp_api', result.error);
  return status;
}

/** Manual mode: marks the acknowledgment sent when its WhatsApp link is opened. */
export async function markAckOpened(d: AckDonation, sponsorName: string, message: string) {
  const ctx = await loadAckContext();
  await record(d, sponsorName, ctx.recipient, message, 'sent', 'whatsapp_link');
}

/** Status of the acknowledgment to Udhaya Sir, with Send / Resend. */
export function AcknowledgmentButton({ donation, sponsorName, onChanged }: { donation: AckDonation; sponsorName: string; onChanged?: () => void }) {
  const [ctx, setCtx] = useState<AckContext | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [status, setStatus] = useState(donation.acknowledgment_status || null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setStatus(donation.acknowledgment_status || null); }, [donation.acknowledgment_status]);
  // Prepared up front so a click opens WhatsApp straight away (not blocked as a pop-up).
  useEffect(() => {
    let cancelled = false;
    Promise.all([loadAckContext(), ackMessageFor(donation, sponsorName)]).then(([c, m]) => { if (!cancelled) { setCtx(c); setMessage(m); } });
    return () => { cancelled = true; };
  }, [donation, sponsorName]);

  const label = status === 'sent' ? 'Ack sent' : status === 'failed' ? 'Ack failed' : 'Send ack';
  const Icon = status === 'sent' ? CheckCircle2 : status === 'failed' ? XCircle : Send;
  const tone = status === 'sent' ? 'text-success' : status === 'failed' ? 'text-destructive' : 'text-warning-foreground';
  const title = ctx ? `${status === 'sent' ? 'Resend' : 'Send'} acknowledgment to ${ctx.recipient.name} (${ctx.recipient.whatsapp})` : 'Acknowledgment';

  async function sendAutomatic() {
    setBusy(true);
    const result = await autoAcknowledge(donation, sponsorName);
    setBusy(false);
    if (result) setStatus(result);
    onChanged?.();
  }

  const content = (
    <Button variant="ghost" size="sm" disabled={!ctx || !message || busy} className={cn('h-8 px-2 text-xs', tone)} title={title}>
      <Icon className="h-3.5 w-3.5 mr-1" />{busy ? 'Sending…' : label}
      {status === 'sent' && <RotateCcw className="h-3 w-3 ml-1 opacity-60" aria-label="Resend" />}
    </Button>
  );

  return (
    <span className="inline-flex items-center" onClick={(e) => e.stopPropagation()}>
      {ctx && message && ctx.sendMode !== 'automatic' ? (
        <PhoneLink href={buildWhatsAppUrl(ctx.recipient.whatsapp, message)} newTab editHref="/settings"
          onClick={() => { setStatus('sent'); markAckOpened(donation, sponsorName, message).then(() => onChanged?.()); }}>
          {content}
        </PhoneLink>
      ) : (
        <span onClick={() => ctx && message && sendAutomatic()}>{content}</span>
      )}
      {ctx?.recipient.email && message && (
        <a href={`mailto:${ctx.recipient.email}?subject=${encodeURIComponent('Donation received')}&body=${encodeURIComponent(message)}`} title={`Email ${ctx.recipient.email}`}
          className="p-1.5 text-muted-foreground hover:text-foreground"><Mail className="h-3.5 w-3.5" /></a>
      )}
    </span>
  );
}
