'use client';

import { supabase } from '@/lib/supabase/client';
import { notifyDrawerDataChanged } from '@/lib/drawer-store';
import { CHANNEL_LABELS, MESSAGE_TYPE_LABELS } from '@/lib/messaging';
import type { MessageLog, MessageType } from '@/lib/types';

/**
 * All message sending and logging. Manual mode opens a wa.me link and logs
 * "opened" until the employee confirms; Automatic mode goes through the server
 * API route. Screens call this, so switching modes needs no UI changes.
 */

export interface LogInput {
  sponsorId?: string | null;
  sponsorName?: string | null;
  sponsorPhone?: string | null;
  messageType: MessageType;
  typeLabel?: string | null;
  relatedEventId?: string | null;
  relatedDonationId?: string | null;
  occurrenceDate: string;
  messageText: string;
  recipient: 'sponsor' | 'admin';
  recipientPhone?: string | null;
  channel: MessageLog['channel'];
  status: MessageLog['status'];
  errorMessage?: string | null;
  providerMessageId?: string | null;
  adminNotified?: boolean;
  by?: { id?: string | null; name?: string | null };
}

const PENDING_KEY = 'vp_pending_messages';

export interface PendingMessage {
  id: string;
  label: string;
  openedAt: number;
}

const listeners = new Set<() => void>();

// Kept in storage: a phone may reload the page when returning from WhatsApp.
export function getPendingMessages(): PendingMessage[] {
  try {
    return JSON.parse(window.localStorage.getItem(PENDING_KEY) || '[]');
  } catch {
    return [];
  }
}

function setPending(list: PendingMessage[]) {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable: the entry stays "opened" in the Message Log.
  }
  listeners.forEach((l) => l());
}

export function subscribePending(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Timeline entry, last contact and donation status, once a sponsor message has really gone. */
async function applySponsorEffects(log: MessageLog) {
  if (log.recipient !== 'sponsor') return;
  const via = CHANNEL_LABELS[log.channel];
  const now = new Date().toISOString();
  const jobs: PromiseLike<unknown>[] = [];
  if (log.sponsor_id) {
    const thanks = log.message_type === 'donation_thanks';
    jobs.push(supabase.from('interactions').insert({
      sponsor_id: log.sponsor_id,
      type: log.channel === 'email' ? 'email' : log.channel.startsWith('whatsapp') ? 'whatsapp' : 'other',
      summary: `${thanks ? 'Thank-you message' : log.type_label || MESSAGE_TYPE_LABELS[log.message_type]} sent via ${via}`,
      details: log.message_text,
      interaction_date: now,
      conducted_by: log.sent_by,
    }));
    jobs.push(supabase.from('sponsors').update({ last_contact_date: now.split('T')[0] }).eq('id', log.sponsor_id));
  }
  if (log.related_donation_id) {
    jobs.push(supabase.from('donations').update({
      thank_you_sent: true,
      thank_you_sent_at: now,
      thank_you_channel: log.channel.startsWith('whatsapp') ? 'whatsapp' : log.channel,
    }).eq('id', log.related_donation_id));
  }
  await Promise.all(jobs);
}

export async function logMessage(input: LogInput): Promise<MessageLog | null> {
  const { data, error } = await supabase.from('message_logs').insert({
    sponsor_id: input.sponsorId || null,
    sponsor_name: input.sponsorName || null,
    sponsor_phone: input.sponsorPhone || null,
    message_type: input.messageType,
    type_label: input.typeLabel || null,
    related_event_id: input.relatedEventId || null,
    related_donation_id: input.relatedDonationId || null,
    occurrence_date: input.occurrenceDate,
    message_text: input.messageText,
    recipient: input.recipient,
    recipient_phone: input.recipientPhone || null,
    channel: input.channel,
    status: input.status,
    error_message: input.errorMessage || null,
    provider_message_id: input.providerMessageId || null,
    admin_notified: input.adminNotified || false,
    sent_by: input.by?.id || null,
    sent_by_name: input.by?.name || null,
  }).select().single();
  if (error) return null;
  const log = data as MessageLog;
  if (log.status === 'sent') await applySponsorEffects(log);
  if (log.status === 'opened') {
    const who = log.recipient === 'admin' ? 'the admin' : log.sponsor_name || 'the sponsor';
    setPending([...getPendingMessages(), { id: log.id, label: `${log.type_label || MESSAGE_TYPE_LABELS[log.message_type]} to ${who}`, openedAt: Date.now() }]);
  }
  notifyDrawerDataChanged();
  return log;
}

/** Answer to "Did you send the message?": Yes marks it sent, No removes the entry. */
export async function resolvePending(id: string, sent: boolean): Promise<void> {
  setPending(getPendingMessages().filter((p) => p.id !== id));
  await confirmMessage(id, sent);
}

export async function confirmMessage(id: string, sent: boolean): Promise<void> {
  if (sent) {
    const { data } = await supabase.from('message_logs').update({ status: 'sent' }).eq('id', id).select().maybeSingle();
    if (data) await applySponsorEffects(data as MessageLog);
  } else {
    await supabase.from('message_logs').delete().eq('id', id);
  }
  setPending(getPendingMessages().filter((p) => p.id !== id));
  notifyDrawerDataChanged();
}

export async function markAdminNotified(id: string): Promise<void> {
  await supabase.from('message_logs').update({ admin_notified: true }).eq('id', id);
}

export interface ApiSendResult {
  configured: boolean;
  success: boolean;
  messageId?: string;
  error?: string;
}

/** Automatic mode: sends through the server route, which holds the API credentials. */
export async function sendViaApi(phone: string, message: string): Promise<ApiSendResult> {
  try {
    const { data } = await supabase.auth.getSession();
    const response = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
      },
      body: JSON.stringify({ phone, message }),
    });
    const result = await response.json();
    return { configured: !!result.configured, success: !!result.success, messageId: result.messageId, error: result.error };
  } catch {
    return { configured: true, success: false, error: 'Network error.' };
  }
}
