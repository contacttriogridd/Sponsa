import { supabase } from '@/lib/supabase/client';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

export type PushSupport = 'supported' | 'unsupported' | 'ios-needs-install' | 'not-configured';

export function getPushSupport(): PushSupport {
  if (typeof window === 'undefined') return 'unsupported';
  if (!VAPID_PUBLIC_KEY) return 'not-configured';

  // iPhone/iPad only allow web push once the app is added to the Home Screen (iOS 16.4+).
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (isIOS && !standalone) return 'ios-needs-install';

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return 'unsupported';
  }
  return 'supported';
}

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // Non-critical: the app works without it, only phone notifications need it.
  });
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

/** True when this device has a push subscription saved for the signed-in user. */
export async function isPushEnabled(): Promise<boolean> {
  if (getPushSupport() !== 'supported' || Notification.permission !== 'granted') return false;
  return !!(await currentSubscription());
}

export async function enablePush(userId: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notifications were blocked. Allow them for this app in your phone settings, then try again.');
  }

  await navigator.serviceWorker.register('/sw.js');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }));

  const json = sub.toJSON();
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    user_agent: navigator.userAgent.slice(0, 250),
  }, { onConflict: 'endpoint' });

  if (error) throw new Error('Could not save this device. Please try again.');
}

export async function disablePush(): Promise<void> {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}

export async function sendTestPush(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch('/api/push/test', {
    method: 'POST',
    headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {},
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Could not send a test notification.');
  }
}
