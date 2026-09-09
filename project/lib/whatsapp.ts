import { supabase } from '@/lib/supabase/client';
import type { Sponsor, MessageTemplate } from '@/lib/types';

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
  isDraft?: boolean;
}

/**
 * Checks WhatsApp Cloud API configuration via a server route, since the
 * credentials live in server-only env vars (WHATSAPP_ACCESS_TOKEN etc.)
 * and must never reach the browser bundle.
 */
export async function isWhatsAppConfigured(): Promise<boolean> {
  try {
    const res = await fetch('/api/whatsapp/status');
    const data = await res.json();
    return Boolean(data.configured);
  } catch {
    return false;
  }
}

export function buildMessageFromTemplate(
  template: MessageTemplate,
  variables: Record<string, string>
): string {
  let body = template.body;
  for (const [key, value] of Object.entries(variables)) {
    body = body.replaceAll(`{{${key}}}`, value);
  }
  return body;
}

export async function sendWhatsAppMessage(
  sponsor: Sponsor,
  messageBody: string,
  templateId?: string,
  sentBy?: string
): Promise<SendMessageResult> {
  if (!sponsor.whatsapp_consent) {
    return { success: false, error: 'WhatsApp consent has not been provided.' };
  }
  if (!sponsor.whatsapp) {
    return { success: false, error: 'WhatsApp number is missing.' };
  }

  // Save message record first
  const { data: msgRecord, error: dbError } = await supabase
    .from('whatsapp_messages')
    .insert({
      sponsor_id: sponsor.id,
      template_id: templateId || null,
      phone: sponsor.whatsapp,
      message_body: messageBody,
      direction: 'outbound',
      status: 'draft',
      sent_by: sentBy || null,
    })
    .select()
    .single();

  if (dbError) {
    return { success: false, error: 'Failed to save message record.' };
  }

  // Attempt to send via the server-side WhatsApp Cloud API route. Credentials
  // (WHATSAPP_ACCESS_TOKEN etc.) live only in server env vars, never here.
  // The route requires a valid session (checked server-side) so it can't be
  // used as an open relay by an unauthenticated caller.
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const response = await fetch('/api/whatsapp/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionData.session ? { Authorization: `Bearer ${sessionData.session.access_token}` } : {}),
      },
      body: JSON.stringify({ phone: sponsor.whatsapp, message: messageBody }),
    });
    const result = await response.json();

    if (!result.configured) {
      // Not configured server-side — leave as draft, not a failure.
      return { success: true, messageId: msgRecord.id, isDraft: true };
    }

    if (!result.success) {
      await supabase
        .from('whatsapp_messages')
        .update({ status: 'failed', error_message: result.error || 'API error' })
        .eq('id', msgRecord.id);
      return { success: false, error: result.error || 'Unable to send message. Please check WhatsApp configuration.' };
    }

    await supabase
      .from('whatsapp_messages')
      .update({ status: 'sent', provider_message_id: result.messageId, sent_at: new Date().toISOString() })
      .eq('id', msgRecord.id);

    return { success: true, messageId: msgRecord.id };
  } catch {
    await supabase
      .from('whatsapp_messages')
      .update({ status: 'failed', error_message: 'Network error' })
      .eq('id', msgRecord.id);
    return { success: false, error: 'Unable to send message. Please check WhatsApp configuration.' };
  }
}

export function buildWhatsAppUrl(phone: string, message?: string): string {
  const cleaned = phone.replace(/\D/g, '');
  const base = `https://wa.me/${cleaned}`;
  if (message) return `${base}?text=${encodeURIComponent(message)}`;
  return base;
}
