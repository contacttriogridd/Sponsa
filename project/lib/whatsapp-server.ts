import { INVALID_PHONE_MESSAGE, normalizePhone } from '@/lib/phone';
/**
 * Server-only WhatsApp Cloud API sender. Credentials stay in server env vars
 * and never reach the browser. Used by /api/whatsapp/send and the daily
 * summary cron job.
 */

export function whatsappApiConfig(): { token: string; phoneNumberId: string } | null {
  const token = process.env.WHATSAPP_ACCESS_TOKEN || process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  return token && phoneNumberId ? { token, phoneNumberId } : null;
}

export interface WhatsAppSendResult {
  configured: boolean;
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendWhatsAppText(phone: string, message: string): Promise<WhatsAppSendResult> {
  const config = whatsappApiConfig();
  if (!config) return { configured: false, success: false, error: 'WhatsApp API is not configured.' };
  // Same normalizer as the app: a number without +91 is fixed, an invalid one is never sent.
  const to = normalizePhone(phone)?.waDigits;
  if (!to) return { configured: true, success: false, error: INVALID_PHONE_MESSAGE };
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message },
      }),
    });
    const result = await response.json();
    if (!response.ok) return { configured: true, success: false, error: result.error?.message || 'WhatsApp API error' };
    return { configured: true, success: true, messageId: result.messages?.[0]?.id };
  } catch {
    return { configured: true, success: false, error: 'Network error contacting WhatsApp API.' };
  }
}
