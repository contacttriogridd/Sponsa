import webpush from 'web-push';
import type { SupabaseClient } from '@supabase/supabase-js';

// Server-only: VAPID_PRIVATE_KEY must never reach the browser.

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  /** Notifications sharing a tag replace each other instead of stacking. */
  tag?: string;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

let configured = false;

export function isPushConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'https://sponsa-five.vercel.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

/**
 * Sends each payload to every given subscription. Subscriptions the push
 * service reports as gone (404/410 — app uninstalled or permission revoked)
 * are deleted so they are not retried every day.
 */
export async function sendPush(
  supabase: SupabaseClient,
  subscriptions: SubscriptionRow[],
  payloads: PushPayload[],
): Promise<{ sent: number; failed: number; removed: number }> {
  configure();
  let sent = 0;
  let failed = 0;
  const gone = new Set<string>();

  for (const sub of subscriptions) {
    for (const payload of payloads) {
      if (gone.has(sub.id)) break;
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 },
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.add(sub.id);
        else failed += 1;
      }
    }
  }

  if (gone.size) await supabase.from('push_subscriptions').delete().in('id', Array.from(gone));
  return { sent, failed, removed: gone.size };
}
