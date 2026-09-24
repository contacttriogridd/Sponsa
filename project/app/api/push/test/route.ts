import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { isPushConfigured, sendPush } from '@/lib/push-server';

export const dynamic = 'force-dynamic';

/**
 * Sends a test notification to the caller's own devices. Runs as the caller
 * (their access token + RLS), so it can only ever reach their own subscriptions.
 */
export async function POST(request: NextRequest) {
  if (!isPushConfigured()) {
    return NextResponse.json({ error: 'Push notifications are not configured on the server.' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userData.user.id);

  if (!subs?.length) {
    return NextResponse.json({ error: 'Notifications are not turned on for this device.' }, { status: 400 });
  }

  const result = await sendPush(supabase, subs, [{
    title: '🔔 VP Trust notifications are on',
    body: 'You will get a reminder here before every sponsor birthday and anniversary.',
    url: '/notifications',
    tag: 'test',
  }]);

  return NextResponse.json(result);
}
